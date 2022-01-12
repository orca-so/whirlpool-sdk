import { fromX64, tickIndexToSqrtPriceX64, toX64 } from "@orca-so/whirlpool-client-sdk";
import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { MintInfo, u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import { AddLiquidityQuote } from "../..";
import { DecimalUtil } from "../../utils/math/decimal-utils";
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

  const tokenAAmountX64 = toX64(DecimalUtil.fromU64(tokenAmount, tokenAMintInfo.decimals));
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickLowerIndex));
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickUpperIndex));
  const liquidityX64 = tokenAAmountX64
    .mul(sqrtPriceLowerX64)
    .mul(sqrtPriceUpperX64)
    .div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

  return {
    maxTokenA: tokenAmount,
    maxTokenB: new u64(0),
    liquidity: DecimalUtil.toU64(fromX64(liquidityX64)),
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

  const sqrtPriceX64 = DecimalUtil.fromU64(whirlpool.sqrtPrice);
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickLowerIndex));
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickUpperIndex));

  let [tokenAAmountX64, tokenBAmountX64] = whirlpool.tokenMintA.equals(tokenMint)
    ? [toX64(DecimalUtil.fromU64(tokenAmount, tokenAMintInfo.decimals)), undefined]
    : [undefined, toX64(DecimalUtil.fromU64(tokenAmount, tokenBMintInfo.decimals))];

  let liquidityX64: Decimal | undefined = undefined;

  if (tokenAAmountX64) {
    liquidityX64 = tokenAAmountX64
      .mul(sqrtPriceX64)
      .mul(sqrtPriceUpperX64)
      .div(sqrtPriceUpperX64.sub(sqrtPriceX64));
    tokenBAmountX64 = liquidityX64.mul(sqrtPriceX64.sub(sqrtPriceLowerX64));
  } else if (tokenBAmountX64) {
    liquidityX64 = tokenBAmountX64.div(sqrtPriceX64.sub(sqrtPriceLowerX64));
    tokenAAmountX64 = liquidityX64
      .mul(sqrtPriceUpperX64.sub(sqrtPriceX64))
      .div(sqrtPriceX64)
      .div(sqrtPriceUpperX64);
  }

  invariant(tokenAAmountX64 !== undefined, "Token A amount is undefined");
  invariant(tokenBAmountX64 !== undefined, "Token B amount is undefined");
  invariant(liquidityX64 !== undefined, "Liquidity is undefined");

  return {
    maxTokenA: DecimalUtil.toU64(fromX64(tokenAAmountX64), tokenAMintInfo.decimals),
    maxTokenB: DecimalUtil.toU64(fromX64(tokenBAmountX64), tokenBMintInfo.decimals),
    liquidity: DecimalUtil.toU64(fromX64(liquidityX64)),
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

  const tokenBAmountX64 = toX64(DecimalUtil.fromU64(tokenAmount, tokenBMintInfo.decimals));
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickLowerIndex));
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickUpperIndex));
  const liquidityX64 = tokenBAmountX64.div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

  return {
    maxTokenA: new u64(0),
    maxTokenB: tokenAmount,
    liquidity: DecimalUtil.toU64(fromX64(liquidityX64)),
  };
}
