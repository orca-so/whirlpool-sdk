import BN from "bn.js";

export function getLowerSqrtPriceFromTokenA(
  amount: BN,
  liquidity: BN,
  sqrtPriceX64: BN,
  roundUp: boolean
): BN {
  const numerator = liquidity.mul(sqrtPriceX64);
  const denominator = amount.mul(sqrtPriceX64).add(liquidity.shln(64));

  if (roundUp) {
    return numerator.divRound(denominator);
  } else {
    return numerator.div(denominator);
  }
}

export function getUpperSqrtPriceFromTokenA(
  amount: BN,
  liquidity: BN,
  sqrtPriceX64: BN,
  roundUp: boolean
): BN {
  const numerator = liquidity.mul(sqrtPriceX64);
  const denominator = amount.mul(sqrtPriceX64).sub(liquidity.shln(64));

  if (roundUp) {
    return numerator.divRound(denominator);
  } else {
    return numerator.div(denominator);
  }
}

export function getLowerSqrtPriceFromTokenB(amount: BN, liquidity: BN, sqrtPriceX64: BN): BN {
  return sqrtPriceX64.add(amount.shln(64).div(liquidity));
}

export function getUpperSqrtPriceFromTokenB(amount: BN, liquidity: BN, sqrtPriceX64: BN): BN {
  return sqrtPriceX64.sub(amount.shln(64).divRound(liquidity));
}
