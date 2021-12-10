import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { Percentage, q64 } from "../..";
import { TickMath } from "../math";
import { Token } from "../utils/token";
import { TokenAmount } from "../utils/token/amount";

// TODO(atamari): This file isn't the cleanest right now.
// I want to work on everything to do with swap quote within this file and then clean it after I get it to work.

/*******************************************************************
 *                            PRIVATE                              *
 *******************************************************************/

type InputAmount<A extends Token, B extends Token> = {
  input: TokenAmount<A> | TokenAmount<B>;
};

type OutputAmount<A extends Token, B extends Token> = {
  output: TokenAmount<A> | TokenAmount<B>;
};

function isInputAmount<A extends Token, B extends Token>(
  amount: SwapAmount<A, B>
): amount is InputAmount<A, B> {
  return !!(amount as InputAmount<A, B>).input;
}

function isOutputAmount<A extends Token, B extends Token>(
  amount: SwapAmount<A, B>
): amount is OutputAmount<A, B> {
  return !!(amount as OutputAmount<A, B>).output;
}

function isTokenAAmount<A extends Token, B extends Token>(
  amount: TokenAmount<A> | TokenAmount<B>,
  tokenA: A,
  tokenB: B
): amount is TokenAmount<A> {
  return amount.token.equals(tokenA);
}

function isTokenBAmount<A extends Token, B extends Token>(
  amount: TokenAmount<A> | TokenAmount<B>,
  tokenA: A,
  tokenB: B
): amount is TokenAmount<B> {
  return amount.token.equals(tokenB);
}

enum SwapType {
  EXACT_INPUT_A_TO_B,
  A_TO_EXACT_OUTPUT_B,
  EXACT_INPUT_B_TO_A,
  B_TO_EXACT_OUTPUT_A,
}

function resolveSwapType<A extends Token, B extends Token>(
  amount: SwapAmount<A, B>,
  tokenA: A,
  tokenB: B
): SwapType {
  if (isInputAmount<A, B>(amount)) {
    if (isTokenAAmount<A, B>(amount.input, tokenA, tokenB)) {
      return SwapType.EXACT_INPUT_A_TO_B;
    } else if (isTokenBAmount<A, B>(amount.input, tokenA, tokenB)) {
      return SwapType.EXACT_INPUT_B_TO_A;
    }
  } else if (isOutputAmount<A, B>(amount)) {
    if (isTokenAAmount<A, B>(amount.output, tokenA, tokenB)) {
      return SwapType.B_TO_EXACT_OUTPUT_A;
    } else if (isTokenBAmount<A, B>(amount.output, tokenA, tokenB)) {
      return SwapType.A_TO_EXACT_OUTPUT_B;
    }
  }

  throw new Error(`Invalid SwapAmount ${amount}`);
}

type SwapQuoteInput<A extends Token, B extends Token> = {
  whirlpool: Whirlpool;
  currentTickArray: TickArray;
  tokenA: A;
  tokenB: B;
  amount: SwapAmount<A, B>;
  slippageTolerance?: Percentage;
};

// TODO(atamari): Probably will have duplicate logic between these 4 functions. Extract common stuff out after implementing.

async function getSwapQuoteForExactInputAToB<A extends Token, B extends Token>(
  input: SwapQuoteInput<A, B>
): Promise<SwapQuote<A, B>> {
  invariant(
    isInputAmount(input.amount),
    "Invalid SwapQuoteInput for getSwapQuoteForExactInputAToB()"
  );
  invariant(
    isTokenAAmount<A, B>(input.amount.input, input.tokenA, input.tokenB),
    "Invalid SwapQuoteInput for getSwapQuoteForExactInputAToB()"
  );

  const feeRate = input.whirlpool.getFeeRate();
  const protocolFeeRate = input.whirlpool.getProtocolFeeRate();

  const state = {
    amountRemaining: input.amount.input.toU64(), // u64
    amountCalculated: new u64(0), // u64
    currSqrtPriceX64: input.whirlpool.account.sqrtPrice, // q64x64 repr as u128
    currTickArray: input.currentTickArray,
    currTickIndex: input.whirlpool.account.tickCurrentIndex, // i32 repr as number
    currLiquidity: input.whirlpool.account.liquidity, // u64
    protocolFee: new u64(0), // u64
    feeGrowthGlobalAX64: input.whirlpool.account.feeGrowthGlobalA, // q64x64 repr as u128
  };

  const slippageToleranceNumeratorX64 = q64.fromU64(
    input.slippageTolerance?.numerator || new u64(0)
  );
  const slippageToleranceDenominatorX64 = q64.fromU64(
    input.slippageTolerance?.denominator || new u64(1)
  );
  const deltaSqrtPriceX64 = state.currSqrtPriceX64
    .mul(slippageToleranceNumeratorX64)
    .div(slippageToleranceDenominatorX64);
  // Since A is deposited and B is withdrawn in this swap type, sqrt(B/A) (sqrtPrice) decreases
  const sqrtPriceLimitX64 = state.currSqrtPriceX64.sub(deltaSqrtPriceX64);
  // TODO(atamari): Is slippage tolerance used correctly here^? Or are we supposed to just reduce the final amount out by slippage tolerance?

  while (state.amountRemaining.gt(new u64(0)) && state.currSqrtPriceX64.gt(sqrtPriceLimitX64)) {
    // Find the prev initialized tick since we're gonna be moving the price down when swapping A to B due to price being sqrt(B/A)
    // TODO(atamari): ** Handle moving between tick arrays starting from line below till end of this block **
    const prevTickIndex = await state.currTickArray.getPrevInitializedTick(state.currTickIndex);
    const prevTickSqrtPriceX64 = TickMath.sqrtPriceAtTick(prevTickIndex);
    const prevTick = state.currTickArray.getTick(prevTickIndex);

    // Clamp the target price to max(price limit, prev tick's price)
    const targetSqrtPriceX64 = new q64(q64.max(prevTickSqrtPriceX64, sqrtPriceLimitX64));

    // Find how much of token A we can deposit such that the sqrtPrice of the whirlpool moves down to targetSqrtPrice
    // Use eq 6.16 from univ3 whitepaper: ΔX = Δ(1/√P)·L => deltaA = liquidity / sqrt(lower) - liquidity / sqrt(upper)
    // Simplified equation: deltaA = liquidity * (sqrt(upper) - sqrt(lower)) / sqrt(upper) / sqrt(lower)
    // Analyzing the precisions here: (u64 * q64.64) / (q64.64 * q64.64)
    // => we need to bump up the u64 to q64.64 or u128 , i.e. state.currLiquidity
    const currLiquidityX64 = q64.fromU64(state.currLiquidity);
    const tokenARoomAvailable = new u64(
      currLiquidityX64
        .mulDivRoundingUp(
          state.currSqrtPriceX64.subU128(targetSqrtPriceX64),
          state.currSqrtPriceX64
        )
        .divRoundingUp(targetSqrtPriceX64)
    );

    // Since we're swapping A to B and the user specified input (i.e. A), we subtract the base fees from the remaining amount
    const remainingAToSwap = new u64(
      state.amountRemaining.mul(feeRate.denominator.sub(feeRate.numerator)).div(feeRate.denominator)
    );
    // This^ is the actual token A we're gonna deposit into the pool

    // Now we calculate the next sqrt price after fully or partially swapping tokenAToSwap to B within the tick we're in rn
    let nextSqrtPriceX64: q64;
    if (remainingAToSwap.gte(tokenARoomAvailable)) {
      // We're gonna need to use all the room available here, so next sqrt price is the target we used to compute the room in the first place
      nextSqrtPriceX64 = targetSqrtPriceX64;
    } else {
      // TODO(atamari): Revisit this thing again tomorrow and add in rounding logic
      // We can swap the entire remaining token A amount to B within state.currentTick without moving to the previous tick
      // To compute this, we use eq 6.15 from univ3 whitepaper:
      // Δ(1/√P) = ΔX/L => 1/sqrt(lower) - 1/sqrt(upper) = tokenAToSwap/state.currLiquidity
      // What we're trying to find here is actually sqrt(lower) , so let's solve for that:
      //  => 1/sqrt(lower) = tokenAToSwap/state.currLiquidity + 1/sqrt(upper)
      //  => 1/sqrt(lower) = (tokenAToSwap*sqrt(upper) + state.currLiquidity) / (state.currLiquidity * sqrt(upper))
      //  => sqrt(lower) = (state.currLiquidity * sqrt(upper)) / (tokenAToSwap*sqrt(upper) + state.currLiquidity)
      // Precision analysis raw: (u64 * q64.64) / (u64 * q64.64 + u64)
      // Precision analysis modified: (q64.64 * q64.64) / (u64 * q64.64 + q64.64)
      nextSqrtPriceX64 = new q64(
        currLiquidityX64
          .mul(state.currSqrtPriceX64)
          .div(remainingAToSwap.mul(state.currSqrtPriceX64).add(currLiquidityX64))
      );
    }

    const currentTickFullyUsed = nextSqrtPriceX64.eq(targetSqrtPriceX64);

    // Use eq 6.14 from univ3 whitepaper
    // ΔY = ΔP·L
    // Shave off decimals after math, hence the q64.toU64 call
    // TODO(atamari): Revisit this thing again tomorrow and add in rounding logic
    const deltaB = q64.toU64(
      new q64(state.currSqrtPriceX64.sub(nextSqrtPriceX64).mul(state.currLiquidity))
    );

    const deltaA = currentTickFullyUsed
      ? tokenARoomAvailable
      : // Same math used to find tokenARoomAvailable, just uses nextSqrtPriceX64 instead
        new u64(
          currLiquidityX64
            .mulDivRoundingUp(
              state.currSqrtPriceX64.subU128(nextSqrtPriceX64),
              state.currSqrtPriceX64
            )
            .divRoundingUp(targetSqrtPriceX64)
        );

    const feeAmount = new u64(0); // TODO(atamari): Don't understand the feeAmount calculation logic, complete this tmr

    // State updates

    state.currSqrtPriceX64 = nextSqrtPriceX64;
    state.amountRemaining = state.amountRemaining.sub(deltaA.add(feeAmount));
    state.amountCalculated = state.amountCalculated.add(deltaB);

    // TODO(atamari): Modify fee state (don't fully understand fee logic yet)

    // Cross ticks to the previous (i.e. to the left) initialized one
    if (nextSqrtPriceX64.eq(prevTickSqrtPriceX64)) {
      // TODO(atamari): Do some fee related stuff when moving ticks

      // TODO(atamari): Confirm the logic below
      // When moving to the left tick, we subtract liquidity by prevTick.liquidityNet (i64) ??
      // TODO(scuba): Make sure implementation matches final logic^ since prevTick.liquidityNet isn't an i64 yet
      state.currLiquidity = state.currLiquidity.sub(prevTick.liquidityNet); // Sample impl for now
      state.currTickIndex = prevTickIndex;

      // TODO(atamari): Account for anything else todo when moving ticks
    } else {
      // TODO(atamari): Is there anything to do in this case? This can only happen if we hit price target or filled the order right?
    }
  }

  const inputAmountSwapped = input.amount.input.toU64().sub(state.amountRemaining);

  return {
    sqrtPriceLimitX64: new q64(sqrtPriceLimitX64),
    minAmountOut: TokenAmount.from(input.tokenB, state.amountCalculated),
    amountIn: TokenAmount.from(input.tokenA, inputAmountSwapped),
  };
}

async function getSwapQuoteForExactInputBToA<A extends Token, B extends Token>(
  input: SwapQuoteInput<A, B>
): Promise<SwapQuote<A, B>> {
  invariant(
    isInputAmount(input.amount),
    "Invalid SwapQuoteInput for getSwapQuoteForExactInputBToA()"
  );
  invariant(
    isTokenBAmount<A, B>(input.amount.input, input.tokenA, input.tokenB),
    "Invalid SwapQuoteInput for getSwapQuoteForExactInputBToA()"
  );

  throw new Error("TODO - implement");
}

async function getSwapQuoteForAToExactOutputB<A extends Token, B extends Token>(
  input: SwapQuoteInput<A, B>
): Promise<SwapQuote<A, B>> {
  invariant(
    isOutputAmount(input.amount),
    "Invalid SwapQuoteInput for getSwapQuoteForAToExactOutputB()"
  );
  invariant(
    isTokenBAmount<A, B>(input.amount.output, input.tokenA, input.tokenB),
    "Invalid SwapQuoteInput for getSwapQuoteForAToExactOutputB()"
  );

  throw new Error("TODO - implement");
}

async function getSwapQuoteForBToExactOutputA<A extends Token, B extends Token>(
  input: SwapQuoteInput<A, B>
): Promise<SwapQuote<A, B>> {
  invariant(
    isOutputAmount(input.amount),
    "Invalid SwapQuoteInput for getSwapQuoteForBToExactOutputA()"
  );
  invariant(
    isTokenAAmount<A, B>(input.amount.output, input.tokenA, input.tokenB),
    "Invalid SwapQuoteInput for getSwapQuoteForBToExactOutputA()"
  );

  throw new Error("TODO - implement");
}

/*******************************************************************
 *                              PUBLIC                             *
 *******************************************************************/

export type SwapAmount<A extends Token, B extends Token> = InputAmount<A, B> | OutputAmount<A, B>;

export type SwapQuote<A extends Token, B extends Token> = {
  sqrtPriceLimitX64: q64; // sqrt(b/a)
  minAmountOut: TokenAmount<A> | TokenAmount<B>;
  amountIn: TokenAmount<A> | TokenAmount<B>; // order can be partially filled
};

export async function getSwapQuote<A extends Token, B extends Token>(
  input: SwapQuoteInput<A, B>
): Promise<SwapQuote<A, B>> {
  invariant(
    input.tokenA.mint.equals(input.whirlpool.account.tokenMintA),
    "Token A provided does not match whirlpool's token A"
  );
  invariant(
    input.tokenB.mint.equals(input.whirlpool.account.tokenMintB),
    "Token B provided does not match whirlpool's token B"
  );
  invariant(
    input.whirlpool.account.tickArrayStart === input.currentTickArray.account.startTick,
    "Tick array passed in does not match whirlpool's current tick array"
  );

  const swapType = resolveSwapType(input.amount, input.tokenA, input.tokenB);

  switch (swapType) {
    case SwapType.EXACT_INPUT_A_TO_B:
      return getSwapQuoteForExactInputAToB(input);
    case SwapType.EXACT_INPUT_B_TO_A:
      return getSwapQuoteForExactInputBToA(input);
    case SwapType.A_TO_EXACT_OUTPUT_B:
      return getSwapQuoteForAToExactOutputB(input);
    case SwapType.B_TO_EXACT_OUTPUT_A:
      return getSwapQuoteForBToExactOutputA(input);
  }
}
