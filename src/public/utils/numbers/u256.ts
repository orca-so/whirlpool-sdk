import BN from "bn.js";
import invariant from "tiny-invariant";

export class u256 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 32) {
      return b;
    }
    invariant(b.length < 32, "u256 too large");

    const zeroPad = Buffer.alloc(32);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a u256 from Buffer representation
   */
  static fromBuffer(buffer: Buffer): u256 {
    invariant(buffer.length === 32, `Invalid buffer length: ${buffer.length}`);
    return new u256(
      [...buffer]
        .reverse()
        .map((i) => `00${i.toString(16)}`.slice(-2))
        .join(""),
      16
    );
  }
}
