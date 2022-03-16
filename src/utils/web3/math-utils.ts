import { BN } from "@project-serum/anchor";

export const ZERO = new BN(0);
export const ONE = new BN(1);
export const TWO = new BN(2);

export const U128 = TWO.pow(new BN(128));
export const U64_MAX = TWO.pow(new BN(64)).sub(ONE);

export function shiftRightRoundUp(n: BN): BN {
  let result = n.shrn(64);

  if (n.mod(U64_MAX).gt(ZERO)) {
    result = result.add(ONE);
  }

  return result;
}

export function divRoundUp(n0: BN, n1: BN): BN {
  const hasRemainder = !n0.mod(n1).eq(ZERO);
  if (hasRemainder) {
    return n0.div(n1).add(new BN(1));
  } else {
    return n0.div(n1);
  }
}

export function subUnderflowU128(n0: BN, n1: BN): BN {
  return n0.add(U128).sub(n1).mod(U128);
}
