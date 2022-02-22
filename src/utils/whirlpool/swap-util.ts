import BN from "bn.js";
import { divRoundUp } from "../web3/math-utils";

export function getLowerSqrtPriceFromTokenA(amount: BN, liquidity: BN, sqrtPriceX64: BN): BN {
  const numerator = liquidity.mul(sqrtPriceX64).shln(64);
  const denominator = liquidity.shln(64).add(amount.mul(sqrtPriceX64));

  // always round up
  return divRoundUp(numerator, denominator);
}

export function getUpperSqrtPriceFromTokenA(amount: BN, liquidity: BN, sqrtPriceX64: BN): BN {
  const numerator = liquidity.mul(sqrtPriceX64).shln(64);
  const denominator = liquidity.shln(64).sub(amount.mul(sqrtPriceX64));

  // always round up
  return divRoundUp(numerator, denominator);
}

export function getLowerSqrtPriceFromTokenB(amount: BN, liquidity: BN, sqrtPriceX64: BN): BN {
  // always round down
  return sqrtPriceX64.sub(divRoundUp(amount.shln(64), liquidity));
}

export function getUpperSqrtPriceFromTokenB(amount: BN, liquidity: BN, sqrtPriceX64: BN): BN {
  // always round down (rounding up a negative number)
  return sqrtPriceX64.add(amount.shln(64).div(liquidity));
}
