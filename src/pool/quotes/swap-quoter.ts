import {
  TickData,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
  tickIndexToSqrtPriceX64,
  WhirlpoolData,
  TICK_ARRAY_SIZE,
  MAX_TICK_INDEX,
} from "@orca-so/whirlpool-client-sdk";
import { Address, BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { AccountFetcher } from "../../accounts/account-fetcher";
import { Percentage } from "../../utils/public/percentage";
import { divRoundUp, ZERO } from "../../utils/web3/math-utils";
import { PoolUtil } from "../../utils/whirlpool/pool-util";
import {
  getAmountFixedDelta,
  getAmountUnfixedDelta,
  getNextSqrtPrice,
} from "../../utils/public/position-util";
import { TickUtil } from "../../utils/whirlpool/tick-util";

export const MAX_TICK_ARRAY_CROSSINGS = 2;

export enum SwapDirection {
  AtoB = "Swap A to B",
  BtoA = "Swap B to A",
}

export enum AmountSpecified {
  Input = "Specified input amount",
  Output = "Specified output amount",
}

type SwapSimulationBaseInput = {
  refresh: boolean;
  dal: AccountFetcher;
  poolAddress: Address;
  whirlpoolData: WhirlpoolData;
  amountSpecified: AmountSpecified;
  swapDirection: SwapDirection;
};

type SwapSimulationInput = {
  amount: BN;
  currentSqrtPriceX64: BN;
  currentTickIndex: number;
  currentLiquidity: BN;
};

type SwapSimulationOutput = {
  amountIn: BN;
  amountOut: BN;
  sqrtPriceLimitX64: BN;
};

type SwapStepSimulationInput = {
  sqrtPriceX64: BN;
  tickIndex: number;
  liquidity: BN;
  amountRemaining: u64;
  tickArraysCrossed: number;
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
  public constructor() {}

  // ** METHODS **
  public async simulateSwap(
    baseInput: SwapSimulationBaseInput,
    input: SwapSimulationInput
  ): Promise<SwapSimulationOutput> {
    const { amountSpecified, swapDirection } = baseInput;

    let {
      currentTickIndex,
      currentLiquidity,
      amount: specifiedAmountLeft,
      currentSqrtPriceX64,
    } = input;

    invariant(!specifiedAmountLeft.eq(ZERO), "amount must be nonzero");

    let otherAmountCalculated = ZERO;

    let tickArraysCrossed = 0;
    let sqrtPriceLimitX64;

    while (specifiedAmountLeft.gt(ZERO)) {
      if (tickArraysCrossed > MAX_TICK_ARRAY_CROSSINGS) {
        throw Error("Crossed the maximum number of tick arrays");
      }

      const swapStepSimulationOutput: SwapStepSimulationOutput = await this.simulateSwapStep(
        baseInput,
        {
          sqrtPriceX64: currentSqrtPriceX64,
          amountRemaining: specifiedAmountLeft,
          tickIndex: currentTickIndex,
          liquidity: currentLiquidity,
          tickArraysCrossed,
        }
      );

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
        const nextTick = await fetchTick(baseInput, nextTickIndex);

        currentLiquidity = calculateNewLiquidity(
          currentLiquidity,
          nextTick.liquidityNet,
          swapDirection
        );
        currentTickIndex = swapDirection == SwapDirection.AtoB ? nextTickIndex - 1 : nextTickIndex;
      }

      currentSqrtPriceX64 = nextSqrtPriceX64;
      tickArraysCrossed = swapStepSimulationOutput.tickArraysCrossed;

      if (tickArraysCrossed > MAX_TICK_ARRAY_CROSSINGS) {
        sqrtPriceLimitX64 = tickIndexToSqrtPriceX64(nextTickIndex);
      }
    }

    const [inputAmount, outputAmount] = resolveTokenAmounts(
      input.amount.sub(specifiedAmountLeft),
      otherAmountCalculated,
      amountSpecified
    );

    if (!sqrtPriceLimitX64) {
      if (swapDirection === SwapDirection.AtoB) {
        sqrtPriceLimitX64 = new BN(MIN_SQRT_PRICE);
      } else {
        sqrtPriceLimitX64 = new BN(MAX_SQRT_PRICE);
      }
    }

    // Return sqrtPriceLimit if 3 tick arrays crossed
    return {
      amountIn: inputAmount,
      amountOut: outputAmount,
      sqrtPriceLimitX64,
    };
  }

  public async simulateSwapStep(
    baseInput: SwapSimulationBaseInput,
    input: SwapStepSimulationInput
  ): Promise<SwapStepSimulationOutput> {
    const { whirlpoolData, amountSpecified, swapDirection } = baseInput;

    const { feeRate } = whirlpoolData;

    const feeRatePercentage = PoolUtil.getFeeRate(feeRate);

    const { amountRemaining, liquidity, sqrtPriceX64, tickIndex, tickArraysCrossed } = input;

    const { tickIndex: nextTickIndex, tickArraysCrossed: tickArraysCrossedUpdate } =
      // Return last tick in tick array if max tick arrays crossed
      // Error out of this gets called for another iteration
      await getNextInitializedTickIndex(baseInput, tickIndex, tickArraysCrossed);

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
      amountCalculated = calculateAmountAfterFees(amountRemaining, feeRatePercentage);
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
      inputDelta = inputDelta.add(calculateFeesFromAmount(inputDelta, feeRatePercentage));
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

async function fetchTickArray(baseInput: SwapSimulationBaseInput, tickIndex: number) {
  const {
    dal,
    poolAddress,
    refresh,
    whirlpoolData: { tickSpacing },
  } = baseInput;
  const tickArray = await dal.getTickArray(
    TickUtil.getPdaWithTickIndex(tickIndex, tickSpacing, poolAddress, dal.programId).publicKey,
    refresh
  );
  invariant(!!tickArray, "tickArray is null");
  return tickArray;
}

async function fetchTick(baseInput: SwapSimulationBaseInput, tickIndex: number) {
  const tickArray = await fetchTickArray(baseInput, tickIndex);
  const {
    whirlpoolData: { tickSpacing },
  } = baseInput;
  return TickUtil.getTick(tickArray, tickIndex, tickSpacing);
}

async function getNextInitializedTickIndex(
  baseInput: SwapSimulationBaseInput,
  currentTickIndex: number,
  tickArraysCrossed: number
) {
  const {
    whirlpoolData: { tickSpacing },
    swapDirection,
  } = baseInput;
  let nextInitializedTickIndex: number | undefined = undefined;

  while (nextInitializedTickIndex === undefined) {
    const currentTickArray = await fetchTickArray(baseInput, currentTickIndex);

    let temp;
    if (swapDirection == SwapDirection.AtoB) {
      temp = TickUtil.getPrevInitializedTickIndex(currentTickArray, currentTickIndex, tickSpacing);
    } else {
      temp = TickUtil.getNextInitializedTickIndex(currentTickArray, currentTickIndex, tickSpacing);
    }

    if (temp) {
      nextInitializedTickIndex = temp;
    } else if (tickArraysCrossed === MAX_TICK_ARRAY_CROSSINGS) {
      if (swapDirection === SwapDirection.AtoB) {
        nextInitializedTickIndex = currentTickArray.startTickIndex;
      } else {
        nextInitializedTickIndex = currentTickArray.startTickIndex + TICK_ARRAY_SIZE * tickSpacing;
      }
      tickArraysCrossed++;
    } else {
      if (swapDirection === SwapDirection.AtoB) {
        currentTickIndex = currentTickArray.startTickIndex - 1;
      } else {
        currentTickIndex = currentTickArray.startTickIndex + TICK_ARRAY_SIZE * tickSpacing;
      }
      tickArraysCrossed++;
    }
  }

  return {
    tickIndex: nextInitializedTickIndex,
    tickArraysCrossed,
  };
}
