import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { BN } from "@project-serum/anchor";
import { MintInfo, u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { AddLiquidityQuote } from "../..";
import { Percentage } from "../../utils/public/percentage";

export type InternalAddLiquidityQuoteParam = {
  whirlpool: WhirlpoolData;
  tokenAMintInfo: MintInfo;
  tokenBMintInfo: MintInfo;
  tokenMint: PublicKey;
  tokenAmount: u64;
  tickLowerIndex: number;
  tickUpperIndex: number;
  slippageTolerence: Percentage;
};

export function getAddLiquidityQuoteWhenPositionIsBelowRange(
  param: InternalAddLiquidityQuoteParam
): AddLiquidityQuote {
  const {
    whirlpool,
    tokenAMintInfo,
    tokenMint,
    tokenAmount,
    tickLowerIndex,
    tickUpperIndex,
    slippageTolerence,
  } = param;

  if (!whirlpool.tokenMintA.equals(tokenMint)) {
    return {
      maxTokenA: new u64(0),
      maxTokenB: new u64(0),
      liquidity: new u64(0),
    };
  }

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);
  const liquidity = tokenAmount
    .mul(sqrtPriceLowerX64)
    .mul(sqrtPriceUpperX64)
    .div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
    .shrn(64 + tokenAMintInfo.decimals); // TODO
  const liquidityAfterSlippage = liquidity
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    maxTokenA: new u64(tokenAmount),
    maxTokenB: new u64(0),
    liquidity: new u64(liquidityAfterSlippage),
  };
}

export function getAddLiquidityQuoteWhenPositionIsInRange(
  param: InternalAddLiquidityQuoteParam
): AddLiquidityQuote {
  const {
    whirlpool,
    tokenAMintInfo,
    tokenBMintInfo,
    tokenMint,
    tokenAmount,
    tickLowerIndex,
    tickUpperIndex,
    slippageTolerence,
  } = param;

  // TODO: Use slippage tolerance here

  const sqrtPriceX64 = whirlpool.sqrtPrice;
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  let [tokenAmountA, tokenAmountB] = whirlpool.tokenMintA.equals(tokenMint)
    ? [tokenAmount, undefined]
    : [undefined, tokenAmount];

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

export function getAddLiquidityQuoteWhenPositionIsAboveRange(
  param: InternalAddLiquidityQuoteParam
): AddLiquidityQuote {
  const {
    whirlpool,
    tokenBMintInfo,
    tokenMint,
    tokenAmount,
    tickLowerIndex,
    tickUpperIndex,
    slippageTolerence,
  } = param;

  if (!whirlpool.tokenMintB.equals(tokenMint)) {
    return {
      maxTokenA: new u64(0),
      maxTokenB: new u64(0),
      liquidity: new u64(0),
    };
  }

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);
  const liquidity = tokenAmount
    .shln(64)
    .div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
    .shrn(tokenBMintInfo.decimals); // TODO
  const liquidityAfterSlippage = liquidity
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    maxTokenA: new u64(0),
    maxTokenB: new u64(tokenAmount),
    liquidity: new u64(liquidityAfterSlippage),
  };
}
