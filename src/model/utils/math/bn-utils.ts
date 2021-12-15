import BN from "bn.js";
import invariant from "tiny-invariant";

export class BNUtils {
  public static readonly u64MAX = new BN("ffffffffffffffff", "hex");

  public static readonly u128MAX = new BN("ffffffffffffffffffffffffffffffff", "hex");

  public static readonly u256MAX = new BN(
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "hex"
  );

  /**
   * Convert u64 value to x64 by shifting left 64 bits.
   *
   * @param valueU64 u64 big number
   * @returns x64 big number
   */
  public static u64ToX64(valueU64: BN): BN {
    return valueU64.shln(64);
  }

  /**
   * Convert x64 value to u64 by shifting right 64 bits.
   *
   * @param valueX64 x64 big number
   * @returns u64 big number
   */
  public static floorX64(valueX64: BN): BN {
    const intValue = valueX64.shrn(64);
    invariant(intValue.bitLength() <= 64, "value exeeds u64");
    return intValue;
  }

  /**
   * Convert x64 value to u64 by shifting right 64 bits,
   * then add 1 if the fractional value is greater than 0.
   *
   * @param valueX64 x64 big number
   * @returns u64 big number
   */
  public static ceilX64(valueX64: BN): BN {
    const intValue = valueX64.shrn(64);
    const fractionValue = valueX64.and(BNUtils.u64MAX); // MASK by u64 max value

    // add 1 to intValue if fractional bits are greater than 0
    if (fractionValue.gt(new BN(0))) {
      return intValue.add(new BN(1));
    }

    return intValue;
  }
}
