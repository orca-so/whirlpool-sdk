import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../../utils/public/percentage";
import { RemoveLiquidityQuote } from "../public";

export type InternalRemoveLiquidityQuoteParam = {
  address: PublicKey;
  whirlpool: WhirlpoolData;
  position: PositionData;
  liquidity: u64;
  slippageTolerence: Percentage;
};

export function getRemoveLiquidityQuoteWhenPositionIsBelowRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const { address, position, liquidity, slippageTolerence } = param;

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);

  const tokenAmountA = liquidity
    .shln(64)
    .mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
    .div(sqrtPriceLowerX64)
    .div(sqrtPriceUpperX64);
  const tokenAmountAAfterSlippage = tokenAmountA
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    address,
    minTokenA: new u64(tokenAmountAAfterSlippage),
    minTokenB: new u64(0),
    liquidity,
  };
}

export function getRemoveLiquidityQuoteWhenPositionIsInRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const { address, whirlpool, position, liquidity, slippageTolerence } = param;

  const sqrtPriceX64 = whirlpool.sqrtPrice;
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);

  const tokenAmountA = liquidity
    .shln(64)
    .mul(sqrtPriceUpperX64.sub(sqrtPriceX64))
    .div(sqrtPriceX64)
    .div(sqrtPriceUpperX64);
  const tokenAmountB = liquidity.mul(sqrtPriceX64.sub(sqrtPriceLowerX64)).shrn(64);

  const tokenAmountAAfterSlippage = tokenAmountA
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));
  const tokenAmountBAfterSlippage = tokenAmountB
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    address,
    minTokenA: new u64(tokenAmountAAfterSlippage),
    minTokenB: new u64(tokenAmountBAfterSlippage),
    liquidity,
  };
}

export function getRemoveLiquidityQuoteWhenPositionIsAboveRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const { address, position, liquidity, slippageTolerence } = param;

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(position.tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(position.tickUpperIndex);

  const tokenAmountB = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64)).shrn(64);
  const tokenAmountBAfterSlippage = tokenAmountB
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    address,
    minTokenA: new u64(0),
    minTokenB: new u64(tokenAmountBAfterSlippage),
    liquidity,
  };
}
