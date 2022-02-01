import { BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { AddLiquidityQuote } from "../public/types";
import { Percentage } from "../../utils/public/percentage";
import { PositionStatus, PositionUtil } from "../../utils/whirlpool/position-util";
import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";

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
  slippageTolerence: Percentage;
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
    slippageTolerence,
  } = param;

  if (!tokenMintA.equals(inputTokenMint)) {
    return {
      maxTokenA: new u64(0),
      maxTokenB: new u64(0),
      liquidity: new u64(0),
    };
  }

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);
  const liquidity = inputTokenAmount
    .mul(sqrtPriceLowerX64)
    .mul(sqrtPriceUpperX64)
    .div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
    .shrn(64);
  const liquidityAfterSlippage = liquidity
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    maxTokenA: new u64(inputTokenAmount),
    maxTokenB: new u64(0),
    liquidity: new u64(liquidityAfterSlippage),
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
    slippageTolerence,
  } = param;

  const sqrtPriceX64 = sqrtPrice;
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  let [tokenAmountA, tokenAmountB] = tokenMintA.equals(inputTokenMint)
    ? [inputTokenAmount, undefined]
    : [undefined, inputTokenAmount];

  let liquidityX64: BN | undefined = undefined;

  if (tokenAmountA) {
    liquidityX64 = tokenAmountA
      .mul(sqrtPriceX64)
      .mul(sqrtPriceUpperX64)
      .div(sqrtPriceUpperX64.sub(sqrtPriceX64));
    tokenAmountB = liquidityX64.mul(sqrtPriceX64.sub(sqrtPriceLowerX64)).shrn(128);
  } else if (tokenAmountB) {
    liquidityX64 = tokenAmountB.shln(128).div(sqrtPriceX64.sub(sqrtPriceLowerX64));
    tokenAmountA = liquidityX64
      .mul(sqrtPriceUpperX64.sub(sqrtPriceX64))
      .div(sqrtPriceX64)
      .div(sqrtPriceUpperX64);
  } else {
    throw new Error("invariant violation");
  }

  const liquidityAfterSlippage = liquidityX64
    .shrn(64)
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    maxTokenA: new u64(tokenAmountA),
    maxTokenB: new u64(tokenAmountB),
    liquidity: new u64(liquidityAfterSlippage),
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
    slippageTolerence,
  } = param;

  if (!tokenMintB.equals(inputTokenMint)) {
    return {
      maxTokenA: new u64(0),
      maxTokenB: new u64(0),
      liquidity: new u64(0),
    };
  }

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);
  const liquidity = inputTokenAmount.shln(64).div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));
  const liquidityAfterSlippage = liquidity
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    maxTokenA: new u64(0),
    maxTokenB: new u64(inputTokenAmount),
    liquidity: new u64(liquidityAfterSlippage),
  };
}
