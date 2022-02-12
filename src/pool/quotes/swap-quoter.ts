import {
  TickData,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
  tickIndexToSqrtPriceX64,
} from "@orca-so/whirlpool-client-sdk";
import { BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { Percentage } from "../../utils/public/percentage";
import { divRoundUp, ZERO } from "../../utils/web3/math-utils";
import {
  getAmountFixedDelta,
  getAmountUnfixedDelta,
  getNextSqrtPrice,
} from "../../utils/whirlpool/position-util";

export const MAX_TICK_ARRAY_CROSSINGS = 2;

export enum SwapDirection {
  AtoB = "Swap A to B",
  BtoA = "Swap B to A",
}

export enum AmountSpecified {
  Input = "Specified input amount",
  Output = "Specified output amount",
}

export type SwapSimulatorConfig = {
  swapDirection: SwapDirection;
  amountSpecified: AmountSpecified;
  feeRate: Percentage;
  fetchTick: (tickIndex: number) => Promise<TickData>;
  getNextInitializedTickIndex: (
    currentTickIndex: number,
    tickArraysCrossed: number,
    swapDirection: SwapDirection,
    tickSpacing: number
  ) => Promise<{ tickIndex: number; tickArraysCrossed: number }>;
};

type SwapSimulationInput = {
  amount: BN;
  currentSqrtPriceX64: BN;
  currentTickIndex: number;
  currentLiquidity: BN;
  tickSpacing: number;
};

type SwapSimulationOutput = {
  amountIn: BN;
  amountOut: BN;
  sqrtPriceAfterSwapX64: BN;
};

type SwapStepSimulationInput = {
  sqrtPriceX64: BN;
  tickIndex: number;
  liquidity: BN;
  amountRemaining: u64;
  tickArraysCrossed: number;
  tickSpacing: number;
};

type SwapStepSimulationOutput = {
  nextSqrtPriceX64: BN;
  nextTickIndex: number;
  input: BN;
  output: BN;
  tickArraysCrossed: number;
  hasReachedNextTick: boolean;
};

export class SwapSimulator {
  public constructor(private readonly config: SwapSimulatorConfig) {}

  // ** METHODS **
  public async simulateSwap(input: SwapSimulationInput): Promise<SwapSimulationOutput> {
    const { swapDirection, amountSpecified, fetchTick } = this.config;

    let {
      currentTickIndex,
      currentLiquidity,
      amount: specifiedAmountLeft,
      currentSqrtPriceX64,
    } = input;

    invariant(!specifiedAmountLeft.eq(ZERO), "amount must be nonzero");

    const { tickSpacing } = input;

    let otherAmountCalculated = ZERO;

    let tickArraysCrossed = 0;

    while (specifiedAmountLeft.gt(ZERO)) {
      const swapStepSimulationOutput: SwapStepSimulationOutput = await this.simulateSwapStep({
        sqrtPriceX64: currentSqrtPriceX64,
        amountRemaining: specifiedAmountLeft,
        tickIndex: currentTickIndex,
        liquidity: currentLiquidity,
        tickArraysCrossed,
        tickSpacing,
      });

      const { input, output, nextSqrtPriceX64, nextTickIndex, hasReachedNextTick } =
        swapStepSimulationOutput;

      const [specifiedAmountUsed, otherAmount] = resolveTokenAmounts(
        input,
        output,
        amountSpecified
      );

      specifiedAmountLeft = specifiedAmountLeft.sub(specifiedAmountUsed);
      otherAmountCalculated = otherAmountCalculated.add(otherAmount);

      if (hasReachedNextTick) {
        const nextTick = await fetchTick(nextTickIndex);

        currentLiquidity = calculateNewLiquidity(
          currentLiquidity,
          nextTick.liquidityNet,
          swapDirection
        );
        currentTickIndex = swapDirection == SwapDirection.AtoB ? nextTickIndex - 1 : nextTickIndex;
      }

      currentSqrtPriceX64 = nextSqrtPriceX64;
      tickArraysCrossed = swapStepSimulationOutput.tickArraysCrossed;
    }

    const [inputAmount, outputAmount] = resolveTokenAmounts(
      input.amount.sub(specifiedAmountLeft),
      otherAmountCalculated,
      amountSpecified
    );

    return {
      sqrtPriceAfterSwapX64: currentSqrtPriceX64,
      amountIn: inputAmount,
      amountOut: outputAmount,
    };
  }

  public async simulateSwapStep(input: SwapStepSimulationInput): Promise<SwapStepSimulationOutput> {
    const { swapDirection, amountSpecified, feeRate, getNextInitializedTickIndex } = this.config;

    const { amountRemaining, liquidity, sqrtPriceX64, tickIndex, tickArraysCrossed, tickSpacing } =
      input;

    const { tickIndex: nextTickIndex, tickArraysCrossed: tickArraysCrossedUpdate } =
      await getNextInitializedTickIndex(tickIndex, tickArraysCrossed, swapDirection, tickSpacing);

    const targetSqrtPriceX64 = tickIndexToSqrtPriceX64(nextTickIndex);

    let fixedDelta = getAmountFixedDelta(
      sqrtPriceX64,
      targetSqrtPriceX64,
      liquidity,
      amountSpecified,
      swapDirection
    );

    let amountCalculated = amountRemaining;
    if (amountSpecified == AmountSpecified.Input) {
      amountCalculated = calculateAmountAfterFees(amountRemaining, feeRate);
    }

    const nextSqrtPriceX64 = amountCalculated.gte(fixedDelta)
      ? targetSqrtPriceX64 // Fully utilize liquidity till upcoming (next/prev depending on swap type) initialized tick
      : getNextSqrtPrice(sqrtPriceX64, liquidity, amountCalculated, amountSpecified, swapDirection);

    const hasReachedNextTick = nextSqrtPriceX64.eq(targetSqrtPriceX64);

    const unfixedDelta = getAmountUnfixedDelta(
      sqrtPriceX64,
      nextSqrtPriceX64,
      liquidity,
      amountSpecified,
      swapDirection
    );

    if (!hasReachedNextTick) {
      fixedDelta = getAmountFixedDelta(
        sqrtPriceX64,
        nextSqrtPriceX64,
        liquidity,
        amountSpecified,
        swapDirection
      );
    }

    let [inputDelta, outputDelta] = resolveTokenAmounts(fixedDelta, unfixedDelta, amountSpecified);

    // Cap output if output specified
    if (amountSpecified == AmountSpecified.Output && outputDelta.gt(amountRemaining)) {
      outputDelta = amountRemaining;
    }

    if (amountSpecified == AmountSpecified.Input && !hasReachedNextTick) {
      inputDelta = amountRemaining;
    } else {
      inputDelta = inputDelta.add(calculateFeesFromAmount(inputDelta, feeRate));
    }

    return {
      nextTickIndex,
      nextSqrtPriceX64,
      input: inputDelta,
      output: outputDelta,
      tickArraysCrossed: tickArraysCrossedUpdate,
      hasReachedNextTick,
    };
  }
}

function calculateAmountAfterFees(amount: u64, feeRate: Percentage): BN {
  return amount.mul(feeRate.denominator.sub(feeRate.numerator)).div(feeRate.denominator);
}

function calculateFeesFromAmount(amount: u64, feeRate: Percentage): BN {
  return divRoundUp(amount.mul(feeRate.numerator), feeRate.denominator.sub(feeRate.numerator));
}

function calculateNewLiquidity(liquidity: BN, nextLiquidityNet: BN, swapDirection: SwapDirection) {
  if (swapDirection == SwapDirection.AtoB) {
    nextLiquidityNet = nextLiquidityNet.neg();
  }

  return liquidity.add(nextLiquidityNet);
}

function resolveTokenAmounts(
  specifiedTokenAmount: BN,
  otherTokenAmount: BN,
  amountSpecified: AmountSpecified
): [BN, BN] {
  if (amountSpecified == AmountSpecified.Input) {
    return [specifiedTokenAmount, otherTokenAmount];
  } else {
    return [otherTokenAmount, specifiedTokenAmount];
  }
}
