import { u64 } from "@solana/spl-token";
import invariant from "tiny-invariant";
import { Percentage, q64, TickArray, Whirlpool } from "../../..";
import { Token } from "../../token";
import { TokenAmount } from "../../token/amount";

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

  const feeRate = input.whirlpool.account.feeRate; // u16 repr as number
  const protocolFeeRate = input.whirlpool.account.protocolFeeRate; // u16 repr as number

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

  while (state.amountRemaining.gt(new u64(0)) && state.currSqrtPriceX64.gt(sqrtPriceLimitX64)) {
    const prevTick = state.currTickArray.getPrevInitializedTick(state.currTickIndex);
    // TODO
  }

  throw new Error("TODO - complete");
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
  minAmountOut: TokenAmount<A> | TokenAmount<B>; // expected minus slippage tolerance
  expectedAmountOut: TokenAmount<A> | TokenAmount<B>;
  expectedAmountIn: TokenAmount<A> | TokenAmount<B>; // order can be partially filled
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
