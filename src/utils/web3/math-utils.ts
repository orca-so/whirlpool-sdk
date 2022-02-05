import { BN } from "@project-serum/anchor";

export const U64_MAX = new BN(2).pow(new BN(64)).sub(new BN(1));

export const ZERO = new BN(0);

export function shiftRightRoundUp(n: BN): BN {
  let result = n.shrn(64);

  if (n.mod(U64_MAX).gt(new BN(0))) {
    result = result.add(new BN(1));
  }

  return result;
}
