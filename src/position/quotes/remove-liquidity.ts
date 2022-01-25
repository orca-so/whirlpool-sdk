import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { MintInfo, u64 } from "@solana/spl-token";
import { Percentage } from "../../utils/public/percentage";
import { RemoveLiquidityQuote } from "../public";

export type InternalRemoveLiquidityQuoteParam = {
  whirlpool: WhirlpoolData;
  position: PositionData;
  tokenAMintInfo: MintInfo;
  tokenBMintInfo: MintInfo;
  liquidity: u64;
  slippageTolerence: Percentage;
};

export function getRemoveLiquidityQuoteWhenPositionIsBelowRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  // TODO: Use slippage tolerance here

  const { position, tokenAMintInfo, liquidity, slippageTolerence } = param;

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);

  const tokenAmountA = liquidity
    .shln(64)
    .mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
    .div(sqrtPriceLowerX64)
    .div(sqrtPriceUpperX64);

  return {
    minTokenA: tokenAmountA,
    minTokenB: new u64(0),
    liquidity,
  };
}

export function getRemoveLiquidityQuoteWhenPositionIsInRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  // TODO: Use slippage tolerance here

  const { whirlpool, position, tokenAMintInfo, tokenBMintInfo, liquidity, slippageTolerence } =
    param;

  const sqrtPriceX64 = whirlpool.sqrtPrice;
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);

  const tokenAmountA = liquidity
    .shln(64)
    .mul(sqrtPriceUpperX64.sub(sqrtPriceX64))
    .div(sqrtPriceX64)
    .div(sqrtPriceUpperX64);
  const tokenAmountB = liquidity.mul(sqrtPriceX64.sub(sqrtPriceLowerX64)).shrn(64);

  return {
    minTokenA: tokenAmountA,
    minTokenB: tokenAmountB,
    liquidity,
  };
}

export function getRemoveLiquidityQuoteWhenPositionIsAboveRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  // TODO: Use slippage tolerance here

  const { position, tokenBMintInfo, liquidity, slippageTolerence } = param;

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);

  const tokenAmountB = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64)).shrn(64);

  return {
    minTokenA: new u64(0),
    minTokenB: tokenAmountB,
    liquidity,
  };
}
