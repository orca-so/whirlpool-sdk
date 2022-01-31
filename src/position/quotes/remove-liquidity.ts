import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../../utils/public/percentage";
import { PositionStatus, PositionUtil } from "../../utils/whirlpool/position-util";
import { RemoveLiquidityQuote } from "../public";

export type InternalRemoveLiquidityQuoteParam = {
  positionAddress: PublicKey;
  whirlpool: WhirlpoolData;
  tickLowerIndex: number;
  tickUpperIndex: number;
  liquidity: u64;
  slippageTolerence: Percentage;
};

export function getInternalRemoveLiquidityQuote(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const positionStatus = PositionUtil.getPositionStatus(
    param.whirlpool.tickCurrentIndex,
    param.tickLowerIndex,
    param.tickUpperIndex
  );

  switch (positionStatus) {
    case PositionStatus.BelowRange:
      return getRemoveLiquidityQuoteWhenPositionIsBelowRange(param);
    case PositionStatus.InRange:
      return getRemoveLiquidityQuoteWhenPositionIsInRange(param);
    case PositionStatus.AboveRange:
      return getRemoveLiquidityQuoteWhenPositionIsAboveRange(param);
    default:
      throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
  }
}

function getRemoveLiquidityQuoteWhenPositionIsBelowRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const { positionAddress, tickLowerIndex, tickUpperIndex, liquidity, slippageTolerence } = param;

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  const tokenAmountA = liquidity
    .shln(64)
    .mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
    .div(sqrtPriceLowerX64)
    .div(sqrtPriceUpperX64);
  const tokenAmountAAfterSlippage = tokenAmountA
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    positionAddress,
    minTokenA: new u64(tokenAmountAAfterSlippage),
    minTokenB: new u64(0),
    liquidity,
  };
}

function getRemoveLiquidityQuoteWhenPositionIsInRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const {
    positionAddress,
    whirlpool,
    tickLowerIndex,
    tickUpperIndex,
    liquidity,
    slippageTolerence,
  } = param;

  const sqrtPriceX64 = whirlpool.sqrtPrice;
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

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
    positionAddress,
    minTokenA: new u64(tokenAmountAAfterSlippage),
    minTokenB: new u64(tokenAmountBAfterSlippage),
    liquidity,
  };
}

function getRemoveLiquidityQuoteWhenPositionIsAboveRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const { positionAddress, tickLowerIndex, tickUpperIndex, liquidity, slippageTolerence } = param;

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  const tokenAmountB = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64)).shrn(64);
  const tokenAmountBAfterSlippage = tokenAmountB
    .mul(slippageTolerence.denominator)
    .div(slippageTolerence.numerator.add(slippageTolerence.denominator));

  return {
    positionAddress,
    minTokenA: new u64(0),
    minTokenB: new u64(tokenAmountBAfterSlippage),
    liquidity,
  };
}
