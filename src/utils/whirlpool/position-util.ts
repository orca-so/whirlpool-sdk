import { BN } from "@project-serum/anchor";
import { Percentage } from "../public";
import { shiftRightRoundUp } from "../web3/math-utils";

export enum PositionStatus {
  BelowRange,
  InRange,
  AboveRange,
}

export class PositionUtil {
  private constructor() {}

  public static getPositionStatus(
    tickCurrentIndex: number,
    tickLowerIndex: number,
    tickUpperIndex: number
  ): PositionStatus {
    if (tickCurrentIndex < tickLowerIndex) {
      return PositionStatus.BelowRange;
    } else if (tickCurrentIndex <= tickUpperIndex) {
      return PositionStatus.InRange;
    } else {
      return PositionStatus.AboveRange;
    }
  }
}

export function adjustForSlippage(
  n: BN,
  { numerator, denominator }: Percentage,
  adjustUp: boolean
): BN {
  if (adjustUp) {
    return n.mul(denominator.add(numerator)).div(denominator);
  } else {
    return n.mul(denominator).div(numerator.add(denominator));
  }
}

export function getLiquidityFromTokenA(
  amount: BN,
  sqrtPriceLowerX64: BN,
  sqrtPriceUpperX64: BN,
  roundUp: boolean
) {
  const result = amount
    .mul(sqrtPriceLowerX64)
    .mul(sqrtPriceUpperX64)
    .div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));
  if (roundUp) {
    return shiftRightRoundUp(result);
  } else {
    return result.shrn(64);
  }
}

export function getLiquidityFromTokenB(
  amount: BN,
  sqrtPriceLowerX64: BN,
  sqrtPriceUpperX64: BN,
  roundUp: boolean
) {
  const numerator = amount.shln(64);
  const denominator = sqrtPriceUpperX64.sub(sqrtPriceLowerX64);
  if (roundUp) {
    return numerator.divRound(denominator);
  } else {
    return numerator.div(denominator);
  }
}

export function getTokenAFromLiquidity(
  liquidity: BN,
  sqrtPriceLowerX64: BN,
  sqrtPriceUpperX64: BN,
  roundUp: boolean
) {
  const numerator = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));
  const denominator = sqrtPriceUpperX64.mul(sqrtPriceLowerX64);
  if (roundUp) {
    return numerator.divRound(denominator);
  } else {
    return numerator.div(denominator);
  }
}

export function getTokenBFromLiquidity(
  liquidity: BN,
  sqrtPriceLowerX64: BN,
  sqrtPriceUpperX64: BN,
  roundUp: boolean
) {
  const result = liquidity.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));
  if (roundUp) {
    return shiftRightRoundUp(result);
  } else {
    return result.shrn(64);
  }
}
