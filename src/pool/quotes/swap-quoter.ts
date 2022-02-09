import {
  TickArrayData,
  TickData,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
  tickIndexToSqrtPriceX64,
  sqrtPriceX64ToTickIndex,
} from "@orca-so/whirlpool-client-sdk";
import { BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { resolve } from "dns";
import invariant from "tiny-invariant";
import { Percentage } from "../../utils/public/percentage";
import { ZERO } from "../../utils/web3/math-utils";
import {
  getAmountFixedDelta,
  getAmountUnfixedDelta,
  getNextSqrtPrice,
  getTokenAFromLiquidity,
  getTokenBFromLiquidity,
} from "../../utils/whirlpool/position-util";
import {
  getLowerSqrtPriceFromTokenA,
  getLowerSqrtPriceFromTokenB,
  getUpperSqrtPriceFromTokenA,
  getUpperSqrtPriceFromTokenB,
} from "../../utils/whirlpool/swap-util";

export const MAX_TICK_ARRAY_CROSSINGS = 2;

export enum SwapDirection {
  AtoB = "Swap A to B",
  BtoA = "Swap B to A",
}

export enum AmountSpecified {
  Input = "Specified input amount",
  Output = "Specified output amount",
}

enum Rounding {
  Up,
  Down,
}

export type SwapSimulatorConfig = {
  swapDirection: SwapDirection;
  amountSpecified: AmountSpecified;
  feeRate: Percentage;
  slippageTolerance: Percentage;
  fetchTickArray: (tickIndex: number) => Promise<TickArrayData>;
  fetchTick: (tickIndex: number) => Promise<TickData>;
  getNextInitializedTickIndex: (
    currentTickIndex: number,
    tickArraysCrossed: number,
    swapDirection: SwapDirection
  ) => Promise<{ tickIndex: number; tickArraysCrossed: number }>;
};

type SwapState = {
  sqrtPriceX64: BN;
  tickArray: TickArrayData;
  tickIndex: number;
  liquidity: u64;
  specifiedAmountLeft: u64; // either the input remaining to be swapped or output remaining to be swapped for
  otherAmountCalculated: u64; // either the output of this swap or the input that needs to be swapped to receive the specified output
};

type SwapSimulationInput = {
  amount: u64;
  currentTickArray: TickArrayData;
  currentSqrtPriceX64: BN;
  currentTickIndex: number;
  currentLiquidity: u64;
};

type SwapSimulationOutput = {
  sqrtPriceLimitX64: BN;
  amountIn: u64;
  amountOut: u64;
  sqrtPriceAfterSwapX64: BN;
};

type SwapStepSimulationInput = {
  sqrtPriceLimitX64: BN;
  tickArray: TickArrayData;
  sqrtPriceX64: BN;
  tickIndex: number;
  liquidity: u64;
  amount: u64;
  tickArraysCrossed: number;
};

type SwapStepSimulationOutput = {
  currentTickIndex: number;
  input: u64;
  output: u64;
  tickArraysCrossed: number;
};

const MIN_SQRT_PRICE_X64 = new BN(MIN_SQRT_PRICE);
const MAX_SQRT_PRICE_X64 = new BN(MAX_SQRT_PRICE);

export class SwapSimulator {
  public constructor(private readonly config: SwapSimulatorConfig) {}

  // ** METHODS **
  public async simulateSwap(input: SwapSimulationInput): Promise<SwapSimulationOutput> {
    const { swapDirection, amountSpecified, slippageTolerance, fetchTick } = this.config;

    let {
      currentTickIndex,
      currentTickArray,
      currentLiquidity,
      amount: specifiedAmount,
      currentSqrtPriceX64,
    } = input;

    const sqrtPriceLimitX64 = adjustForSlippage(
      currentSqrtPriceX64,
      slippageTolerance,
      swapDirection
    );

    invariant(
      sqrtPriceLimitX64.gte(MIN_SQRT_PRICE_X64) && sqrtPriceLimitX64.lte(MAX_SQRT_PRICE_X64),
      "sqrtPriceLimitX64 out of bounds"
    );

    invariant(specifiedAmount.eq(ZERO), "amount must be nonzero");

    let specifiedAmountLeft = specifiedAmount;
    let otherAmountCalculated = ZERO;

    let tickArraysCrossed = 0;

    while (specifiedAmountLeft.gt(ZERO) && !currentSqrtPriceX64.eq(sqrtPriceLimitX64)) {
      const swapStepSimulationOutput: SwapStepSimulationOutput = await this.simulateSwapStep({
        sqrtPriceLimitX64,
        sqrtPriceX64: currentSqrtPriceX64,
        amount: specifiedAmountLeft,
        tickArray: currentTickArray,
        tickIndex: currentTickIndex,
        liquidity: currentLiquidity,
        tickArraysCrossed,
      });

      const { input, output } = swapStepSimulationOutput;
      const [specifiedAmountUsed, otherAmount] = resolveTokenAmounts(
        input,
        output,
        amountSpecified
      );
      invariant(!!specifiedAmountUsed, "specifiedAmountUsed cannot be undefined");
      invariant(!!otherAmountCalculated, "otherAmountCalculated cannot be undefined");

      specifiedAmountLeft = specifiedAmountLeft.sub(specifiedAmountUsed);
      otherAmountCalculated = otherAmountCalculated.add(otherAmount);

      if (swapStepSimulationOutput.currentTickIndex !== currentTickIndex) {
        // Moving between ticks
        const nextTickIndex = swapStepSimulationOutput.currentTickIndex;
        const nextTick = await fetchTick(nextTickIndex);

        currentSqrtPriceX64 = tickIndexToSqrtPriceX64(nextTickIndex);
        currentLiquidity = calculateNewLiquidity(
          currentLiquidity,
          nextTick.liquidityNet,
          swapDirection
        );
        currentTickIndex =
          this.config.swapDirection == SwapDirection.AtoB ? nextTickIndex - 1 : nextTickIndex;
      }

      tickArraysCrossed = swapStepSimulationOutput.tickArraysCrossed;
    }

    const [inputAmount, outputAmount] = resolveTokenAmounts(
      specifiedAmount.sub(specifiedAmountLeft),
      otherAmountCalculated,
      amountSpecified
    );
    invariant(!!inputAmount, "inputAmount cannot be undefined");
    invariant(!!outputAmount, "outputAmount cannot be undefined");

    return {
      sqrtPriceAfterSwapX64: currentSqrtPriceX64,
      amountIn: inputAmount,
      amountOut: outputAmount,
      sqrtPriceLimitX64,
    };
  }

  public async simulateSwapStep(input: SwapStepSimulationInput): Promise<SwapStepSimulationOutput> {
    const { swapDirection, amountSpecified, feeRate, getNextInitializedTickIndex } = this.config;

    const {
      amount: specifiedTokenAmount,
      liquidity: currentLiquidity,
      sqrtPriceX64: currentSqrtPriceX64,
      tickIndex,
      sqrtPriceLimitX64,
      tickArraysCrossed,
    } = input;

    const { tickIndex: nextTickIndex, tickArraysCrossed: tickArraysCrossedUpdate } =
      await getNextInitializedTickIndex(tickIndex, tickArraysCrossed, swapDirection);

    const targetSqrtPriceX64 = clampSqrtPrice(sqrtPriceLimitX64, nextTickIndex, swapDirection);

    let fixedAmount = getAmountFixedDelta(
      currentSqrtPriceX64,
      targetSqrtPriceX64,
      currentLiquidity,
      amountSpecified,
      swapDirection
    );

    let amountCalculated = specifiedTokenAmount;
    if (amountSpecified == AmountSpecified.Input) {
      amountCalculated = calculateAmountAfterFees(specifiedTokenAmount, feeRate);
    }

    const nextSqrtPriceX64 = amountCalculated.gte(fixedAmount)
      ? targetSqrtPriceX64 // Fully utilize liquidity till upcoming (next/prev depending on swap type) initialized tick
      : getNextSqrtPrice(
          currentSqrtPriceX64,
          currentLiquidity,
          amountCalculated,
          amountSpecified,
          swapDirection
        );

    const isMaxSwap = nextSqrtPriceX64.eq(targetSqrtPriceX64);

    const unfixedAmount = getAmountUnfixedDelta(
      currentSqrtPriceX64,
      targetSqrtPriceX64,
      currentLiquidity,
      amountSpecified,
      swapDirection
    );

    if (!isMaxSwap) {
      fixedAmount = getAmountFixedDelta(
        currentSqrtPriceX64,
        nextSqrtPriceX64,
        currentLiquidity,
        amountSpecified,
        swapDirection
      );
    }

    const [inputDelta, outputDelta] = resolveTokenAmounts(
      fixedAmount,
      unfixedAmount,
      amountSpecified
    );
    invariant(!!inputDelta, "inputDelta cannot be undefined");
    invariant(!!outputDelta, "outputDelta cannot be undefined");

    return {
      currentTickIndex: sqrtPriceX64ToTickIndex(nextSqrtPriceX64),
      input: calculateAmountWithFees(inputDelta, feeRate),
      output: outputDelta,
      tickArraysCrossed: tickArraysCrossedUpdate,
    };
  }
}

function calculateAmountAfterFees(amount: u64, feeRate: Percentage): BN {
  const fees = amount.mul(feeRate.denominator.sub(feeRate.numerator)).div(feeRate.denominator);
  return amount.sub(fees);
}

function calculateAmountWithFees(amount: u64, feeRate: Percentage): BN {
  const fees = amount.mul(feeRate.numerator).div(feeRate.denominator);
  return amount.add(fees);
}

function adjustForSlippage(
  sqrtPriceX64: BN,
  slippageTolerance: Percentage,
  swapDirection: SwapDirection
) {
  const numeratorSquared = slippageTolerance.numerator.pow(new BN(2));
  if (swapDirection == SwapDirection.AtoB) {
    return sqrtPriceX64
      .mul(slippageTolerance.denominator.sub(numeratorSquared))
      .div(slippageTolerance.denominator);
  } else {
    return sqrtPriceX64
      .mul(slippageTolerance.denominator.add(numeratorSquared))
      .div(slippageTolerance.denominator);
  }
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

function clampSqrtPrice(
  sqrtPriceLimitX64: BN,
  nextInitializedTickIndex: number,
  swapDirection: SwapDirection
): BN {
  if (swapDirection == SwapDirection.AtoB) {
    return BN.max(sqrtPriceLimitX64, tickIndexToSqrtPriceX64(nextInitializedTickIndex));
  } else {
    return BN.min(sqrtPriceLimitX64, tickIndexToSqrtPriceX64(nextInitializedTickIndex));
  }
}
