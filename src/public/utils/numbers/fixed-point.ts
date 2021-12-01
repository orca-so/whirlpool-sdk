import BN from "bn.js";
import invariant from "tiny-invariant";

// TODO bit shift, exponent, logarithms

/**
 * Wrapper around BN to represent fixed point Q numbers (e.g. Q64.64)
 */
export class Q {
  public readonly value: BN;
  public readonly left: number; // integar part bit length
  public readonly right: number; // fraction part bit length

  constructor(value: BN, left: number, right = 0) {
    invariant(value.bitLength() === left + right, "Q bitLength match");
    this.value = value;
    this.left = left;
    this.right = right;
  }

  public get integar(): BN {
    return this.value.shrn(this.right);
  }

  public add(other: Q): Q {
    const { x, y } = lineUpFixedPointNumbers(this, other);
    const z = x.value.add(y.value);
    return new Q(z, z.bitLength() - x.right, x.right);
  }

  public sub(other: Q): Q {
    const { x, y } = lineUpFixedPointNumbers(this, other);
    const z = x.value.sub(y.value);
    return new Q(z, z.bitLength() - x.right, x.right);
  }

  public mul(other: Q): Q {
    const { x, y } = lineUpFixedPointNumbers(this, other);
    const z = x.value.mul(y.value);
    return new Q(z, z.bitLength() - x.right, x.right);
  }

  public div(other: Q): Q {
    const { x, y } = lineUpFixedPointNumbers(this, other);
    const z = x.value.div(y.value);
    return new Q(z, z.bitLength() - x.right, x.right);
  }

  public resize(left: number, right: number): Q {
    throw new Error("TODO - implement");
  }

  public copy() {
    return new Q(this.value.clone(), this.left, this.right);
  }

  public toBuffer(): Buffer {
    throw new Error("TODO - implement");
  }

  public static fromBuffer(buffer: Buffer, left: number, right = 0): Q {
    const bitLength = left + right;
    throw new Error("TODO - implement");
  }

  public static fromIntNumber(int: number): Q {
    const n = new BN(Math.floor(int));
    return new Q(n, n.bitLength(), 0);
  }
}

function lineUpFixedPointNumbers(x: Q, y: Q): { x: Q; y: Q } {
  if (x.right > y.right) {
    y = new Q(y.value.shln(x.right - y.right), y.left, x.right);
  } else {
    x = new Q(x.value.shln(y.right - x.right), x.left, y.right);
  }
  return { x, y };
}
