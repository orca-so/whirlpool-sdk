import { sqrtPriceX64ToTickIndex, tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { TickArrayData, TickData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { Percentage } from "../..";

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
  getPrevInitializedTickIndex: (currentTickIndex: number) => Promise<number>;
  getNextInitializedTickIndex: (currentTickIndex: number) => Promise<number>;
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
};

type SwapStepSimulationOutput = {
  currentTickIndex: number;
  input: u64;
  output: u64;
};

const MIN_SQRT_PRICE_X64 = new BN("4295048016");
const MAX_SQRT_PRICE_X64 = new BN("79226673515401819039153162598");

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
      otherAmountCalculated: new u64(0),
    };

    let tickArraysCrossed = 0;

    let i = 0;

    let loopCount = 0;

    while (
      // state.specifiedAmountLeft.gt(new BN("2529369")) &&
      state.specifiedAmountLeft.gt(new BN(0)) &&
      // loopCount < 3 &&
      sqrtPriceWithinLimit(currentSqrtPriceX64, sqrtPriceLimitX64)
    ) {
      console.log("ITERATION " + loopCount);
      loopCount += 1;
      console.log("SWAP STATE", {
        sqrtPriceX64: state.sqrtPriceX64.toString(),
        tickIndex: state.tickIndex,
        tickArray: state.tickArray.startTickIndex,
        liquidity: state.liquidity.toString(),
        specifiedAmountLeft: state.specifiedAmountLeft.toString(),
        otherAmountCalculated: state.otherAmountCalculated.toString(),
      });
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
          currentTick.liquidityNet,
          nextTick.liquidityNet
        );

        i += 1;

        if (currentTickArray.startTickIndex !== nextTickArray.startTickIndex) {
          tickArraysCrossed += 1;
        }

        if (tickArraysCrossed === MAX_TICK_ARRAY_CROSSINGS) {
          break;
        }
      }
      console.log("SWAP STATE", {
        sqrtPriceX64: state.sqrtPriceX64.toString(),
        tickIndex: state.tickIndex,
        tickArray: state.tickArray.startTickIndex,
        liquidity: state.liquidity.toString(),
        specifiedAmountLeft: state.specifiedAmountLeft.toString(),
        otherAmountCalculated: state.otherAmountCalculated.toString(),
      });
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

    // TODO(atamari): What do we do if next/prev initialized tick is more than one tick array account apart
    // Currently, if we're moving between ticks, we stop at the last tick on the adjacent tick array account (due to the whirlpool program limitation)
    const [prevInitializedTickIndex, nextInitializedTickIndex] = await Promise.all([
      getPrevInitializedTickIndex(input.tickIndex),
      getNextInitializedTickIndex(input.tickIndex),
    ]);

    const targetSqrtPriceX64 = calculateTargetSqrtPrice(
      sqrtPriceLimitX64,
      prevInitializedTickIndex,
      nextInitializedTickIndex
    );

    console.log("SQRT PRICE LIMIT", {
      targetSqrtPriceX64: sqrtPriceLimitX64.toString(),
    });

    console.log("NEXT INITIALIZED TICK", {
      nextInitializedTickIndex: nextInitializedTickIndex,
    });

    const specifiedTokenMaxDelta = calculateSpecifiedTokenDelta(
      currentLiquidity,
      BN.min(currentSqrtPriceX64, targetSqrtPriceX64),
      BN.max(currentSqrtPriceX64, targetSqrtPriceX64)
    );

    const specifiedTokenGivenDelta = SwapSimulator.calculateAmountAfterFees(
      specifiedTokenAmount,
      feeRate
    );

    console.log("TARGET SQRT PRICE", {
      targetSqrtPriceX64: targetSqrtPriceX64.toString(),
    });
    const nextSqrtPriceX64 = specifiedTokenGivenDelta.gte(specifiedTokenMaxDelta)
      ? targetSqrtPriceX64 // Fully utilize liquidity till upcoming (next/prev depending on swap type) initialized tick
      : calculateNextSqrtPriceGivenTokenDelta(
          specifiedTokenGivenDelta,
          currentLiquidity,
          currentSqrtPriceX64
        );

    console.log("SWAP TYPE", {
      swapDirection: swapDirection,
      amountSpecified: amountSpecified,
    });

    const otherTokenDelta = calculateOtherTokenDelta(
      currentLiquidity,
      BN.min(currentSqrtPriceX64, nextSqrtPriceX64),
      BN.max(currentSqrtPriceX64, nextSqrtPriceX64)
    );

    console.log("OTHER TOKEN DELTA", {
      otherTokenDelta: otherTokenDelta.toString(),
      currentLiquidity: currentLiquidity.toString(),
      currentSqrtPriceX64: currentSqrtPriceX64.toString(),
      nextSqrtPriceX64: nextSqrtPriceX64.toString(),
    });

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

    console.log("FINISHING SWAP STEP");

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
      // Use eq 6.16 from univ3 whitepaper to find deltaA
      // ΔX = Δ(1/√P)·L => deltaA = (1/sqrt(lower) - 1/sqrt(upper)) * state.currLiquidity
      // => deltaA = ((sqrt(upper) - sqrt(lower)) / (sqrt(lower) * sqrt(upper))) * state.currLiquidity
      // => deltaA = (state.currLiquidity * (sqrt(upper) - sqrt(lower))) / (sqrt(upper) * sqrt(lower))
      // Precision analysis: (x0 * (x64 - x64)) / (x64 * x64)
      const numeratorX64 = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));
      const denominatorX64 = sqrtPriceUpperX64.mul(sqrtPriceLowerX64).shrn(64);
      const tokenADelta = numeratorX64.div(denominatorX64);

      if (rounding === Rounding.Up) {
        return new u64(tokenADelta.add(new BN(1)));
      }

      return new u64(tokenADelta);
    };

  private static calculateTokenBDelta =
    (rounding: Rounding) =>
    (liquidity: u64, sqrtPriceLowerX64: BN, sqrtPriceUpperX64: BN): u64 => {
      // Use eq 6.14 from univ3 whitepaper: ΔY = ΔP·L => deltaB = (sqrt(upper) - sqrt(lower)) * liquidity
      // Analyzing the precisions here: (X64 - X64) * X0 => X64
      // We need to shave off decimal part since we need to return an X0 for token amount
      const tokenBDeltaX64 = sqrtPriceUpperX64.sub(sqrtPriceLowerX64).mul(liquidity);

      if (rounding === Rounding.Up) {
        return new u64(tokenBDeltaX64.shrn(64).add(new BN(1)));
      }

      return new u64(tokenBDeltaX64.shrn(64));
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

  // TODO: Account for rounding
  private static calculateLowerSqrtPriceGivenTokenADelta(
    remainingTokenAAmountX0: u64,
    currentLiquidityX0: u64,
    currentSqrtPriceX64: BN
  ): u64 {
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
      .add(currentLiquidityX0.shln(64));
    const lowerSqrtPriceX0 = numeratorX64.div(denominatorX64);

    return lowerSqrtPriceX0;
  }

  // TODO: Account for rounding
  private static calculateUpperSqrtPriceGivenTokenADelta(
    remainingTokenAAmountX0: u64,
    currentLiquidityX0: u64,
    currentSqrtPriceX64: BN
  ): BN {
    // To compute this, we use eq 6.15 from univ3 whitepaper:
    // Δ(1/√P) = ΔX/L => 1/sqrt(lower) - 1/sqrt(upper) = remainingAToWithdraw/state.currLiquidity
    // What we're trying to find here is actually sqrt(upper) , so let's solve for that:
    //  => 1/sqrt(upper) =  1/sqrt(lower) - remainingAToWithdraw/state.currLiquidity
    //  => sqrt(upper) =  (state.currLiquidity * sqrt(lower)) / (state.currLiquidity - sqrt(lower)*remainingAToWithdraw)
    // Precision analysis raw: (u64 * q64.64) / (u64 - q64.64 * u64)
    const numeratorX64 = currentLiquidityX0.mul(currentSqrtPriceX64);
    const denominatorX64 = currentLiquidityX0
      .shln(64)
      .sub(currentSqrtPriceX64.mul(remainingTokenAAmountX0));
    const upperSqrtPriceX0 = numeratorX64.div(denominatorX64);

    return upperSqrtPriceX0;
  }

  // TODO: Account for rounding
  private static calculateUpperSqrtPriceGivenTokenBDelta(
    remainingTokenBAmountX0: u64,
    currentLiquidityX0: u64,
    currentSqrtPriceX64: BN
  ): BN {
    // To compute this, we use eq 6.13 from univ3 whitepaper:
    // Δ√P = ΔY/L => sqrt(upper) - sqrt(lower) = remainingBToSwap / state.currLiquidity
    // What we're trying to find here is actually sqrt(upper) , so let's solve for that:
    //  => sqrt(upper) = (remainingBToSwap / state.currLiquidity) + sqrt(lower)
    // Precision analysis: (q64.0 / q64.0) + q64.64
    return remainingTokenBAmountX0.shln(64).div(currentLiquidityX0).add(currentSqrtPriceX64);
  }

  // TODO: Account for rounding
  private static calculateLowerSqrtPriceGivenTokenBDelta(
    remainingTokenBAmountX0: u64,
    currentLiquidityX0: u64,
    currentSqrtPriceX64: BN
  ): BN {
    // To compute this, we use eq 6.13 from univ3 whitepaper:
    // Δ√P = ΔY/L => sqrt(upper) - sqrt(lower) = remainingBToWithdraw / state.currLiquidity
    // What we're trying to find here is actually sqrt(lower) since we're removing B from the pool, so let's solve for that:
    //  => sqrt(lower) = sqrt(upper) - (remainingBToWitdhraw / state.currLiquidity)
    // Precision analysis: q64.64 - (q64.0 / q64.0)
    return currentSqrtPriceX64.sub(remainingTokenBAmountX0.div(currentLiquidityX0).shln(64));
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
