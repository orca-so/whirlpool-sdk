import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { BN } from "@project-serum/anchor";
import { MintInfo, u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { AddLiquidityQuote } from "../..";
import { Percentage } from "../../utils/public/percentage";

export type InternalAddLiquidityQuoteParam = {
  whirlpool: WhirlpoolData;
  position: PositionData;
  tokenAMintInfo: MintInfo;
  tokenBMintInfo: MintInfo;
  tokenMint: PublicKey;
  tokenAmount: u64;
  slippageTolerence: Percentage;
};

export function getAddLiquidityQuoteWhenPositionIsBelowRange(
  param: InternalAddLiquidityQuoteParam
): AddLiquidityQuote {
  const { whirlpool, position, tokenAMintInfo, tokenMint, tokenAmount, slippageTolerence } = param;

  if (!whirlpool.tokenMintA.equals(tokenMint)) {
    return {
      maxTokenA: new u64(0),
      maxTokenB: new u64(0),
      liquidity: new u64(0),
    };
  }

  // TODO: Use slippage tolerance here

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);
  const liquidity = tokenAmount
    .mul(sqrtPriceLowerX64)
    .mul(sqrtPriceUpperX64)
    .div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
    .shrn(64);

  return {
    maxTokenA: tokenAmount,
    maxTokenB: new u64(0),
    liquidity,
  };
}

export function getAddLiquidityQuoteWhenPositionIsInRange(
  param: InternalAddLiquidityQuoteParam
): AddLiquidityQuote {
  const {
    whirlpool,
    position,
    tokenAMintInfo,
    tokenBMintInfo,
    tokenMint,
    tokenAmount,
    slippageTolerence,
  } = param;

  // TODO: Use slippage tolerance here

  const sqrtPriceX64 = whirlpool.sqrtPrice;
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);

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
  }

  invariant(tokenAmountA !== undefined, "Token A amount is undefined");
  invariant(tokenAmountB !== undefined, "Token B amount is undefined");
  invariant(liquidityX64 !== undefined, "Liquidity is undefined");

  return {
    maxTokenA: tokenAmountA,
    maxTokenB: tokenAmountB,
    liquidity: liquidityX64.shrn(64),
  };
}

export function getAddLiquidityQuoteWhenPositionIsAboveRange(
  param: InternalAddLiquidityQuoteParam
): AddLiquidityQuote {
  const { whirlpool, position, tokenBMintInfo, tokenMint, tokenAmount, slippageTolerence } = param;

  if (!whirlpool.tokenMintB.equals(tokenMint)) {
    return {
      maxTokenA: new u64(0),
      maxTokenB: new u64(0),
      liquidity: new u64(0),
    };
  }

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);
  const liquidity = tokenAmount.shln(64).div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

  return {
    maxTokenA: new u64(0),
    maxTokenB: tokenAmount,
    liquidity,
  };
}
