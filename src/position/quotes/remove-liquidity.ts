import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { BN } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../../utils/public/percentage";
import { ZERO } from "../../utils/web3/math-utils";
import {
  adjustForSlippage,
  getTokenAFromLiquidity,
  getTokenBFromLiquidity,
  PositionStatus,
  PositionUtil,
} from "../../utils/public/position-util";
import { RemoveLiquidityQuote } from "../public";

export type InternalRemoveLiquidityQuoteParam = {
  positionAddress: PublicKey;
  tickCurrentIndex: number;
  sqrtPrice: BN;
  tickLowerIndex: number;
  tickUpperIndex: number;
  liquidity: u64;
  slippageTolerance: Percentage;
};

export function getRemoveLiquidityQuote(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const positionStatus = PositionUtil.getPositionStatus(
    param.tickCurrentIndex,
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
  const { positionAddress, tickLowerIndex, tickUpperIndex, liquidity, slippageTolerance } = param;

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  const minTokenA = adjustForSlippage(
    getTokenAFromLiquidity(liquidity, sqrtPriceLowerX64, sqrtPriceUpperX64, false),
    slippageTolerance,
    false
  );

  return {
    positionAddress,
    minTokenA,
    minTokenB: ZERO,
    liquidity,
  };
}

function getRemoveLiquidityQuoteWhenPositionIsInRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const {
    positionAddress,
    sqrtPrice,
    tickLowerIndex,
    tickUpperIndex,
    liquidity,
    slippageTolerance,
  } = param;

  const sqrtPriceX64 = sqrtPrice;
  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  const minTokenA = adjustForSlippage(
    getTokenAFromLiquidity(liquidity, sqrtPriceX64, sqrtPriceUpperX64, false),
    slippageTolerance,
    false
  );
  const minTokenB = adjustForSlippage(
    getTokenBFromLiquidity(liquidity, sqrtPriceLowerX64, sqrtPriceX64, false),
    slippageTolerance,
    false
  );

  return {
    positionAddress,
    minTokenA,
    minTokenB,
    liquidity,
  };
}

function getRemoveLiquidityQuoteWhenPositionIsAboveRange(
  param: InternalRemoveLiquidityQuoteParam
): RemoveLiquidityQuote {
  const {
    positionAddress,
    tickLowerIndex,
    tickUpperIndex,
    liquidity,
    slippageTolerance: slippageTolerance,
  } = param;

  const sqrtPriceLowerX64 = tickIndexToSqrtPriceX64(tickLowerIndex);
  const sqrtPriceUpperX64 = tickIndexToSqrtPriceX64(tickUpperIndex);

  const minTokenB = adjustForSlippage(
    getTokenBFromLiquidity(liquidity, sqrtPriceLowerX64, sqrtPriceUpperX64, false),
    slippageTolerance,
    false
  );

  return {
    positionAddress,
    minTokenA: ZERO,
    minTokenB,
    liquidity,
  };
}
