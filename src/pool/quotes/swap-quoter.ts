import {
  fromX64,
  sqrtPriceX64ToTickIndex,
  tickIndexToSqrtPriceX64,
  toX64,
} from "@orca-so/whirlpool-client-sdk";
import { TickArrayData, TickData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { MintInfo } from "@solana/spl-token";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import { Percentage } from "../..";
import { DecimalUtil } from "../../utils/decimal-utils";

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
  fetchTickArray: (tickIndex: Decimal) => Promise<TickArrayData>;
  fetchTick: (tickIndex: Decimal) => Promise<TickData>;
  getPrevInitializedTickIndex: () => Promise<Decimal>;
  getNextInitializedTickIndex: () => Promise<Decimal>;
};

type SwapState = {
  sqrtPriceX64: Decimal;
  tickArray: TickArrayData;
  tickIndex: Decimal;
  liquidity: Decimal;
  specifiedAmountLeft: Decimal; // either the input remaining to be swapped or output remaining to be swapped for
  otherAmountCalculated: Decimal; // either the output of this swap or the input that needs to be swapped to receive the specified output
};

type SwapSimulationInput = {
  amount: Decimal;
  currentTickArray: TickArrayData;
  currentSqrtPriceX64: Decimal;
  currentTickIndex: Decimal;
  currentLiquidity: Decimal;
};

type SwapSimulationOutput = {
  sqrtPriceLimitX64: Decimal;
  amountIn: Decimal;
  amountOut: Decimal;
  sqrtPriceAfterSwapX64: Decimal;
};

type SwapStepSimulationInput = {
  sqrtPriceLimitX64: Decimal;
  tickArray: TickArrayData;
  sqrtPriceX64: Decimal;
  tickIndex: Decimal;
  liquidity: Decimal;
  amount: Decimal;
};

type SwapStepSimulationOutput = {
  currentTickIndex: Decimal;
  input: Decimal;
  output: Decimal;
};

const MIN_SQRT_PRICE_X64 = "4295048016";
const MAX_SQRT_PRICE_X64 = "79226673515401279992447579061";

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

    // const currentSqrtPriceX64 = tickIndexToSqrtPriceX64(new Decimal(currentTickIndex));
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
      otherAmountCalculated: new Decimal(0),
    };

    let tickArraysCrossed = 0;

    let i = 0;

    console.log(`SWAP STATE ${i}`, state);

    while (
      state.specifiedAmountLeft.gt(1e-10) &&
      sqrtPriceWithinLimit(currentSqrtPriceX64, sqrtPriceLimitX64)
    ) {
      const swapStepSimulationInput: SwapStepSimulationInput = {
        sqrtPriceLimitX64,
        sqrtPriceX64: state.sqrtPriceX64,
        amount: state.specifiedAmountLeft,
        tickArray: state.tickArray,
        tickIndex: state.tickIndex,
        liquidity: state.liquidity,
      };

      const swapStepSimulationOutput: SwapStepSimulationOutput = await this.simulateSwapStep(
        swapStepSimulationInput
      );

      const { input, output } = swapStepSimulationOutput;
      const [specifiedAmountUsed, otherAmountCalculated] = resolveSpecifiedAndOtherAmounts(
        input,
        output
      );

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

        state.tickIndex = nextTickIndex;
        state.sqrtPriceX64 = tickIndexToSqrtPriceX64(nextTickIndex);
        state.liquidity = calculateNewLiquidity(
          state.liquidity,
          DecimalUtil.fromU64(currentTick.liquidityNet),
          DecimalUtil.fromU64(nextTick.liquidityNet)
        );

        i += 1;

        if (currentTickArray.startTickIndex !== nextTickArray.startTickIndex) {
          tickArraysCrossed += 1;
        }

        if (tickArraysCrossed === MAX_TICK_ARRAY_CROSSINGS) {
          console.log(`SWAP STATE ${i}`, state);
          break;
        }
      }
      console.log(`SWAP STATE ${i}`, state);
    }

    const [inputAmount, outputAmount] = resolveInputAndOutputAmounts(
      specifiedAmount.sub(state.specifiedAmountLeft),
      state.otherAmountCalculated
    );

    return {
      sqrtPriceAfterSwapX64: state.sqrtPriceX64,
      amountIn: inputAmount,
      amountOut: outputAmount,
      sqrtPriceLimitX64,
    };
  }

  public async simulateSwapStep(input: SwapStepSimulationInput): Promise<SwapStepSimulationOutput> {
    console.log("START OF SWAP STEP");
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
      tickIndex: currentTickIndex,
      sqrtPriceX64: currentSqrtPriceX64,
      tickArray: currentTickArrayAccount,
      sqrtPriceLimitX64,
    } = input;

    // const currentSqrtPriceX64 = tickIndexToSqrtPriceX64(currentTickIndex);

    console.log("START MIDDLE OF SWAP STEP");

    // TODO(atamari): What do we do if next/prev initialized tick is more than one tick array account apart
    // Currently, if we're moving between ticks, we stop at the last tick on the adjacent tick array account (due to the whirlpool program limitation)
    const [prevInitializedTickIndex, nextInitializedTickIndex] = await Promise.all([
      getPrevInitializedTickIndex(),
      getNextInitializedTickIndex(),
    ]);

    console.log("MIDDLE MIDDLE MIDDLE OF SWAP STEP");

    const targetSqrtPriceX64 = calculateTargetSqrtPrice(
      sqrtPriceLimitX64,
      prevInitializedTickIndex,
      nextInitializedTickIndex
    );

    console.log("MIDDLE MIDDLE OF SWAP STEP");

    const specifiedTokenMaxDelta = calculateSpecifiedTokenDelta(
      currentLiquidity,
      Decimal.min(currentSqrtPriceX64, targetSqrtPriceX64),
      Decimal.max(currentSqrtPriceX64, targetSqrtPriceX64)
    );

    const specifiedTokenGivenDelta = SwapSimulator.calculateAmountAfterFees(
      specifiedTokenAmount,
      feeRate
    );

    console.log("MIDDLE OF SWAP STEP");

    const nextSqrtPriceX64 = specifiedTokenGivenDelta.gte(specifiedTokenMaxDelta)
      ? targetSqrtPriceX64 // Fully utilize liquidity till upcoming (next/prev depending on swap type) initialized tick
      : calculateNextSqrtPriceGivenTokenDelta(
          specifiedTokenGivenDelta,
          currentLiquidity,
          currentSqrtPriceX64
        );

    const otherTokenDelta = calculateOtherTokenDelta(
      currentLiquidity,
      Decimal.min(currentSqrtPriceX64, nextSqrtPriceX64),
      Decimal.max(currentSqrtPriceX64, nextSqrtPriceX64)
    );

    const specifiedTokenActualDelta = nextSqrtPriceX64.eq(targetSqrtPriceX64)
      ? specifiedTokenMaxDelta
      : calculateSpecifiedTokenDelta(
          currentLiquidity,
          Decimal.min(currentSqrtPriceX64, nextSqrtPriceX64),
          Decimal.max(currentSqrtPriceX64, nextSqrtPriceX64)
        );

    const [inputDelta, outputDelta] = resolveInputAndOutputAmounts(
      specifiedTokenActualDelta,
      otherTokenDelta
    );

    console.log("END OF SWAP STEP");

    return {
      currentTickIndex: sqrtPriceX64ToTickIndex(nextSqrtPriceX64),
      input: SwapSimulator.calculateAmountWithFees(inputDelta, feeRate),
      output: outputDelta,
    };
  }

  // ** UTILS **

  private static calculateSqrtPriceSlippage(
    sqrtPriceX64: Decimal,
    slippageTolerance: Percentage
  ): Decimal {
    // TODO(atamari): Not sure if this is correct since slippage tolerance is for price slippage not sqrtPrice slippage???
    return sqrtPriceX64
      .mul(slippageTolerance.numerator.toString())
      .div(slippageTolerance.denominator.toString());
  }

  private static calculateAmountAfterFees(amount: Decimal, feeRate: Percentage): Decimal {
    // TODO(atamari): Make sure ceiling here only rounds up the decimals after the scale decimals (eg: after 6th decimal for USDC)
    const fees = amount
      .mul(feeRate.numerator.toString())
      .div(feeRate.denominator.toString())
      .ceil();
    return amount.sub(fees);
  }

  private static calculateAmountWithFees(amount: Decimal, feeRate: Percentage): Decimal {
    const fees = amount
      .mul(feeRate.numerator.toString())
      .div(feeRate.denominator.toString())
      .ceil();
    return amount.add(fees);
  }

  private static calculateTokenADelta =
    (rounding: Rounding) =>
    (liquidity: Decimal, sqrtPriceLowerX64: Decimal, sqrtPriceUpperX64: Decimal): Decimal => {
      // Use eq 6.16 from univ3 whitepaper to find deltaA
      // ΔX = Δ(1/√P)·L => deltaA = (1/sqrt(lower) - 1/sqrt(upper)) * state.currLiquidity
      // => deltaA = ((sqrt(upper) - sqrt(lower)) / (sqrt(lower) * sqrt(upper))) * state.currLiquidity
      // => deltaA = (state.currLiquidity * (sqrt(upper) - sqrt(lower))) / (sqrt(upper) * sqrt(lower))
      // Precision analysis: (x0 * (x64 - x64)) / (x64 * x64)
      const numeratorX64 = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));
      const denominatorX128 = sqrtPriceUpperX64.mul(sqrtPriceLowerX64);
      const denominatorX64 = denominatorX128.div(new Decimal(2).pow(64));
      const tokenADelta = numeratorX64.div(denominatorX64);

      // Using regular div and not BN utils since the result is not an X64
      return rounding === Rounding.Down ? tokenADelta.floor() : tokenADelta.ceil();
    };

  private static calculateTokenBDelta =
    (rounding: Rounding) =>
    (liquidity: Decimal, sqrtPriceLowerX64: Decimal, sqrtPriceUpperX64: Decimal): Decimal => {
      // Use eq 6.14 from univ3 whitepaper: ΔY = ΔP·L => deltaB = (sqrt(upper) - sqrt(lower)) * liquidity
      // Analyzing the precisions here: (X64 - X64) * X0 => X64
      // We need to shave off decimal part since we need to return an X0 for token amount
      const tokenBDeltaX64 = sqrtPriceUpperX64.sub(sqrtPriceLowerX64).mul(liquidity);

      return rounding === Rounding.Down
        ? fromX64(tokenBDeltaX64.floor())
        : fromX64(tokenBDeltaX64.ceil());
    };

  private static calculateSqrtPriceAtPrevInitializedTick(
    sqrtPriceLimitX64: Decimal,
    prevInitializedTickIndex: Decimal,
    nextInitializedTickIndex: Decimal
  ): Decimal {
    return Decimal.max(sqrtPriceLimitX64, tickIndexToSqrtPriceX64(prevInitializedTickIndex));
  }

  private static calculateSqrtPriceAtNextInitializedTick(
    sqrtPriceLimitX64: Decimal,
    prevInitializedTickIndex: Decimal,
    nextInitializedTickIndex: Decimal
  ): Decimal {
    return Decimal.min(sqrtPriceLimitX64, tickIndexToSqrtPriceX64(nextInitializedTickIndex));
  }

  // TODO: Account for rounding
  private static calculateLowerSqrtPriceGivenTokenADelta(
    remainingTokenAAmountX0: Decimal,
    currentLiquidityX0: Decimal,
    currentSqrtPriceX64: Decimal
  ): Decimal {
    // To compute this, we use eq 6.15 from univ3 whitepaper:
    // Δ(1/√P) = ΔX/L => 1/sqrt(lower) - 1/sqrt(upper) = tokenAToSwap/state.currLiquidity
    // What we're trying to find here is actually sqrt(lower) , so let's solve for that:
    //  => 1/sqrt(lower) = tokenAToSwap/state.currLiquidity + 1/sqrt(upper)
    //  => 1/sqrt(lower) = (tokenAToSwap*sqrt(upper) + state.currLiquidity) / (state.currLiquidity * sqrt(upper))
    //  => sqrt(lower) = (state.currLiquidity * sqrt(upper)) / (tokenAToSwap*sqrt(upper) + state.currLiquidity)
    // Precision analysis: (u64 * q64.64) / (u64 * q64.64 + u64)
    const numeratorX64 = currentLiquidityX0.mul(currentSqrtPriceX64);
    const denominatorX64 = remainingTokenAAmountX0
      .mul(currentSqrtPriceX64)
      .add(toX64(currentLiquidityX0));
    const lowerSqrtPriceX0 = numeratorX64.div(denominatorX64);

    return lowerSqrtPriceX0.floor();
  }

  // TODO: Account for rounding
  private static calculateUpperSqrtPriceGivenTokenADelta(
    remainingTokenAAmountX0: Decimal,
    currentLiquidityX0: Decimal,
    currentSqrtPriceX64: Decimal
  ): Decimal {
    // To compute this, we use eq 6.15 from univ3 whitepaper:
    // Δ(1/√P) = ΔX/L => 1/sqrt(lower) - 1/sqrt(upper) = remainingAToWithdraw/state.currLiquidity
    // What we're trying to find here is actually sqrt(upper) , so let's solve for that:
    //  => 1/sqrt(upper) =  1/sqrt(lower) - remainingAToWithdraw/state.currLiquidity
    //  => sqrt(upper) =  (state.currLiquidity * sqrt(lower)) / (state.currLiquidity - sqrt(lower)*remainingAToWithdraw)
    // Precision analysis raw: (u64 * q64.64) / (u64 - q64.64 * u64)
    const numeratorX64 = currentLiquidityX0.mul(currentSqrtPriceX64);
    const denominatorX64 = toX64(currentLiquidityX0).sub(
      currentSqrtPriceX64.mul(remainingTokenAAmountX0)
    );
    const upperSqrtPriceX0 = numeratorX64.div(denominatorX64);

    return toX64(upperSqrtPriceX0);
  }

  // TODO: Account for rounding
  private static calculateUpperSqrtPriceGivenTokenBDelta(
    remainingTokenBAmountX0: Decimal,
    currentLiquidityX0: Decimal,
    currentSqrtPriceX64: Decimal
  ): Decimal {
    // To compute this, we use eq 6.13 from univ3 whitepaper:
    // Δ√P = ΔY/L => sqrt(upper) - sqrt(lower) = remainingBToSwap / state.currLiquidity
    // What we're trying to find here is actually sqrt(upper) , so let's solve for that:
    //  => sqrt(upper) = (remainingBToSwap / state.currLiquidity) + sqrt(lower)
    // Precision analysis: (q64.0 / q64.0) + q64.64
    return toX64(remainingTokenBAmountX0).div(currentLiquidityX0).add(currentSqrtPriceX64);
  }

  // TODO: Account for rounding
  private static calculateLowerSqrtPriceGivenTokenBDelta(
    remainingTokenBAmountX0: Decimal,
    currentLiquidityX0: Decimal,
    currentSqrtPriceX64: Decimal
  ): Decimal {
    // To compute this, we use eq 6.13 from univ3 whitepaper:
    // Δ√P = ΔY/L => sqrt(upper) - sqrt(lower) = remainingBToWithdraw / state.currLiquidity
    // What we're trying to find here is actually sqrt(lower) since we're removing B from the pool, so let's solve for that:
    //  => sqrt(lower) = sqrt(upper) - (remainingBToWitdhraw / state.currLiquidity)
    // Precision analysis: q64.64 - (q64.0 / q64.0)
    return currentSqrtPriceX64.sub(toX64(remainingTokenBAmountX0).div(currentLiquidityX0));
  }

  private static calculateLowerSqrtPriceAfterSlippage(
    currentSqrtPriceX64: Decimal,
    slippageTolerance: Percentage
  ): Decimal {
    return currentSqrtPriceX64.sub(
      SwapSimulator.calculateSqrtPriceSlippage(currentSqrtPriceX64, slippageTolerance)
    );
  }

  private static calculateUpperSqrtPriceAfterSlippage(
    currentSqrtPriceX64: Decimal,
    slippageTolerance: Percentage
  ): Decimal {
    return currentSqrtPriceX64.add(
      SwapSimulator.calculateSqrtPriceSlippage(currentSqrtPriceX64, slippageTolerance)
    );
  }

  private static addNextTickLiquidityNet(
    currentLiquidity: Decimal,
    currentTickLiquidityNet: Decimal,
    nextTickLiquidityNet: Decimal
  ): Decimal {
    return currentLiquidity.add(nextTickLiquidityNet);
  }

  private static subCurrentTickLiquidityNet(
    currentLiquidity: Decimal,
    currentTickLiquidityNet: Decimal,
    prevTickLiquidityNet: Decimal
  ): Decimal {
    return currentLiquidity.sub(currentTickLiquidityNet);
  }

  private static readonly functionsBySwapDirection = {
    [SwapDirection.AtoB]: {
      // TODO: Account for edge case where we're at MIN_TICK
      // TODO: Account for moving between tick arrays (support one adjacent tick array to the left)
      calculateTargetSqrtPrice: SwapSimulator.calculateSqrtPriceAtPrevInitializedTick,
      calculateSqrtPriceLimit: SwapSimulator.calculateLowerSqrtPriceAfterSlippage,
      calculateNewLiquidity: SwapSimulator.subCurrentTickLiquidityNet,
      sqrtPriceWithinLimit: (sqrtPriceX64: Decimal, sqrtPriceLimitX64: Decimal) =>
        sqrtPriceX64 > sqrtPriceLimitX64,
    },
    [SwapDirection.BtoA]: {
      // TODO: Account for edge case where we're at MAX_TICK
      // TODO: Account for moving between tick arrays (support one adjacent tick array to the right)
      calculateTargetSqrtPrice: SwapSimulator.calculateSqrtPriceAtNextInitializedTick,
      calculateSqrtPriceLimit: SwapSimulator.calculateUpperSqrtPriceAfterSlippage,
      calculateNewLiquidity: SwapSimulator.addNextTickLiquidityNet,
      sqrtPriceWithinLimit: (sqrtPriceX64: Decimal, sqrtPriceLimitX64: Decimal) =>
        sqrtPriceX64 < sqrtPriceLimitX64,
    },
  };

  private static readonly functionsByAmountSpecified = {
    [AmountSpecified.Input]: {
      resolveInputAndOutputAmounts: (specifiedTokenAmount: Decimal, otherTokenAmount: Decimal) => [
        specifiedTokenAmount,
        otherTokenAmount,
      ],
      resolveSpecifiedAndOtherAmounts: (inputAmount: Decimal, outputAmount: Decimal) => [
        inputAmount,
        outputAmount,
      ],
    },
    [AmountSpecified.Output]: {
      resolveInputAndOutputAmounts: (specifiedTokenAmount: Decimal, otherTokenAmount: Decimal) => [
        otherTokenAmount,
        specifiedTokenAmount,
      ],
      resolveSpecifiedAndOtherAmounts: (inputAmount: Decimal, outputAmount: Decimal) => [
        outputAmount,
        inputAmount,
      ],
    },
  };

  private static readonly functionsBySwapType = {
    [SwapDirection.AtoB]: {
      [AmountSpecified.Input]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Up),
        calculateOtherTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Down), // Is the rounding correct?
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateLowerSqrtPriceGivenTokenADelta,
      },
      [AmountSpecified.Output]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Down),
        calculateOtherTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Up), // Is the rounding correct?
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateLowerSqrtPriceGivenTokenBDelta,
      },
    },
    [SwapDirection.BtoA]: {
      [AmountSpecified.Input]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Up),
        calculateOtherTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Down), // Is the rounding correct?
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateUpperSqrtPriceGivenTokenBDelta,
      },
      [AmountSpecified.Output]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Down),
        calculateOtherTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Up), // Is the rounding correct?
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateUpperSqrtPriceGivenTokenADelta,
      },
    },
  };
}
