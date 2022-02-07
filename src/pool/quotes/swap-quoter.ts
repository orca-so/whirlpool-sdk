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
import invariant from "tiny-invariant";
import { Percentage } from "../../utils/public/percentage";
import { ZERO } from "../../utils/web3/math-utils";
import {
  getTokenAFromLiquidity,
  getTokenBFromLiquidity,
} from "../../utils/whirlpool/position-util";
import {
  getLowerSqrtPriceFromTokenA,
  getLowerSqrtPriceFromTokenB,
  getUpperSqrtPriceFromTokenA,
  getUpperSqrtPriceFromTokenB,
} from "../../utils/whirlpool/swap-util";

const MAX_TICK_ARRAY_CROSSINGS = 2;

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
  protocolFeeRate: Percentage;
  slippageTolerance: Percentage;
  fetchTickArray: (tickIndex: number) => Promise<TickArrayData>;
  fetchTick: (tickIndex: number) => Promise<TickData>;
  getPrevInitializedTickIndex: (currentTickIndex: number, maxCrossed: boolean) => Promise<number>;
  getNextInitializedTickIndex: (currentTickIndex: number, maxCrossed: boolean) => Promise<number>;
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
  maxCrossed: boolean;
};

type SwapStepSimulationOutput = {
  currentTickIndex: number;
  input: u64;
  output: u64;
};

const MIN_SQRT_PRICE_X64 = new BN(MIN_SQRT_PRICE);
const MAX_SQRT_PRICE_X64 = new BN(MAX_SQRT_PRICE);

export class SwapSimulator {
  public constructor(private readonly config: SwapSimulatorConfig) {}

  // ** METHODS **

  public async simulateSwap(input: SwapSimulationInput): Promise<SwapSimulationOutput> {
    const { swapDirection, amountSpecified, slippageTolerance, fetchTick, fetchTickArray } =
      this.config;
    const { calculateSqrtPriceLimit, calculateNewLiquidity, sqrtPriceWithinLimit } =
      SwapSimulator.functionsBySwapDirection[swapDirection];
    const { resolveSpecifiedAndOtherAmounts, resolveInputAndOutputAmounts } =
      SwapSimulator.functionsByAmountSpecified[amountSpecified];

    const {
      currentTickIndex,
      currentTickArray,
      currentLiquidity,
      amount: specifiedAmount,
      currentSqrtPriceX64,
    } = input;

    const sqrtPriceLimitX64 = calculateSqrtPriceLimit(currentSqrtPriceX64, slippageTolerance);

    invariant(
      sqrtPriceLimitX64.gte(MIN_SQRT_PRICE_X64) && sqrtPriceLimitX64.lte(MAX_SQRT_PRICE_X64),
      "sqrtPriceLimitX64 out of bounds"
    );

    const state: SwapState = {
      sqrtPriceX64: currentSqrtPriceX64,
      tickIndex: currentTickIndex,
      tickArray: currentTickArray,
      liquidity: currentLiquidity,
      specifiedAmountLeft: specifiedAmount,
      otherAmountCalculated: new u64(0),
    };

    let tickArraysCrossed = 0;

    while (
      state.specifiedAmountLeft.gt(ZERO) &&
      sqrtPriceWithinLimit(currentSqrtPriceX64, sqrtPriceLimitX64)
    ) {
      const swapStepSimulationOutput: SwapStepSimulationOutput = await this.simulateSwapStep({
        sqrtPriceLimitX64,
        sqrtPriceX64: state.sqrtPriceX64,
        amount: state.specifiedAmountLeft,
        tickArray: state.tickArray,
        tickIndex: state.tickIndex,
        liquidity: state.liquidity,
        maxCrossed: tickArraysCrossed == MAX_TICK_ARRAY_CROSSINGS,
      });

      const { input, output } = swapStepSimulationOutput;
      const [specifiedAmountUsed, otherAmountCalculated] = resolveSpecifiedAndOtherAmounts(
        input,
        output
      );
      invariant(!!specifiedAmountUsed, "specifiedAmountUsed cannot be undefined");
      invariant(!!otherAmountCalculated, "otherAmountCalculated cannot be undefined");

      state.specifiedAmountLeft = state.specifiedAmountLeft.sub(specifiedAmountUsed);
      state.otherAmountCalculated = state.otherAmountCalculated.add(otherAmountCalculated);

      if (swapStepSimulationOutput.currentTickIndex !== state.tickIndex) {
        // Moving between ticks
        const currentTickIndex = state.tickIndex;
        const nextTickIndex = swapStepSimulationOutput.currentTickIndex;
        const [currentTickArray, nextTickArray, currentTick, nextTick] = await Promise.all([
          fetchTickArray(currentTickIndex),
          fetchTickArray(nextTickIndex),
          fetchTick(currentTickIndex),
          fetchTick(nextTickIndex),
        ]);

        state.sqrtPriceX64 = tickIndexToSqrtPriceX64(nextTickIndex);
        state.liquidity = calculateNewLiquidity(
          state.liquidity,
          currentTick.liquidityNet,
          nextTick.liquidityNet
        );

        state.tickIndex =
          this.config.swapDirection == SwapDirection.AtoB ? nextTickIndex - 1 : nextTickIndex;
        if (currentTickArray.startTickIndex !== nextTickArray.startTickIndex) {
          tickArraysCrossed += 1;
        }
      }
    }

    const [inputAmount, outputAmount] = resolveInputAndOutputAmounts(
      specifiedAmount.sub(state.specifiedAmountLeft),
      state.otherAmountCalculated
    );
    invariant(!!inputAmount, "inputAmount cannot be undefined");
    invariant(!!outputAmount, "outputAmount cannot be undefined");

    return {
      sqrtPriceAfterSwapX64: state.sqrtPriceX64,
      amountIn: inputAmount,
      amountOut: outputAmount,
      sqrtPriceLimitX64,
    };
  }

  public async simulateSwapStep(input: SwapStepSimulationInput): Promise<SwapStepSimulationOutput> {
    const {
      swapDirection,
      amountSpecified,
      feeRate,
      getNextInitializedTickIndex,
      getPrevInitializedTickIndex,
    } = this.config;
    const { calculateTargetSqrtPrice } = SwapSimulator.functionsBySwapDirection[swapDirection];
    const { resolveInputAndOutputAmounts } =
      SwapSimulator.functionsByAmountSpecified[amountSpecified];
    const {
      calculateSpecifiedTokenDelta,
      calculateOtherTokenDelta,
      calculateNextSqrtPriceGivenTokenDelta,
    } = SwapSimulator.functionsBySwapType[swapDirection][amountSpecified];

    const {
      amount: specifiedTokenAmount,
      liquidity: currentLiquidity,
      sqrtPriceX64: currentSqrtPriceX64,
      tickArray: currentTickArrayAccount,
      tickIndex,
      sqrtPriceLimitX64,
      maxCrossed,
    } = input;

    // const currentSqrtPriceX64 = tickIndexToSqrtPriceX64(currentTickIndex);

    // TODO(atamari): What do we do if next/prev initialized tick is more than one tick array account apart
    // Currently, if we're moving between ticks, we stop at the last tick on the adjacent tick array account (due to the whirlpool program limitation)
    const [prevInitializedTickIndex, nextInitializedTickIndex] = await Promise.all([
      getPrevInitializedTickIndex(tickIndex, maxCrossed),
      getNextInitializedTickIndex(tickIndex, maxCrossed),
    ]);

    const targetSqrtPriceX64 = calculateTargetSqrtPrice(
      sqrtPriceLimitX64,
      prevInitializedTickIndex,
      nextInitializedTickIndex
    );

    // TODO: Use getTokenAFromLiquidity and getTokenBFromLiquidity
    const specifiedTokenMaxDelta = calculateSpecifiedTokenDelta(
      currentLiquidity,
      BN.min(currentSqrtPriceX64, targetSqrtPriceX64),
      BN.max(currentSqrtPriceX64, targetSqrtPriceX64)
    );

    const specifiedTokenGivenDelta =
      amountSpecified === AmountSpecified.Input
        ? SwapSimulator.calculateAmountAfterFees(specifiedTokenAmount, feeRate)
        : specifiedTokenAmount;

    const nextSqrtPriceX64 = specifiedTokenGivenDelta.gte(specifiedTokenMaxDelta)
      ? targetSqrtPriceX64 // Fully utilize liquidity till upcoming (next/prev depending on swap type) initialized tick
      : calculateNextSqrtPriceGivenTokenDelta(
          specifiedTokenGivenDelta,
          currentLiquidity,
          currentSqrtPriceX64
        );

    const otherTokenDelta = calculateOtherTokenDelta(
      currentLiquidity,
      BN.min(currentSqrtPriceX64, nextSqrtPriceX64),
      BN.max(currentSqrtPriceX64, nextSqrtPriceX64)
    );

    const specifiedTokenActualDelta = nextSqrtPriceX64.eq(targetSqrtPriceX64)
      ? specifiedTokenMaxDelta
      : calculateSpecifiedTokenDelta(
          currentLiquidity,
          BN.min(currentSqrtPriceX64, nextSqrtPriceX64),
          BN.max(currentSqrtPriceX64, nextSqrtPriceX64)
        );

    const [inputDelta, outputDelta] = resolveInputAndOutputAmounts(
      specifiedTokenActualDelta,
      otherTokenDelta
    );
    invariant(!!inputDelta, "inputDelta cannot be undefined");
    invariant(!!outputDelta, "outputDelta cannot be undefined");

    return {
      currentTickIndex: sqrtPriceX64ToTickIndex(nextSqrtPriceX64),
      input: SwapSimulator.calculateAmountWithFees(inputDelta, feeRate),
      output: outputDelta,
    };
  }

  // ** UTILS **

  private static calculateSqrtPriceSlippage(sqrtPriceX64: BN, slippageTolerance: Percentage): BN {
    // TODO(atamari): Not sure if this is correct since slippage tolerance is for price slippage not sqrtPrice slippage???
    return sqrtPriceX64.mul(slippageTolerance.numerator).div(slippageTolerance.denominator);
  }

  private static calculateAmountAfterFees(amount: u64, feeRate: Percentage): BN {
    // TODO(atamari): Make sure ceiling here only rounds up the decimals after the scale decimals (eg: after 6th decimal for USDC)
    const fees = amount.mul(feeRate.numerator).div(feeRate.denominator);
    return amount.sub(fees);
  }

  private static calculateAmountWithFees(amount: u64, feeRate: Percentage): BN {
    const fees = amount.mul(feeRate.numerator).div(feeRate.denominator);
    return amount.add(fees);
  }

  private static calculateTokenADelta =
    (rounding: Rounding) =>
    (liquidity: u64, sqrtPriceLowerX64: BN, sqrtPriceUpperX64: BN): u64 => {
      return getTokenAFromLiquidity(
        liquidity,
        sqrtPriceLowerX64,
        sqrtPriceUpperX64,
        rounding == Rounding.Up ? true : false
      );
    };

  private static calculateTokenBDelta =
    (rounding: Rounding) =>
    (liquidity: u64, sqrtPriceLowerX64: BN, sqrtPriceUpperX64: BN): u64 => {
      return getTokenBFromLiquidity(
        liquidity,
        sqrtPriceLowerX64,
        sqrtPriceUpperX64,
        rounding == Rounding.Up ? true : false
      );
    };

  private static calculateSqrtPriceAtPrevInitializedTick(
    sqrtPriceLimitX64: BN,
    prevInitializedTickIndex: number,
    nextInitializedTickIndex: number
  ): BN {
    return BN.max(sqrtPriceLimitX64, tickIndexToSqrtPriceX64(prevInitializedTickIndex));
  }

  private static calculateSqrtPriceAtNextInitializedTick(
    sqrtPriceLimitX64: BN,
    prevInitializedTickIndex: number,
    nextInitializedTickIndex: number
  ): BN {
    return BN.min(sqrtPriceLimitX64, tickIndexToSqrtPriceX64(nextInitializedTickIndex));
  }

  private static calculateLowerSqrtPriceGivenTokenADelta(
    remainingTokenAAmountX0: BN,
    currentLiquidityX0: BN,
    currentSqrtPriceX64: BN
  ): BN {
    return getLowerSqrtPriceFromTokenA(
      remainingTokenAAmountX0,
      currentLiquidityX0,
      currentSqrtPriceX64
    );
  }

  private static calculateUpperSqrtPriceGivenTokenADelta(
    remainingTokenAAmountX0: u64,
    currentLiquidityX0: u64,
    currentSqrtPriceX64: BN
  ): BN {
    return getUpperSqrtPriceFromTokenA(
      remainingTokenAAmountX0,
      currentLiquidityX0,
      currentSqrtPriceX64
    );
  }

  private static calculateUpperSqrtPriceGivenTokenBDelta(
    remainingTokenBAmountX0: u64,
    currentLiquidityX0: u64,
    currentSqrtPriceX64: BN
  ): BN {
    return getLowerSqrtPriceFromTokenB(
      remainingTokenBAmountX0,
      currentLiquidityX0,
      currentSqrtPriceX64
    );
  }

  private static calculateLowerSqrtPriceGivenTokenBDelta(
    remainingTokenBAmountX0: u64,
    currentLiquidityX0: u64,
    currentSqrtPriceX64: BN
  ): BN {
    return getUpperSqrtPriceFromTokenB(
      remainingTokenBAmountX0,
      currentLiquidityX0,
      currentSqrtPriceX64
    );
  }

  private static calculateLowerSqrtPriceAfterSlippage(
    currentSqrtPriceX64: BN,
    slippageTolerance: Percentage
  ): BN {
    return currentSqrtPriceX64.sub(
      SwapSimulator.calculateSqrtPriceSlippage(currentSqrtPriceX64, slippageTolerance)
    );
  }

  private static calculateUpperSqrtPriceAfterSlippage(
    currentSqrtPriceX64: BN,
    slippageTolerance: Percentage
  ): BN {
    return currentSqrtPriceX64.add(
      SwapSimulator.calculateSqrtPriceSlippage(currentSqrtPriceX64, slippageTolerance)
    );
  }

  private static addNextTickLiquidityNet(
    currentLiquidity: u64,
    currentTickLiquidityNet: u64,
    nextTickLiquidityNet: u64
  ): u64 {
    return currentLiquidity.add(nextTickLiquidityNet);
  }

  private static subCurrentTickLiquidityNet(
    currentLiquidity: u64,
    currentTickLiquidityNet: u64,
    prevTickLiquidityNet: u64
  ): u64 {
    return currentLiquidity.sub(currentTickLiquidityNet);
  }

  private static readonly functionsBySwapDirection = {
    [SwapDirection.AtoB]: {
      // TODO: Account for edge case where we're at MIN_TICK
      // TODO: Account for moving between tick arrays (support one adjacent tick array to the left)
      calculateTargetSqrtPrice: SwapSimulator.calculateSqrtPriceAtPrevInitializedTick,
      calculateSqrtPriceLimit: SwapSimulator.calculateLowerSqrtPriceAfterSlippage,
      calculateNewLiquidity: SwapSimulator.subCurrentTickLiquidityNet,
      sqrtPriceWithinLimit: (sqrtPriceX64: BN, sqrtPriceLimitX64: BN) =>
        sqrtPriceX64.gt(sqrtPriceLimitX64),
    },
    [SwapDirection.BtoA]: {
      // TODO: Account for edge case where we're at MAX_TICK
      // TODO: Account for moving between tick arrays (support one adjacent tick array to the right)
      calculateTargetSqrtPrice: SwapSimulator.calculateSqrtPriceAtNextInitializedTick,
      calculateSqrtPriceLimit: SwapSimulator.calculateUpperSqrtPriceAfterSlippage,
      calculateNewLiquidity: SwapSimulator.addNextTickLiquidityNet,
      sqrtPriceWithinLimit: (sqrtPriceX64: BN, sqrtPriceLimitX64: BN) =>
        sqrtPriceX64.lt(sqrtPriceLimitX64),
    },
  };

  private static readonly functionsByAmountSpecified = {
    [AmountSpecified.Input]: {
      resolveInputAndOutputAmounts: (specifiedTokenAmount: u64, otherTokenAmount: u64) => [
        specifiedTokenAmount,
        otherTokenAmount,
      ],
      resolveSpecifiedAndOtherAmounts: (inputAmount: u64, outputAmount: u64) => [
        inputAmount,
        outputAmount,
      ],
    },
    [AmountSpecified.Output]: {
      resolveInputAndOutputAmounts: (specifiedTokenAmount: u64, otherTokenAmount: u64) => [
        otherTokenAmount,
        specifiedTokenAmount,
      ],
      resolveSpecifiedAndOtherAmounts: (inputAmount: u64, outputAmount: u64) => [
        outputAmount,
        inputAmount,
      ],
    },
  };

  private static readonly functionsBySwapType = {
    [SwapDirection.AtoB]: {
      [AmountSpecified.Input]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Up),
        calculateOtherTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Down),
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateLowerSqrtPriceGivenTokenADelta,
      },
      [AmountSpecified.Output]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Down),
        calculateOtherTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Up),
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateLowerSqrtPriceGivenTokenBDelta,
      },
    },
    [SwapDirection.BtoA]: {
      [AmountSpecified.Input]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Up),
        calculateOtherTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Down),
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateUpperSqrtPriceGivenTokenBDelta,
      },
      [AmountSpecified.Output]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Down),
        calculateOtherTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Up),
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateUpperSqrtPriceGivenTokenADelta,
      },
    },
  };
}
