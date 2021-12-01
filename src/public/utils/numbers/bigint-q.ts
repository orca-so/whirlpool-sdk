import JSBI from "jsbi";

const TEN = JSBI.BigInt("10");

export class BigIntQ {
  public readonly value: JSBI;
  public readonly left: number;
  public readonly right: number;

  constructor(value: JSBI, left: number, right: number) {
    this.value = value;
    this.left = left;
    this.right = right;
  }

  public add(other: BigIntQ): BigIntQ {
    const { x, y } = lineUpQNumbers(this, other);
    const z = JSBI.add(x.value, y.value);
    return new BigIntQ(z, z.toString().length - x.right, x.right);
  }

  public sub(other: BigIntQ): BigIntQ {
    const { x, y } = lineUpQNumbers(this, other);
    const z = JSBI.subtract(x.value, y.value);
    return new BigIntQ(z, z.toString().length - x.right, x.right);
  }

  public mul(other: BigIntQ): BigIntQ {
    const { x, y } = lineUpQNumbers(this, other);
    const z = JSBI.multiply(x.value, y.value);
    return new BigIntQ(z, z.toString().length - x.right, x.right);
  }

  public div(other: BigIntQ): BigIntQ {
    const { x, y } = lineUpQNumbers(this, other);
    const z = JSBI.divide(x.value, y.value);
    return new BigIntQ(z, z.toString().length - x.right, x.right);
  }

  public resize(left: number, right: number): BigIntQ {
    throw new Error("TODO - implement");
  }

  public copy() {
    return new BigIntQ(this.value, this.left, this.right);
  }

  public get size(): number {
    return this.left + this.right;
  }

  public toBuffer(): Buffer {
    throw new Error("TODO - implement");
  }

  public static fromBuffer(buffer: Buffer): BigIntQ {
    throw new Error("TODO - implement");
  }
}

function lineUpQNumbers(x: BigIntQ, y: BigIntQ): { x: BigIntQ; y: BigIntQ } {
  if (x.right > y.right) {
    const delta = x.right - y.right;
    const value = JSBI.multiply(y.value, JSBI.exponentiate(TEN, JSBI.BigInt(delta)));

    return { x, y: new BigIntQ(value, y.left, x.right) };
  }

  const delta = y.right - x.right;
  const value = JSBI.multiply(x.value, JSBI.exponentiate(TEN, JSBI.BigInt(delta)));

  return { x: new BigIntQ(value, x.left, y.right), y };
}
