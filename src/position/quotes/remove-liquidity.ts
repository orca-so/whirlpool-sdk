import { fromX64, tickIndexToSqrtPriceX64, toX64 } from "@orca-so/whirlpool-client-sdk";
import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { MintInfo, u64 } from "@solana/spl-token";
import Decimal from "decimal.js";
import { DecimalUtil } from "../../utils/math/decimal-utils";
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

  const liquidityX64 = toX64(DecimalUtil.fromU64(liquidity));
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickLowerIndex));
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickUpperIndex));

  const tokenAAmountX64 = liquidityX64
    .mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
    .div(sqrtPriceLowerX64)
    .div(sqrtPriceUpperX64);

  return {
    minTokenA: DecimalUtil.toU64(fromX64(tokenAAmountX64), tokenAMintInfo.decimals),
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

  const liquidityX64 = toX64(DecimalUtil.fromU64(liquidity));
  const sqrtPriceX64 = DecimalUtil.fromU64(whirlpool.sqrtPrice);
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickLowerIndex));
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickUpperIndex));

  const tokenAAmountX64 = liquidityX64
    .mul(sqrtPriceUpperX64.sub(sqrtPriceX64))
    .div(sqrtPriceX64)
    .div(sqrtPriceUpperX64);
  const tokenBAmountX64 = liquidityX64.mul(sqrtPriceX64.sub(sqrtPriceLowerX64));

  return {
    minTokenA: DecimalUtil.toU64(fromX64(tokenAAmountX64), tokenAMintInfo.decimals),
    minTokenB: DecimalUtil.toU64(fromX64(tokenBAmountX64), tokenBMintInfo.decimals),
    liquidity,
  };
}

export function getRemoveLiquidityQuoteWhenPositionIsAboveRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  // TODO: Use slippage tolerance here

  const { position, tokenBMintInfo, liquidity, slippageTolerence } = param;

  const liquidityX64 = toX64(DecimalUtil.fromU64(liquidity));
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickLowerIndex));
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(new Decimal(position.tickUpperIndex));

  const tokenBAmountX64 = liquidityX64.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

  return {
    minTokenA: new u64(0),
    minTokenB: DecimalUtil.toU64(fromX64(tokenBAmountX64), tokenBMintInfo.decimals),
    liquidity,
  };
}
