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
import { ZERO } from "../../utils/web3/math-utils";
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
  slippageTolerance: Percentage;
  fetchTick: (tickIndex: number) => Promise<TickData>;
  getNextInitializedTickIndex: (
    currentTickIndex: number,
    tickArraysCrossed: number,
    swapDirection: SwapDirection
  ) => Promise<{ tickIndex: number; tickArraysCrossed: number }>;
};

type SwapSimulationInput = {
  amount: u64;
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
  sqrtPriceX64: BN;
  tickIndex: number;
  liquidity: u64;
  amountRemaining: u64;
  tickArraysCrossed: number;
};

type SwapStepSimulationOutput = {
  nextTickSqrtPriceX64: BN;
  nextSqrtPriceX64: BN;
  nextTickIndex: number;
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
        amountRemaining: specifiedAmountLeft,
        tickIndex: currentTickIndex,
        liquidity: currentLiquidity,
        tickArraysCrossed,
      });

      const { input, output, nextSqrtPriceX64, nextTickIndex, nextTickSqrtPriceX64 } =
        swapStepSimulationOutput;
      const [specifiedAmountUsed, otherAmount] = resolveTokenAmounts(
        input,
        output,
        amountSpecified
      );
      invariant(!!specifiedAmountUsed, "specifiedAmountUsed cannot be undefined");
      invariant(!!otherAmountCalculated, "otherAmountCalculated cannot be undefined");

      specifiedAmountLeft = specifiedAmountLeft.sub(specifiedAmountUsed);
      otherAmountCalculated = otherAmountCalculated.add(otherAmount);

      if (nextSqrtPriceX64.eq(nextTickSqrtPriceX64)) {
        const nextTick = await fetchTick(nextTickIndex);

        currentLiquidity = calculateNewLiquidity(
          currentLiquidity,
          nextTick.liquidityNet,
          swapDirection
        );
        currentTickIndex =
          this.config.swapDirection == SwapDirection.AtoB ? nextTickIndex - 1 : nextTickIndex;
      }

      currentSqrtPriceX64 = nextSqrtPriceX64;
      tickArraysCrossed = swapStepSimulationOutput.tickArraysCrossed;
    }

    const [inputAmount, outputAmount] = resolveTokenAmounts(
      specifiedAmount.sub(specifiedAmountLeft),
      otherAmountCalculated,
      amountSpecified
    );

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
      amountRemaining,
      liquidity,
      sqrtPriceX64,
      tickIndex,
      sqrtPriceLimitX64,
      tickArraysCrossed,
    } = input;

    const { tickIndex: nextTickIndex, tickArraysCrossed: tickArraysCrossedUpdate } =
      await getNextInitializedTickIndex(tickIndex, tickArraysCrossed, swapDirection);

    const [nextTickSqrtPriceX64, targetSqrtPriceX64] = getNextSqrtPrices(
      sqrtPriceLimitX64,
      nextTickIndex,
      swapDirection
    );

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

    const isMaxSwap = nextSqrtPriceX64.eq(targetSqrtPriceX64);

    const unfixedDelta = getAmountUnfixedDelta(
      sqrtPriceX64,
      targetSqrtPriceX64,
      liquidity,
      amountSpecified,
      swapDirection
    );

    if (!isMaxSwap) {
      fixedDelta = getAmountFixedDelta(
        sqrtPriceX64,
        nextSqrtPriceX64,
        liquidity,
        amountSpecified,
        swapDirection
      );
    }

    let [inputDelta, outputDelta] = resolveTokenAmounts(fixedDelta, unfixedDelta, amountSpecified);
    invariant(!!inputDelta, "inputDelta cannot be undefined");
    invariant(!!outputDelta, "outputDelta cannot be undefined");

    if (amountSpecified == AmountSpecified.Output && outputDelta.gt(amountRemaining)) {
      outputDelta = amountRemaining;
    }

    return {
      nextTickIndex,
      nextTickSqrtPriceX64,
      nextSqrtPriceX64,
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

function getNextSqrtPrices(
  sqrtPriceLimitX64: BN,
  nextInitializedTickIndex: number,
  swapDirection: SwapDirection
): [BN, BN] {
  const nextTickPrice = tickIndexToSqrtPriceX64(nextInitializedTickIndex);
  if (swapDirection == SwapDirection.AtoB) {
    return [nextTickPrice, BN.max(sqrtPriceLimitX64, nextTickPrice)];
  } else {
    return [nextTickPrice, BN.min(sqrtPriceLimitX64, nextTickPrice)];
  }
}
