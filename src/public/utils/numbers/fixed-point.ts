import { u64 } from "@solana/spl-token";
import BN from "bn.js";
import invariant from "tiny-invariant";
import { OrcaU64 } from ".";

// TODO bit shift, exponent, logarithms

/**
 * Wrapper around BN to represent fixed point Q numbers (e.g. Q64.64)
 */
export class Q {
  public readonly value: BN;
  public readonly precision: number; // fraction part bit length

  constructor(value: BN, precision = 0) {
    this.value = value;
    this.precision = precision;
  }

  public get integar(): BN {
    return this.value.shrn(this.precision);
  }

  public add(other: Q): Q {
    const { x, y } = lineUpFixedPointNumbers(this, other);
    const z = x.value.add(y.value);
    return new Q(z, x.precision);
  }

  public sub(other: Q): Q {
    const { x, y } = lineUpFixedPointNumbers(this, other);
    const z = x.value.sub(y.value);
    return new Q(z, x.precision);
  }

  public mul(other: Q): Q {
    const { x, y } = lineUpFixedPointNumbers(this, other);
    const z = x.value.mul(y.value);
    return new Q(z, x.precision);
  }

  public div(other: Q): Q {
    const { x, y } = lineUpFixedPointNumbers(this, other);
    const z = x.value.div(y.value);
    return new Q(z, x.precision);
  }

  public copy() {
    return new Q(this.value.clone(), this.precision);
  }

  public toBuffer(): Buffer {
    throw new Error("TODO - implement");
  }

  public static fromBuffer(buffer: Buffer, left: number, right = 0): Q {
    const bitLength = left + right;
    throw new Error("TODO - implement");
  }

  public static fromIntNumber(value: number): Q {
    return new Q(new BN(Math.floor(value)), 0);
  }

  public static fromU64(value: u64): Q {
    return new Q(value, 0);
  }
}

function lineUpFixedPointNumbers(x: Q, y: Q): { x: Q; y: Q } {
  if (x.precision > y.precision) {
    y = new Q(y.value.shln(x.precision - y.precision), x.precision);
  } else {
    x = new Q(x.value.shln(y.precision - x.precision), y.precision);
  }
  return { x, y };
}
