import BN from "bn.js";
import invariant from "tiny-invariant";
import { Percentage } from "../..";
import { TickArrayAccount } from "../../public/accounts";
import { TickArrayEntity } from "../entities";
import { BNUtils, TickMath, Token, TokenAmount } from "../utils";
import { xor } from "../utils/misc/boolean";

// Temporary utils
// TODO: Delete after implementation
function TODO(message: string): never {
  throw new Error(`TODO: ${message}`);
}

// TODO: Set this to the correct value and move it somewhere else
const DEFAULT_SLIPPAGE_TOLERANCE = Percentage.fromFraction(1, 1e4);

enum SwapDirection {
  AtoB = "Swap A to B",
  BtoA = "Swap B to A",
}

enum AmountSpecified {
  Input = "Specified input amount",
  Output = "Specified output amount",
}

enum Rounding {
  Up,
  Down,
}

type SwapSimulatorConfig<A extends Token, B extends Token> = {
  tokenA: A;
  tokenB: B;
  swapDirection: SwapDirection;
  amountSpecified: AmountSpecified;
  feeRate: Percentage;
  protocolFeeRate: Percentage;
  slippageTolerance: Percentage;
};

type SwapState = {
  sqrtPriceX64: BN;
  tickArray: TickArrayAccount;
  tickIndex: number;
  liquidity: BN;
  specifiedAmountLeft: BN; // either the input remaining to be swapped or output remaining to be swapped for
  otherAmountCalculated: BN; // either the output of this swap or the input that needs to be swapped to receive the specified output
};

type SwapSimulationInput = {
  amount: BN;
  currentTickArray: TickArrayAccount;
  currentTickIndex: number;
  currentLiquidity: BN;
};

type SwapSimulationOutput = {
  sqrtPriceLimitX64: BN;
  amountIn: BN;
  amountOutMinimum: BN;
  sqrtPriceAfterSwapX64: BN;
};

type SwapStepSimulationInput = {
  sqrtPriceLimitX64: BN;
  tickArray: TickArrayAccount;
  tickIndex: number;
  liquidity: BN;
  amount: BN;
};

type SwapStepSimulationOutput = {
  currentTickIndex: number;
  input: BN;
  output: BN;
};

class SwapSimulator<A extends Token, B extends Token> {
  private readonly config: SwapSimulatorConfig<A, B>;

  public constructor(config: SwapSimulatorConfig<A, B>) {
    this.config = config;
  }

  // ** METHODS **

  public async simulateSwap(input: SwapSimulationInput): Promise<SwapSimulationOutput> {
    const { swapDirection, slippageTolerance } = this.config;
    const { calculateSqrtPriceLimit } = SwapSimulator.functionsBySwapDirection[swapDirection];

    const { currentTickIndex, currentTickArray, currentLiquidity, amount: specifiedAmount } = input;

    const currentSqrtPriceX64 = TickMath.sqrtPriceAtTick(currentTickIndex);
    const sqrtPriceLimitX64 = calculateSqrtPriceLimit(currentSqrtPriceX64, slippageTolerance);

    const state: SwapState = {
      sqrtPriceX64: currentSqrtPriceX64,
      tickIndex: currentTickIndex,
      tickArray: currentTickArray,
      liquidity: currentLiquidity,
      specifiedAmountLeft: specifiedAmount,
      otherAmountCalculated: new BN(0),
    };

    while (state.specifiedAmountLeft.gt(new BN(0)) && !state.sqrtPriceX64.eq(sqrtPriceLimitX64)) {
      const swapStepSimulationInput: SwapStepSimulationInput = {
        sqrtPriceLimitX64,
        amount: state.specifiedAmountLeft,
        tickArray: state.tickArray,
        tickIndex: state.tickIndex,
        liquidity: state.liquidity,
      };

      const swapStepSimulationOutput: SwapStepSimulationOutput =
        this.simulateSwapStep(swapStepSimulationInput);

      if (swapStepSimulationOutput.currentTickIndex !== state.tickIndex) {
        state.tickIndex = swapStepSimulationOutput.currentTickIndex;
      }
    }
  }

  public async simulateSwapStep(input: SwapStepSimulationInput): Promise<SwapStepSimulationOutput> {
    const { swapDirection, amountSpecified, feeRate } = this.config;
    const { calculateTargetSqrtPrice } = SwapSimulator.functionsBySwapDirection[swapDirection];
    const { resolveInputAndOutputDeltas } =
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
      tickArray: currentTickArrayAccount,
      sqrtPriceLimitX64,
    } = input;

    const currentSqrtPriceX64 = TickMath.sqrtPriceAtTick(currentTickIndex);

    // TODO: This function call throws an error if targetSqrtPrice is in another tick array, so handle that here
    const targetSqrtPriceX64 = calculateTargetSqrtPrice(
      currentTickArrayAccount,
      currentTickIndex,
      sqrtPriceLimitX64
    );

    const specifiedTokenMaxDelta = calculateSpecifiedTokenDelta(
      currentLiquidity,
      BN.min(currentSqrtPriceX64, targetSqrtPriceX64),
      BN.max(currentSqrtPriceX64, targetSqrtPriceX64)
    );

    const specifiedTokenGivenDelta = SwapSimulator.calculateAmountAfterFees(
      specifiedTokenAmount,
      feeRate
    );

    const nextSqrtPriceX64 = specifiedTokenGivenDelta.gte(specifiedTokenMaxDelta)
      ? targetSqrtPriceX64 // Fully utilize liquidity till upcoming (next/prev depending on swap type) initialized tick
      : calculateNextSqrtPriceGivenTokenDelta(
          specifiedTokenGivenDelta,
          currentLiquidity,
          currentSqrtPriceX64
        );

    const needToMoveToNextInitializedTick = nextSqrtPriceX64.eq(targetSqrtPriceX64);

    const otherTokenDelta = calculateOtherTokenDelta(
      currentLiquidity,
      BN.min(currentSqrtPriceX64, nextSqrtPriceX64),
      BN.max(currentSqrtPriceX64, nextSqrtPriceX64)
    );

    const specifiedTokenActualDelta = needToMoveToNextInitializedTick
      ? specifiedTokenMaxDelta
      : calculateSpecifiedTokenDelta(
          currentLiquidity,
          BN.min(currentSqrtPriceX64, nextSqrtPriceX64),
          BN.max(currentSqrtPriceX64, nextSqrtPriceX64)
        );

    const [inputDelta, outputDelta] = resolveInputAndOutputDeltas(
      specifiedTokenActualDelta,
      otherTokenDelta
    );

    return {
      currentTickIndex: TickMath.tickAtSqrtPrice(nextSqrtPriceX64),
      input: inputDelta,
      output: outputDelta,
    };
  }

  // ** UTILS **

  private static calculateSqrtPriceSlippage(sqrtPriceX64: BN, slippageTolerance: Percentage): BN {
    // TODO: Not sure if this is correct since slippage tolerance is for price slippage not sqrtPrice slippage???
    return sqrtPriceX64.mul(slippageTolerance.numerator).div(slippageTolerance.denominator);
  }

  private static calculateAmountAfterFees(amount: BN, feeRate: Percentage): BN {
    const fees = amount.mul(feeRate.numerator).divRound(feeRate.denominator);
    return amount.sub(fees);
  }

  private static calculateTokenADelta =
    (rounding: Rounding) =>
    (liquidity: BN, sqrtPriceLowerX64: BN, sqrtPriceUpperX64: BN): BN => {
      // Use eq 6.16 from univ3 whitepaper to find deltaA
      // ΔX = Δ(1/√P)·L => deltaA = (1/sqrt(lower) - 1/sqrt(upper)) * state.currLiquidity
      // => deltaA = ((sqrt(upper) - sqrt(lower)) / (sqrt(lower) * sqrt(upper))) * state.currLiquidity
      // => deltaA = (state.currLiquidity * (sqrt(upper) - sqrt(lower))) / (sqrt(upper) * sqrt(lower))
      // Precision analysis: (x0 * (x64 - x64)) / (x64 * x64)
      const numeratorX64 = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));
      const denominatorX64 = BNUtils.mulX64(sqrtPriceUpperX64, sqrtPriceLowerX64);

      // Using regular div and not BN utils since the result is not an X64
      return rounding === Rounding.Down
        ? numeratorX64.div(denominatorX64)
        : numeratorX64.divRound(denominatorX64);
    };

  private static calculateTokenBDelta =
    (rounding: Rounding) =>
    (liquidity: BN, sqrtPriceLowerX64: BN, sqrtPriceUpperX64: BN): BN => {
      // Use eq 6.14 from univ3 whitepaper: ΔY = ΔP·L => deltaB = (sqrt(upper) - sqrt(lower)) * liquidity
      // Analyzing the precisions here: (X64 - X64) * X0 => X64
      // We need to shave off decimal part since we need to return an X0 for token amount
      const tokenBDeltaX64 = sqrtPriceUpperX64.sub(sqrtPriceLowerX64).mul(liquidity);

      return rounding === Rounding.Down
        ? BNUtils.x64ToX0Floor(tokenBDeltaX64)
        : BNUtils.x64ToX0Ceil(tokenBDeltaX64);
    };

  private static calculateSqrtPriceAtPrevInitializedTick(
    currentTickArrayAccount: TickArrayAccount,
    currentTickIndex: number,
    sqrtPriceLimitX64: BN
  ): BN {
    return BN.max(
      sqrtPriceLimitX64,
      TickMath.sqrtPriceAtTick(
        TickArrayEntity.getPrevInitializedTickIndex(currentTickArrayAccount, currentTickIndex)
      )
    );
  }

  private static calculateSqrtPriceAtNextInitializedTick(
    currentTickArrayAccount: TickArrayAccount,
    currentTickIndex: number,
    sqrtPriceLimitX64: BN
  ): BN {
    return BN.min(
      sqrtPriceLimitX64,
      TickMath.sqrtPriceAtTick(
        TickArrayEntity.getNextInitializedTickIndex(currentTickArrayAccount, currentTickIndex)
      )
    );
  }

  // TODO: Account for rounding
  private static calculateLowerSqrtPriceGivenTokenADelta(
    remainingTokenAAmountX0: BN,
    currentLiquidityX0: BN,
    currentSqrtPriceX64: BN
  ): BN {
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
      .add(BNUtils.x0ToX64(currentLiquidityX0));

    return BNUtils.divX64(numeratorX64, denominatorX64);
  }

  // TODO: Account for rounding
  private static calculateUpperSqrtPriceGivenTokenADelta(
    remainingTokenAAmountX0: BN,
    currentLiquidityX0: BN,
    currentSqrtPriceX64: BN
  ): BN {
    // To compute this, we use eq 6.15 from univ3 whitepaper:
    // Δ(1/√P) = ΔX/L => 1/sqrt(lower) - 1/sqrt(upper) = remainingAToWithdraw/state.currLiquidity
    // What we're trying to find here is actually sqrt(upper) , so let's solve for that:
    //  => 1/sqrt(upper) =  1/sqrt(lower) - remainingAToWithdraw/state.currLiquidity
    //  => sqrt(upper) =  (state.currLiquidity * sqrt(lower)) / (state.currLiquidity - sqrt(lower)*remainingAToWithdraw)
    // Precision analysis raw: (u64 * q64.64) / (u64 - q64.64 * u64)
    const numeratorX64 = currentLiquidityX0.mul(currentSqrtPriceX64);
    const denominatorX64 = BNUtils.x0ToX64(currentLiquidityX0).sub(
      currentSqrtPriceX64.mul(remainingTokenAAmountX0)
    );

    return BNUtils.divX64(numeratorX64, denominatorX64);
  }

  // TODO: Account for rounding
  private static calculateUpperSqrtPriceGivenTokenBDelta(
    remainingTokenBAmountX0: BN,
    currentLiquidityX0: BN,
    currentSqrtPriceX64: BN
  ): BN {
    // To compute this, we use eq 6.13 from univ3 whitepaper:
    // Δ√P = ΔY/L => sqrt(upper) - sqrt(lower) = remainingBToSwap / state.currLiquidity
    // What we're trying to find here is actually sqrt(upper) , so let's solve for that:
    //  => sqrt(upper) = (remainingBToSwap / state.currLiquidity) + sqrt(lower)
    // Precision analysis: (q64.0 / q64.0) + q64.64
    return BNUtils.x0ToX64(remainingTokenBAmountX0)
      .div(currentLiquidityX0)
      .add(currentSqrtPriceX64);
  }

  // TODO: Account for rounding
  private static calculateLowerSqrtPriceGivenTokenBDelta(
    remainingTokenBAmountX0: BN,
    currentLiquidityX0: BN,
    currentSqrtPriceX64: BN
  ): BN {
    // To compute this, we use eq 6.13 from univ3 whitepaper:
    // Δ√P = ΔY/L => sqrt(upper) - sqrt(lower) = remainingBToWithdraw / state.currLiquidity
    // What we're trying to find here is actually sqrt(lower) since we're removing B from the pool, so let's solve for that:
    //  => sqrt(lower) = sqrt(upper) - (remainingBToWitdhraw / state.currLiquidity)
    // Precision analysis: q64.64 - (q64.0 / q64.0)
    return currentSqrtPriceX64.sub(
      BNUtils.x0ToX64(remainingTokenBAmountX0).div(currentLiquidityX0)
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

  private static readonly functionsBySwapDirection = {
    [SwapDirection.AtoB]: {
      // TODO: Account for edge case where we're at MIN_TICK
      // TODO: Account for moving between tick arrays (support one adjacent tick array to the left)
      calculateTargetSqrtPrice: SwapSimulator.calculateSqrtPriceAtPrevInitializedTick,
      calculateSqrtPriceLimit: SwapSimulator.calculateLowerSqrtPriceAfterSlippage,
    },
    [SwapDirection.BtoA]: {
      // TODO: Account for edge case where we're at MAX_TICK
      // TODO: Account for moving between tick arrays (support one adjacent tick array to the right)
      calculateTargetSqrtPrice: SwapSimulator.calculateSqrtPriceAtNextInitializedTick,
      calculateSqrtPriceLimit: SwapSimulator.calculateUpperSqrtPriceAfterSlippage,
    },
  };

  private static readonly functionsByAmountSpecified = {
    [AmountSpecified.Input]: {
      resolveInputAndOutputDeltas: (specifiedTokenDelta: BN, otherTokenDelta: BN) => [
        specifiedTokenDelta,
        otherTokenDelta,
      ],
    },
    [AmountSpecified.Output]: {
      resolveInputAndOutputDeltas: (specifiedTokenDelta: BN, otherTokenDelta: BN) => [
        otherTokenDelta,
        specifiedTokenDelta,
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
