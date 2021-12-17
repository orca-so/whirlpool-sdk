import BN from "bn.js";
import invariant from "tiny-invariant";
import { Percentage } from "../..";
import { TickArray, TickArrayAccount, Whirlpool, WhirlpoolAccount } from "../entities";
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
  amountRemaining: BN; // either the input remaining to be swapped or output remaining to be swapped for
  amountCalculated: BN; // either the output of this swap or the input that needs to be swapped to receive the specified output
};

type SwapSimulationInput = {
  // TODO
};

type SwapSimulationOutput = {
  // TODO
};

type SwapStepSimulationInput = {
  tickArray: TickArrayAccount;
  tickIndex: number;
  liquidity: BN;
  amount: BN;
};

type SwapStepSimulationOutput = {
  crossedTickArray: boolean;
  crossedTick: boolean;
  liquidityDelta: BN;
  input: BN;
  output: BN;
};

class SwapSimulator<A extends Token, B extends Token> {
  private readonly config: SwapSimulatorConfig<A, B>;

  public constructor(config: SwapSimulatorConfig<A, B>) {
    this.config = config;
  }

  // ** METHODS **
  public simulateSwap(input: SwapSimulationInput): SwapSimulationOutput {
    TODO("Implement");
  }

  public simulateSwapStep(input: SwapStepSimulationInput): SwapStepSimulationOutput {
    const { slippageTolerance, swapDirection, amountSpecified, feeRate } = this.config;
    const { calculateTargetSqrtPrice } = SwapSimulator.functionsBySwapDirection[swapDirection];
    const { calculateSpecifiedTokenDelta, calculateNextSqrtPriceGivenTokenDelta } =
      SwapSimulator.functionsBySwapType[swapDirection][amountSpecified];
    const {
      amount: specifiedTokenAmount,
      liquidity: currentLiquidity,
      tickIndex: currentTickIndex,
      tickArray: currentTickArrayAccount,
    } = input;

    const currentSqrtPriceX64 = TickMath.sqrtPriceAtTick(currentTickIndex);
    const sqrtPriceSlippageX64 = SwapSimulator.calculateSqrtPriceSlippage(
      currentSqrtPriceX64,
      slippageTolerance
    );
    const targetSqrtPriceX64 = calculateTargetSqrtPrice(
      currentTickArrayAccount,
      currentTickIndex,
      currentSqrtPriceX64,
      sqrtPriceSlippageX64
    );
    const [sqrtPriceLowerX64, sqrtPriceUpperX64] = BNUtils.sort(
      currentSqrtPriceX64,
      targetSqrtPriceX64
    );

    const specifiedTokenMaxDelta = calculateSpecifiedTokenDelta(
      currentLiquidity,
      sqrtPriceLowerX64,
      sqrtPriceUpperX64
    );

    const specifiedTokenDelta = SwapSimulator.calculateAmountAfterFees(
      specifiedTokenAmount,
      feeRate
    );

    const nextSqrtPriceX64 = specifiedTokenDelta.gte(specifiedTokenMaxDelta)
      ? targetSqrtPriceX64
      : calculateNextSqrtPriceGivenTokenDelta(
          specifiedTokenMaxDelta,
          currentLiquidity,
          currentSqrtPriceX64
        );

    TODO("Complete");
  }

  // ** UTILS **

  private static calculateSqrtPriceSlippage(sqrtPriceX64: BN, slippageTolerance: Percentage): BN {
    // TODO: Not sure if this is correct since slippage tolerance is for price slippage not sqrtPrice slippage???
    return sqrtPriceX64.mul(slippageTolerance.numerator).div(slippageTolerance.denominator);
  }

  private static calculateAmountAfterFees(amount: BN, feeRate: Percentage): BN {
    const fees = amount.mul(feeRate.numerator).div(feeRate.denominator);
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
    currentSqrtPriceX64: BN,
    sqrtPriceSlippageX64: BN
  ): BN {
    return BN.max(
      currentSqrtPriceX64.sub(sqrtPriceSlippageX64),
      TickMath.sqrtPriceAtTick(
        TickArray.getPrevInitializedTickIndex(currentTickArrayAccount, currentTickIndex)
      )
    );
  }

  private static calculateSqrtPriceAtNextInitializedTick(
    currentTickArrayAccount: TickArrayAccount,
    currentTickIndex: number,
    currentSqrtPriceX64: BN,
    sqrtPriceSlippageX64: BN
  ): BN {
    return BN.min(
      currentSqrtPriceX64.add(sqrtPriceSlippageX64),
      TickMath.sqrtPriceAtTick(
        TickArray.getNextInitializedTickIndex(currentTickArrayAccount, currentTickIndex)
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

  private static readonly functionsBySwapDirection = {
    [SwapDirection.AtoB]: {
      // TODO: Account for edge case where we're at MIN_TICK
      // TODO: Account for moving between tick arrays (support one adjacent tick array to the left)
      calculateTargetSqrtPrice: SwapSimulator.calculateSqrtPriceAtPrevInitializedTick,
    },
    [SwapDirection.BtoA]: {
      // TODO: Account for edge case where we're at MAX_TICK
      // TODO: Account for moving between tick arrays (support one adjacent tick array to the right)
      calculateTargetSqrtPrice: SwapSimulator.calculateSqrtPriceAtNextInitializedTick,
    },
  };

  private static readonly functionsBySwapType = {
    [SwapDirection.AtoB]: {
      [AmountSpecified.Input]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Up),
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateLowerSqrtPriceGivenTokenADelta,
      },
      [AmountSpecified.Output]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Down),
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateLowerSqrtPriceGivenTokenBDelta,
      },
    },
    [SwapDirection.BtoA]: {
      [AmountSpecified.Input]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenBDelta(Rounding.Up),
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateUpperSqrtPriceGivenTokenBDelta,
      },
      [AmountSpecified.Output]: {
        calculateSpecifiedTokenDelta: SwapSimulator.calculateTokenADelta(Rounding.Down),
        calculateNextSqrtPriceGivenTokenDelta:
          SwapSimulator.calculateUpperSqrtPriceGivenTokenADelta,
      },
    },
  };
}
