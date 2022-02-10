import { BN } from "@project-serum/anchor";

export const ZERO = new BN(0);
export const ONE = new BN(1);
export const TWO = new BN(2);

export const U64_MAX = TWO.pow(new BN(64)).sub(ONE);

export function shiftRightRoundUp(n: BN): BN {
  let result = n.shrn(64);

  if (n.mod(U64_MAX).gt(ZERO)) {
    result = result.add(ONE);
  }

  return result;
}
