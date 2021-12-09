import BN from "bn.js";
import invariant from "tiny-invariant";

export class u128 extends BN {
  public static readonly MAX: u128 = new u128("ffffffffffffffffffffffffffffffff", "hex");

  /**
   * Convert to Buffer representation
   */
  public toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 16) {
      return b;
    }
    invariant(b.length < 16, "u128 too large");

    const zeroPad = Buffer.alloc(16);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a u128 from Buffer representation
   */
  public static fromBuffer(buffer: Buffer): u128 {
    invariant(buffer.length === 16, `Invalid buffer length: ${buffer.length}`);
    return new u128(
      [...buffer]
        .reverse()
        .map((i) => `00${i.toString(16)}`.slice(-2))
        .join(""),
      16
    );
  }

  public mulDivRoundingUp(mulBy: u128, divProductBy: u128): u128 {
    throw new Error("TODO");
  }

  public divRoundingUp(divBy: u128): u128 {
    throw new Error("TODO");
  }

  public subU128(amount: u128): u128 {
    return new u128(this.sub(amount));
  }
}
