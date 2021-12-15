import BN from "bn.js";
import invariant from "tiny-invariant";
import { Percentage } from "../..";
import { TickArray, TickArrayAccount, Whirlpool, WhirlpoolAccount } from "../entities";
import { Token, TokenAmount, TickMath } from "../utils";

/**
 * TODO: scuba
 * - We need mul div rounding up and rounding down functions for all BNs
 * - We need div roudning up and rounding down functions for all BNs
 * - We need liquidityNet to be signed
 *
 * TODO: atamari
 * - Go through all the math in this file and add in rounding where necessary (compare with smart contract)
 * - Deduplicate and consolidate swap simulation into one function
 * - Separate out types/interfaces and logic from this file
 * - Determine where to use protocolFeeRate
 * - Revisit `feeAmount` logic once its finalized on smart contract side
 * - Handle movements between tick arrays (just support movement to one adjacent tick array (next/prev depends on swap type))
 */

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
  whirlpool: WhirlpoolAccount;
  currentTickArray: TickArrayAccount;
  tokenA: A;
  tokenB: B;
  amount: SwapAmount<A, B>;
  slippageTolerance: Percentage;
};

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

  const feeRate = Whirlpool.getFeeRate(input.whirlpool);
  const protocolFeeRate = Whirlpool.getProtocolFeeRate(input.whirlpool);

  const state = {
    amountRemaining: input.amount.input.to_U64(), // u64
    amountCalculated: new BN(0), // u64
    currSqrtPrice_Q64x64: input.whirlpool.sqrtPrice_Q64x64, // q64_Q64x64 repr as u128
    currTickArray: input.currentTickArray,
    currTickIndex: input.whirlpool.tickCurrentIndex, // i32 repr as number
    currLiquidity: input.whirlpool.liquidity_U64, // u64
  };

  const slippageToleranceNumerator_Q64x64 = q64.from_U64(input.slippageTolerance.numerator);
  const slippageToleranceDenominator_Q64x64 = q64.from_U64(input.slippageTolerance.denominator);
  const deltaSqrtPrice_Q64x64 = state.currSqrtPrice_Q64x64
    .mul(slippageToleranceNumerator_Q64x64)
    .div(slippageToleranceDenominator_Q64x64);
  // Since A is deposited and B is withdrawn in this swap type, sqrt(B/A) (sqrtPrice) decreases
  const sqrtPriceLimit_Q64x64 = state.currSqrtPrice_Q64x64.sub(deltaSqrtPrice_Q64x64);

  while (
    state.amountRemaining.gt(new BN(0)) &&
    state.currSqrtPrice_Q64x64.gt(sqrtPriceLimit_Q64x64)
  ) {
    // Find the prev initialized tick since we're gonna be moving the price down when swapping A to B due to price being sqrt(B/A)
    const prevTickIndex = await state.currTickArray.getPrevInitializedTick(state.currTickIndex);
    const prevTickSqrtPrice_Q64x64 = TickMath.sqrtPriceAtTick(prevTickIndex);
    const prevTick = state.currTickArray.getTick(prevTickIndex);

    // Clamp the target price to max(price limit, prev tick's price)
    const targetSqrtPrice_Q64x64 = new q64(
      q64.max(prevTickSqrtPrice_Q64x64, sqrtPriceLimit_Q64x64)
    );

    // Find how much of token A we can deposit such that the sqrtPrice of the whirlpool moves down to targetSqrtPrice
    // Use eq 6.16 from univ3 whitepaper: ΔX = Δ(1/√P)·L => deltaA = liquidity / sqrt(lower) - liquidity / sqrt(upper)
    // Simplified equation: deltaA = liquidity * (sqrt(upper) - sqrt(lower)) / sqrt(upper) / sqrt(lower)
    // Analyzing the precisions here: (u64 * q64.64) / (q64.64 * q64.64)
    // => we need to bump up the u64 to q64.64 or u128 , i.e. state.currLiquidity
    const currLiquidity_Q64x64 = q64.from_U64(state.currLiquidity);
    const tokenARoomAvailable = new u64(
      currLiquidity_Q64x64
        .mulDivRoundingUp(
          state.currSqrtPrice_Q64x64.subU128(targetSqrtPrice_Q64x64),
          state.currSqrtPrice_Q64x64
        )
        .divRoundingUp(targetSqrtPrice_Q64x64)
    );

    // Since we're swapping A to B and the user specified input (i.e. A), we subtract the base fees from the remaining amount
    const remainingAToSwap = new u64(
      state.amountRemaining.mul(feeRate.denominator.sub(feeRate.numerator)).div(feeRate.denominator)
    );
    // This^ is the actual token A we're gonna deposit into the pool

    // Now we calculate the next sqrt price after fully or partially swapping tokenAToSwap to B within the tick we're in rn
    let nextSqrtPrice_Q64x64: q64;
    if (remainingAToSwap.gte(tokenARoomAvailable)) {
      // We're gonna need to use all the room available here, so next sqrt price is the target we used to compute the room in the first place
      nextSqrtPrice_Q64x64 = targetSqrtPrice_Q64x64;
    } else {
      // We can swap the entire remaining token A amount to B within state.currentTick without moving to the previous tick
      // To compute this, we use eq 6.15 from univ3 whitepaper:
      // Δ(1/√P) = ΔX/L => 1/sqrt(lower) - 1/sqrt(upper) = tokenAToSwap/state.currLiquidity
      // What we're trying to find here is actually sqrt(lower) , so let's solve for that:
      //  => 1/sqrt(lower) = tokenAToSwap/state.currLiquidity + 1/sqrt(upper)
      //  => 1/sqrt(lower) = (tokenAToSwap*sqrt(upper) + state.currLiquidity) / (state.currLiquidity * sqrt(upper))
      //  => sqrt(lower) = (state.currLiquidity * sqrt(upper)) / (tokenAToSwap*sqrt(upper) + state.currLiquidity)
      // Precision analysis raw: (u64 * q64.64) / (u64 * q64.64 + u64)
      // Precision analysis modified: (q64.64 * q64.64) / (u64 * q64.64 + q64.64)
      nextSqrtPrice_Q64x64 = new q64(
        currLiquidity_Q64x64
          .mul(state.currSqrtPrice_Q64x64)
          .div(remainingAToSwap.mul(state.currSqrtPrice_Q64x64).add(currLiquidity_Q64x64))
      );
    }

    const currentTickFullyUsed = nextSqrtPrice_Q64x64.eq(targetSqrtPrice_Q64x64);

    // Use eq 6.14 from univ3 whitepaper
    // ΔY = Δ√P·L
    // Shave off decimals after math, hence the right shift
    const deltaB = state.currSqrtPrice_Q64x64
      .sub(nextSqrtPrice_Q64x64)
      .mul(state.currLiquidity)
      .shrn(64);

    const deltaA = currentTickFullyUsed
      ? tokenARoomAvailable
      : // Same math used to find tokenARoomAvailable, just uses nextSqrtPrice_Q64x64 instead
        new u64(
          currLiquidity_Q64x64
            .mulDivRoundingUp(
              state.currSqrtPrice_Q64x64.subU128(nextSqrtPrice_Q64x64),
              state.currSqrtPrice_Q64x64
            )
            .divRoundingUp(targetSqrtPrice_Q64x64)
        );

    let feeAmount: u64;
    if (!nextSqrtPrice_Q64x64.eq(targetSqrtPrice_Q64x64)) {
      // Revisit this once smart contract logic is final
      feeAmount = state.amountRemaining.sub(deltaA);
    } else {
      feeAmount = new u128(deltaA).mulDivRoundingUp(
        new u128(feeRate.numerator),
        new u128(feeRate.denominator)
      );
    }

    // State updates

    state.currSqrtPrice_Q64x64 = nextSqrtPrice_Q64x64;
    state.amountRemaining = state.amountRemaining.sub(deltaA.add(feeAmount));
    state.amountCalculated = state.amountCalculated.add(deltaB);

    // Cross ticks to the previous (i.e. to the left) initialized one
    if (nextSqrtPrice_Q64x64.eq(prevTickSqrtPrice_Q64x64)) {
      // When moving to the left tick, we subtract liquidity by prevTick.liquidityNet
      // TODO(scuba): Make sure implementation matches final logic^ since prevTick.liquidityNet isn't an i64 yet
      state.currLiquidity = state.currLiquidity.sub(prevTick.liquidityNet); // Sample impl for now
      state.currTickIndex = prevTickIndex;
    }
  }

  const inputAmountSwapped = input.amount.input.to_U64().sub(state.amountRemaining);

  return {
    sqrtPriceLimit_Q64x64: new q64(sqrtPriceLimit_Q64x64),
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

  const feeRate = Whirlpool.getFeeRate(input.whirlpool);
  const protocolFeeRate = Whirlpool.getProtocolFeeRate(input.whirlpool);

  const state = {
    amountRemaining: input.amount.input.to_U64(), // u64
    amountCalculated: new u64(0), // u64
    currSqrtPrice_Q64x64: input.whirlpool.sqrtPrice_Q64x64, // q64_Q64x64 repr as u128
    currTickArray: input.currentTickArray,
    currTickIndex: input.whirlpool.tickCurrentIndex, // i32 repr as number
    currLiquidity: input.whirlpool.liquidity_U64, // u64
  };

  const slippageToleranceNumerator_Q64x64 = q64.from_U64(input.slippageTolerance.numerator);
  const slippageToleranceDenominator_Q64x64 = q64.from_U64(input.slippageTolerance.denominator);
  const deltaSqrtPrice_Q64x64 = state.currSqrtPrice_Q64x64
    .mul(slippageToleranceNumerator_Q64x64)
    .div(slippageToleranceDenominator_Q64x64);
  // Since B is deposited and A is withdrawn in this swap type, sqrt(B/A) (sqrtPrice) increases
  const sqrtPriceLimit_Q64x64 = state.currSqrtPrice_Q64x64.add(deltaSqrtPrice_Q64x64);

  while (
    state.amountRemaining.gt(new u64(0)) &&
    state.currSqrtPrice_Q64x64.lt(sqrtPriceLimit_Q64x64)
  ) {
    // Find the next initialized tick since we're gonna be moving the price up when swapping B to A due to price being sqrt(B/A)
    const nextTickIndex = await state.currTickArray.getNextInitializedTick(state.currTickIndex);
    const nextTickSqrtPrice_Q64x64 = TickMath.sqrtPriceAtTick(nextTickIndex);
    const nextTick = state.currTickArray.getTick(nextTickIndex);

    // Clamp the target price to min(price limit, next tick's price)
    const targetSqrtPrice_Q64x64 = new q64(
      q64.min(nextTickSqrtPrice_Q64x64, sqrtPriceLimit_Q64x64)
    );

    // Find how much of token B we can deposit such that the sqrtPrice of the whirlpool moves up to targetSqrtPrice
    // Use eq 6.14 from univ3 whitepaper: ΔY = ΔP·L => deltaB = (sqrt(upper) - sqrt(lower)) * liquidity
    // Analyzing the precisions here: (q64.64 - q64.64) * q64.0 => q128.64
    // We need to shave off decimal part, hence q128.64 >> 64 => q128.0
    const tokenBRoomAvailable = targetSqrtPrice_Q64x64
      .sub(state.currSqrtPrice_Q64x64)
      .mul(state.currLiquidity)
      .shrn(64);

    // Since we're swapping B to A and the user specified input (i.e. B), we subtract the base fees from the remaining amount
    const remainingBToSwap = new u64(
      state.amountRemaining.mul(feeRate.denominator.sub(feeRate.numerator)).div(feeRate.denominator)
    );
    // This^ is the actual token B we're gonna deposit into the pool

    // Now we calculate the next sqrt price after fully or partially swapping remainingBToSwap to A within the tick we're in rn
    let nextSqrtPrice_Q64x64: q64;
    if (remainingBToSwap.gte(tokenBRoomAvailable)) {
      // We're gonna need to use all the room available here, so next sqrt price is the target we used to compute the room in the first place
      nextSqrtPrice_Q64x64 = targetSqrtPrice_Q64x64;
    } else {
      // We can swap the entire remaining token B amount to A within state.currentTick without moving to the next tick
      // To compute this, we use eq 6.13 from univ3 whitepaper:
      // Δ√P = ΔY/L => sqrt(upper) - sqrt(lower) = remainingBToSwap / state.currLiquidity
      // What we're trying to find here is actually sqrt(upper) , so let's solve for that:
      //  => sqrt(upper) = (remainingBToSwap / state.currLiquidity) + sqrt(lower)
      // Precision analysis raw: (q64.0 / q64.0) + q64.64
      // Precision analysis modified: (q64.64 / q64.0) + q64.64
      const remainingBToSwap_Q64x64 = remainingBToSwap.shln(64);
      nextSqrtPrice_Q64x64 = new q64(
        remainingBToSwap_Q64x64.div(state.currLiquidity).add(state.currSqrtPrice_Q64x64)
      );
    }

    const currentTickFullyUsed = nextSqrtPrice_Q64x64.eq(targetSqrtPrice_Q64x64);

    // Use eq 6.16 from univ3 whitepaper to find deltaA for given remainingBToSwap
    // ΔX = Δ(1/√P)·L => deltaA = (1/sqrt(lower) - 1/sqrt(upper)) * state.currLiquidity
    // => deltaA = ((sqrt(upper) - sqrt(lower)) / (sqrt(lower) * sqrt(upper))) * state.currLiquidity
    // => deltaA = (state.currLiquidity * (sqrt(upper) - sqrt(lower))) / sqrt(upper) / sqrt(lower)
    // Precision analysis raw: (q64.0 * (q64.64 - q64.64)) / q64.64 / q64.64
    // Precision analysis modified: (q64.64 * (q64.64 - q64.64)) / q64.64 / q64.64
    const currLiquidity_Q64x64 = state.currLiquidity.shln(64);
    const deltaA = currLiquidity_Q64x64
      .mul(nextSqrtPrice_Q64x64.sub(state.currSqrtPrice_Q64x64))
      .div(nextSqrtPrice_Q64x64)
      .div(state.currSqrtPrice_Q64x64);

    const deltaB = currentTickFullyUsed
      ? tokenBRoomAvailable
      : // Same math used to find tokenBRoomAvailable, just uses nextSqrtPrice_Q64x64 instead
        nextSqrtPrice_Q64x64.sub(state.currSqrtPrice_Q64x64).mul(state.currLiquidity).shrn(64);

    let feeAmount: u64;
    if (!nextSqrtPrice_Q64x64.eq(targetSqrtPrice_Q64x64)) {
      // Revisit this once smart contract logic is final
      feeAmount = state.amountRemaining.sub(deltaB);
    } else {
      feeAmount = new u128(deltaA).mulDivRoundingUp(
        new u128(feeRate.numerator),
        new u128(feeRate.denominator)
      );
    }

    // State updates

    state.currSqrtPrice_Q64x64 = nextSqrtPrice_Q64x64;
    state.amountRemaining = state.amountRemaining.sub(deltaB.add(feeAmount));
    state.amountCalculated = state.amountCalculated.add(deltaA);

    // Cross ticks to the next (i.e. to the right) initialized one
    if (nextSqrtPrice_Q64x64.eq(nextTickSqrtPrice_Q64x64)) {
      // When moving to the right tick, we increase liquidity by nextTick.liquidityNet
      // TODO(scuba): Make sure implementation matches final logic^ since prevTick.liquidityNet isn't an i64 yet
      state.currLiquidity = state.currLiquidity.add(nextTick.liquidityNet); // Sample impl for now
      state.currTickIndex = nextTickIndex;
    }
  }

  const inputAmountSwapped = input.amount.input.to_U64().sub(state.amountRemaining);

  return {
    sqrtPriceLimit_Q64x64: new q64(sqrtPriceLimit_Q64x64),
    minAmountOut: TokenAmount.from(input.tokenA, state.amountCalculated),
    amountIn: TokenAmount.from(input.tokenB, inputAmountSwapped),
  };
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

  const feeRate = Whirlpool.getFeeRate(input.whirlpool);
  const protocolFeeRate = Whirlpool.getProtocolFeeRate(input.whirlpool);

  const state = {
    amountRemaining: input.amount.output.to_U64(), // u64
    amountCalculated: new u64(0), // u64
    currSqrtPrice_Q64x64: input.whirlpool.sqrtPrice_Q64x64, // q64_Q64x64 repr as u128
    currTickArray: input.currentTickArray,
    currTickIndex: input.whirlpool.tickCurrentIndex, // i32 repr as number
    currLiquidity: input.whirlpool.liquidity_U64, // u64
  };

  const slippageToleranceNumerator_Q64x64 = q64.from_U64(input.slippageTolerance.numerator);
  const slippageToleranceDenominator_Q64x64 = q64.from_U64(input.slippageTolerance.denominator);
  const deltaSqrtPrice_Q64x64 = state.currSqrtPrice_Q64x64
    .mul(slippageToleranceNumerator_Q64x64)
    .div(slippageToleranceDenominator_Q64x64);
  // Since A is deposited and B is withdrawn in this swap type, sqrt(B/A) (sqrtPrice) decreases
  const sqrtPriceLimit_Q64x64 = state.currSqrtPrice_Q64x64.sub(deltaSqrtPrice_Q64x64);

  while (
    state.amountRemaining.gt(new u64(0)) &&
    state.currSqrtPrice_Q64x64.gt(sqrtPriceLimit_Q64x64)
  ) {
    // Find the prev initialized tick since we're gonna be moving the price down when swapping A to B due to price being sqrt(B/A)
    const prevTickIndex = await state.currTickArray.getPrevInitializedTick(state.currTickIndex);
    const prevTickSqrtPrice_Q64x64 = TickMath.sqrtPriceAtTick(prevTickIndex);
    const prevTick = state.currTickArray.getTick(prevTickIndex);

    // Clamp the target price to max(price limit, prev tick's price)
    const targetSqrtPrice_Q64x64 = new q64(
      q64.max(prevTickSqrtPrice_Q64x64, sqrtPriceLimit_Q64x64)
    );

    // Find how much of token B we can withdraw such that the sqrtPrice of the whirlpool moves down to targetSqrtPrice
    // Use eq 6.14 from univ3 whitepaper: ΔY = ΔP·L => deltaB = (sqrt(upper) - sqrt(lower)) * liquidity
    // Analyzing the precisions here: (q64.64 - q64.64) * q64.0 => q128.64
    // We need to shave off decimal part, hence q128.64 >> 64 => q128.0
    const tokenBRoomAvailable = targetSqrtPrice_Q64x64
      .sub(state.currSqrtPrice_Q64x64)
      .mul(state.currLiquidity)
      .shrn(64);

    // Since we're swapping A to B and the user specified output (i.e. B), we DON'T subtract the base fees from the remaining amount
    const remainingBToWithdraw = state.amountRemaining;

    // Now we calculate the next sqrt price after fully or partially swapping A to remainingBToWithdraw within the tick we're in rn
    let nextSqrtPrice_Q64x64: q64;
    if (remainingBToWithdraw.gte(tokenBRoomAvailable)) {
      // We're gonna need to use all the room available here, so next sqrt price is the target we used to compute the room in the first place
      nextSqrtPrice_Q64x64 = targetSqrtPrice_Q64x64;
    } else {
      // We can get entire remaining B by swapping just within this tick
      // To compute this, we use eq 6.13 from univ3 whitepaper:
      // Δ√P = ΔY/L => sqrt(upper) - sqrt(lower) = remainingBToWithdraw / state.currLiquidity
      // What we're trying to find here is actually sqrt(lower) since we're removing B from the pool, so let's solve for that:
      //  => sqrt(lower) = sqrt(upper) - (remainingBToWitdhraw / state.currLiquidity)
      // Precision analysis raw: q64.64 - (q64.0 / q64.0)
      // Precision analysis modified: q64.64 - (q64.64 / q64.0)
      const remainingBToWithdraw_Q64x64 = remainingBToWithdraw.shln(64);
      nextSqrtPrice_Q64x64 = new q64(
        state.currSqrtPrice_Q64x64.sub(remainingBToWithdraw_Q64x64.div(state.currLiquidity))
      );
    }

    const currentTickFullyUsed = nextSqrtPrice_Q64x64.eq(targetSqrtPrice_Q64x64);

    // Use eq 6.16 from univ3 whitepaper to find deltaA for given remainingBToWithdraw
    // ΔX = Δ(1/√P)·L => deltaA = (1/sqrt(lower) - 1/sqrt(upper)) * state.currLiquidity
    // => deltaA = ((sqrt(upper) - sqrt(lower)) / (sqrt(lower) * sqrt(upper))) * state.currLiquidity
    // => deltaA = (state.currLiquidity * (sqrt(upper) - sqrt(lower))) / sqrt(upper) / sqrt(lower)
    // Precision analysis raw: (q64.0 * (q64.64 - q64.64)) / q64.64 / q64.64
    // Precision analysis modified: (q64.64 * (q64.64 - q64.64)) / q64.64 / q64.64
    const currLiquidity_Q64x64 = state.currLiquidity.shln(64);
    const deltaA = currLiquidity_Q64x64
      .mul(nextSqrtPrice_Q64x64.sub(state.currSqrtPrice_Q64x64))
      .div(nextSqrtPrice_Q64x64)
      .div(state.currSqrtPrice_Q64x64);

    const deltaB = currentTickFullyUsed
      ? tokenBRoomAvailable
      : // Same math used to find tokenBRoomAvailable, just uses nextSqrtPrice_Q64x64 instead
        nextSqrtPrice_Q64x64.sub(state.currSqrtPrice_Q64x64).mul(state.currLiquidity).shrn(64);

    const amountIn = deltaA;
    const amountOut = u64.min(deltaB, state.amountRemaining);

    const feeAmount = new u128(amountIn).mulDivRoundingUp(
      new u128(feeRate.numerator),
      new u128(feeRate.denominator)
    );

    // State updates

    state.currSqrtPrice_Q64x64 = nextSqrtPrice_Q64x64;
    state.amountRemaining = state.amountRemaining.sub(amountOut);
    state.amountCalculated = state.amountCalculated.add(amountIn.add(feeAmount));

    // Cross ticks to the prev (i.e. to the left) initialized one
    if (nextSqrtPrice_Q64x64.eq(prevTickSqrtPrice_Q64x64)) {
      // When moving to the left tick, we decrease liquidity by nextTick.liquidityNet
      // TODO(scuba): Make sure implementation matches final logic^ since prevTick.liquidityNet isn't an i64 yet
      state.currLiquidity = state.currLiquidity.sub(prevTick.liquidityNet); // Sample impl for now
      state.currTickIndex = prevTickIndex;
    }
  }

  const inputAmount = state.amountCalculated;
  const outputAmount = input.amount.output.to_U64().sub(state.amountRemaining);

  return {
    sqrtPriceLimit_Q64x64: new q64(sqrtPriceLimit_Q64x64),
    minAmountOut: TokenAmount.from(input.tokenB, outputAmount),
    amountIn: TokenAmount.from(input.tokenA, inputAmount),
  };
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

  const feeRate = Whirlpool.getFeeRate(input.whirlpool);
  const protocolFeeRate = Whirlpool.getProtocolFeeRate(input.whirlpool);

  const state = {
    amountRemaining: input.amount.output.to_U64(), // u64
    amountCalculated: new u64(0), // u64
    currSqrtPrice_Q64x64: input.whirlpool.sqrtPrice_Q64x64, // q64_Q64x64 repr as u128
    currTickArray: input.currentTickArray,
    currTickIndex: input.whirlpool.tickCurrentIndex, // i32 repr as number
    currLiquidity: input.whirlpool.liquidity_U64, // u64
  };

  const slippageToleranceNumerator_Q64x64 = q64.from_U64(input.slippageTolerance.numerator);
  const slippageToleranceDenominator_Q64x64 = q64.from_U64(input.slippageTolerance.denominator);
  const deltaSqrtPrice_Q64x64 = state.currSqrtPrice_Q64x64
    .mul(slippageToleranceNumerator_Q64x64)
    .div(slippageToleranceDenominator_Q64x64);
  // Since B is deposited and A is withdrawn in this swap type, sqrt(B/A) (sqrtPrice) increases
  const sqrtPriceLimit_Q64x64 = state.currSqrtPrice_Q64x64.add(deltaSqrtPrice_Q64x64);

  while (
    state.amountRemaining.gt(new u64(0)) &&
    state.currSqrtPrice_Q64x64.lt(sqrtPriceLimit_Q64x64)
  ) {
    // Find the next initialized tick since we're gonna be moving the price up when swapping B to A due to price being sqrt(B/A)
    const nextTickIndex = await TickArray.getNextInitializedTick(
      state.currTickArray,
      state.currTickIndex
    );
    const nextTickSqrtPrice_Q64x64 = TickMath.sqrtPriceAtTick(nextTickIndex);
    const nextTick = TickArray.getTick(state.currTickArray, nextTickIndex);

    // Clamp the target price to min(price limit, next tick's price)
    const targetSqrtPrice_Q64x64 = new q64(
      q64.min(nextTickSqrtPrice_Q64x64, sqrtPriceLimit_Q64x64)
    );

    // Find how much of token A we can withdraw such that the sqrtPrice of the whirlpool moves up to targetSqrtPrice
    // Use eq 6.16 from univ3 whitepaper to find deltaA
    // ΔX = Δ(1/√P)·L => deltaA = (1/sqrt(lower) - 1/sqrt(upper)) * state.currLiquidity
    // => deltaA = ((sqrt(upper) - sqrt(lower)) / (sqrt(lower) * sqrt(upper))) * state.currLiquidity
    // => deltaA = (state.currLiquidity * (sqrt(upper) - sqrt(lower))) / sqrt(upper) / sqrt(lower)
    // Precision analysis raw: (q64.0 * (q64.64 - q64.64)) / q64.64 / q64.64
    // Precision analysis modified: (q64.64 * (q64.64 - q64.64)) / q64.64 / q64.64
    const tokenARoomAvailable = state.currLiquidity
      .mul(targetSqrtPrice_Q64x64.sub(state.currSqrtPrice_Q64x64))
      .div(targetSqrtPrice_Q64x64)
      .div(state.currSqrtPrice_Q64x64);

    // Since we're swapping B to A and the user specified output (i.e. A), we DON'T subtract the base fees from the remaining amount
    const remainingAToWithdraw = state.amountRemaining;

    // Now we calculate the next sqrt price after fully or partially swapping B to A within the tick we're in rn
    let nextSqrtPrice_Q64x64: q64;
    if (remainingAToWithdraw.gte(tokenARoomAvailable)) {
      // We're gonna need to use all the room available here, so next sqrt price is the target we used to compute the room in the first place
      nextSqrtPrice_Q64x64 = targetSqrtPrice_Q64x64;
    } else {
      // We can get the entire remaining A we need from B by swapping just within this tick
      // To compute this, we use eq 6.15 from univ3 whitepaper:
      // Δ(1/√P) = ΔX/L => 1/sqrt(lower) - 1/sqrt(upper) = remainingAToWithdraw/state.currLiquidity
      // What we're trying to find here is actually sqrt(upper) , so let's solve for that:
      //  => 1/sqrt(upper) =  1/sqrt(lower) - remainingAToWithdraw/state.currLiquidity
      //  => sqrt(upper) =  (state.currLiquidity * sqrt(lower)) / (state.currLiquidity - sqrt(lower)*remainingAToWithdraw)
      // Precision analysis raw: (u64 * q64.64) / (u64 - q64.64 * u64)
      // Precision analysis modified: (q64.64 * q64.64) / (q64.64 - q64.64 * u64)
      const currLiquidity_Q64x64 = state.currLiquidity.shln(64);
      nextSqrtPrice_Q64x64 = currLiquidity_Q64x64
        .mul(state.currSqrtPrice_Q64x64)
        .div(currLiquidity_Q64x64.sub(sqrtPriceLimit_Q64x64.mul(remainingAToWithdraw)));
    }

    const currentTickFullyUsed = nextSqrtPrice_Q64x64.eq(targetSqrtPrice_Q64x64);

    // Use eq 6.14 from univ3 whitepaper to find deltaB for transition from sqrt(lower) to sqrt(upper)
    // ΔY = Δ√P·L => deltaB = (sqrt(upper) - sqrt(lower)) * liquidity
    // Analyzing the precisions here: (q64.64 - q64.64) * q64.0 => q128.64
    // We need to shave off decimal part, hence q128.64 >> 64 => q128.0
    const deltaB = nextSqrtPrice_Q64x64
      .sub(state.currSqrtPrice_Q64x64)
      .mul(state.currLiquidity)
      .shrn(64);

    // Use eq 6.16 from univ3 whitepaper to find deltaA for given remainingBToWithdraw
    // ΔX = Δ(1/√P)·L => deltaA = (1/sqrt(lower) - 1/sqrt(upper)) * state.currLiquidity
    // => deltaA = ((sqrt(upper) - sqrt(lower)) / (sqrt(lower) * sqrt(upper))) * state.currLiquidity
    // => deltaA = (state.currLiquidity * (sqrt(upper) - sqrt(lower))) / sqrt(upper) / sqrt(lower)
    // Precision analysis raw: (q64.0 * (q64.64 - q64.64)) / q64.64 / q64.64
    // Precision analysis modified: (q64.64 * (q64.64 - q64.64)) / q64.64 / q64.64
    const currLiquidity_Q64x64 = state.currLiquidity.shln(64);
    const deltaA = currentTickFullyUsed
      ? tokenARoomAvailable
      : currLiquidity_Q64x64
          .mul(nextSqrtPrice_Q64x64.sub(state.currSqrtPrice_Q64x64))
          .div(nextSqrtPrice_Q64x64)
          .div(state.currSqrtPrice_Q64x64);

    const amountIn = deltaB;
    const amountOut = u64.min(deltaA, state.amountRemaining);

    const feeAmount = amountIn.mul(feeRate.numerator).div(feeRate.denominator);

    // State updates

    state.currSqrtPrice_Q64x64 = nextSqrtPrice_Q64x64;
    state.amountRemaining = state.amountRemaining.sub(amountOut);
    state.amountCalculated = state.amountCalculated.add(amountIn.add(feeAmount));

    // Cross ticks to the next (i.e. to the right) initialized one
    if (nextSqrtPrice_Q64x64.eq(nextTickSqrtPrice_Q64x64)) {
      // When moving to the right tick, we increase liquidity by nextTick.liquidityNet
      // TODO(scuba): Make sure implementation matches final logic^ since prevTick.liquidityNet isn't an i64 yet
      state.currLiquidity = state.currLiquidity.add(nextTick.liquidityNet_I64); // Sample impl for now
      state.currTickIndex = nextTickIndex;
    }
  }

  const inputAmount = state.amountCalculated;
  const outputAmount = input.amount.output.to_U64().sub(state.amountRemaining);

  return {
    sqrtPriceLimit_Q64x64: new q64(sqrtPriceLimit_Q64x64),
    minAmountOut: TokenAmount.from(input.tokenA, outputAmount),
    amountIn: TokenAmount.from(input.tokenB, inputAmount),
  };
}

/*******************************************************************
 *                              PUBLIC                             *
 *******************************************************************/

export type SwapAmount<A extends Token, B extends Token> = InputAmount<A, B> | OutputAmount<A, B>;

export type SwapQuote<A extends Token, B extends Token> = {
  sqrtPriceLimit_Q64x64: q64; // sqrt(b/a)
  minAmountOut: TokenAmount<A> | TokenAmount<B>;
  amountIn: TokenAmount<A> | TokenAmount<B>; // order can be partially filled
};

export async function getSwapQuote<A extends Token, B extends Token>(
  input: SwapQuoteInput<A, B>
): Promise<SwapQuote<A, B>> {
  invariant(
    input.tokenA.mint.equals(input.whirlpool.tokenMintA),
    "Token A provided does not match whirlpool's token A"
  );
  invariant(
    input.tokenB.mint.equals(input.whirlpool.tokenMintB),
    "Token B provided does not match whirlpool's token B"
  );
  invariant(
    input.whirlpool.tickArrayStart === input.currentTickArray.startTick,
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
