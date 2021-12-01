import JSBI from "jsbi";

export class BigIntQ {
  private _value: JSBI;
  private _left: number;
  private _right: number;

  constructor(value: JSBI, left: number, right: number) {
    this._value = value;
    this._left = left;
    this._right = right;
  }

  public add(n: BigIntQ): BigIntQ {
    throw new Error("TODO - implement");
  }

  public sub(n: BigIntQ): BigIntQ {
    throw new Error("TODO - implement");
  }

  public mul(n: BigIntQ): BigIntQ {
    throw new Error("TODO - implement");
  }

  public div(n: BigIntQ): BigIntQ {
    throw new Error("TODO - implement");
  }

  public resize(left: number, right: number): BigIntQ {
    throw new Error("TODO - implement");
  }

  public copy() {
    return new BigIntQ(this._value, this._left, this._right);
  }

  public get size(): number {
    return this._left + this._right;
  }

  public toBuffer(): Buffer {
    throw new Error("TODO - implement");
  }

  public static fromBuffer(buffer: Buffer): BigIntQ {
    throw new Error("TODO - implement");
  }
}
