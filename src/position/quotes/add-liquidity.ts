import { BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { AddLiquidityQuote } from "../public/types";
import { Percentage } from "../../utils/public/percentage";
import {
  adjustForSlippage,
  getLiquidityFromTokenA,
  getLiquidityFromTokenB,
  getTokenAFromLiquidity,
  getTokenBFromLiquidity,
  PositionStatus,
  PositionUtil,
} from "../../utils/public/position-util";
import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { ZERO } from "../../utils/web3/math-utils";

/*** Public ***/

export type InternalAddLiquidityQuoteParam = {
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  tickCurrentIndex: number;
  sqrtPrice: BN;
  inputTokenMint: PublicKey;
  inputTokenAmount: u64;
  tickLowerIndex: number;
  tickUpperIndex: number;
  slippageTolerance: Percentage;
};

export type InternalAddLiquidityQuote = Omit<AddLiquidityQuote, "positionAddress">;

export function getAddLiquidityQuote(
  param: InternalAddLiquidityQuoteParam
): InternalAddLiquidityQuote {
  const positionStatus = PositionUtil.getPositionStatus(
    param.tickCurrentIndex,
    param.tickLowerIndex,
    param.tickUpperIndex
  );

  switch (positionStatus) {
    case PositionStatus.BelowRange:
      return getAddLiquidityQuoteWhenPositionIsBelowRange(param);
    case PositionStatus.InRange:
      return getAddLiquidityQuoteWhenPositionIsInRange(param);
    case PositionStatus.AboveRange:
      return getAddLiquidityQuoteWhenPositionIsAboveRange(param);
    default:
      throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
  }
}

/*** Private ***/

function getAddLiquidityQuoteWhenPositionIsBelowRange(
  param: InternalAddLiquidityQuoteParam
): InternalAddLiquidityQuote {
  const {
    tokenMintA,
    inputTokenMint,
    inputTokenAmount,
    tickLowerIndex,
    tickUpperIndex,
    slippageTolerance,
  } = param;

  if (!tokenMintA.equals(inputTokenMint)) {
    return {
      maxTokenA: ZERO,
      maxTokenB: ZERO,
      liquidity: ZERO,
    };
  }

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  const liquidity = getLiquidityFromTokenA(
    inputTokenAmount,
    sqrtPriceLowerX64,
    sqrtPriceUpperX64,
    false
  );

  const maxTokenA = adjustForSlippage(
    getTokenAFromLiquidity(liquidity, sqrtPriceLowerX64, sqrtPriceUpperX64, true),
    slippageTolerance,
    true
  );
  const maxTokenB = ZERO;

  return {
    maxTokenA,
    maxTokenB,
    liquidity,
  };
}

function getAddLiquidityQuoteWhenPositionIsInRange(
  param: InternalAddLiquidityQuoteParam
): InternalAddLiquidityQuote {
  const {
    tokenMintA,
    sqrtPrice,
    inputTokenMint,
    inputTokenAmount,
    tickLowerIndex,
    tickUpperIndex,
    slippageTolerance,
  } = param;

  const sqrtPriceX64 = sqrtPrice;
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  let [tokenAmountA, tokenAmountB] = tokenMintA.equals(inputTokenMint)
    ? [inputTokenAmount, undefined]
    : [undefined, inputTokenAmount];

  let liquidity: BN;

  if (tokenAmountA) {
    liquidity = getLiquidityFromTokenA(tokenAmountA, sqrtPriceX64, sqrtPriceUpperX64, false);
    tokenAmountA = getTokenAFromLiquidity(liquidity, sqrtPriceX64, sqrtPriceUpperX64, true);
    tokenAmountB = getTokenBFromLiquidity(liquidity, sqrtPriceLowerX64, sqrtPriceX64, true);
  } else if (tokenAmountB) {
    liquidity = getLiquidityFromTokenB(tokenAmountB, sqrtPriceLowerX64, sqrtPriceX64, false);
    tokenAmountA = getTokenAFromLiquidity(liquidity, sqrtPriceX64, sqrtPriceUpperX64, true);
    tokenAmountB = getTokenBFromLiquidity(liquidity, sqrtPriceLowerX64, sqrtPriceX64, true);
  } else {
    throw new Error("invariant violation");
  }

  const maxTokenA = adjustForSlippage(tokenAmountA, slippageTolerance, true);
  const maxTokenB = adjustForSlippage(tokenAmountB, slippageTolerance, true);

  return {
    maxTokenA,
    maxTokenB,
    liquidity,
  };
}

function getAddLiquidityQuoteWhenPositionIsAboveRange(
  param: InternalAddLiquidityQuoteParam
): InternalAddLiquidityQuote {
  const {
    tokenMintB,
    inputTokenMint,
    inputTokenAmount,
    tickLowerIndex,
    tickUpperIndex,
    slippageTolerance,
  } = param;

  if (!tokenMintB.equals(inputTokenMint)) {
    return {
      maxTokenA: ZERO,
      maxTokenB: ZERO,
      liquidity: ZERO,
    };
  }

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);
  const liquidity = getLiquidityFromTokenB(
    inputTokenAmount,
    sqrtPriceLowerX64,
    sqrtPriceUpperX64,
    false
  );

  const maxTokenA = ZERO;
  const maxTokenB = adjustForSlippage(
    getTokenBFromLiquidity(liquidity, sqrtPriceLowerX64, sqrtPriceUpperX64, true),
    slippageTolerance,
    true
  );

  return {
    maxTokenA,
    maxTokenB,
    liquidity,
  };
}
