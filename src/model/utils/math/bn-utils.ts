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
   * Convert u64 value to q64.64 by shifting left 64 bits.
   *
   * @param value_U64 u64 big number
   * @returns q64.64 big number
   */
  public static u64ToQ64x64(value_U64: BN): BN {
    return value_U64.shln(64);
  }

  /**
   * Convert q64.64 value to u64 by shifting right 64 bits.
   *
   * @param value_Q64x64 q64.64 big number
   * @returns u64 big number
   */
  public static floorQ64x64(value_Q64x64: BN): BN {
    const intValue = value_Q64x64.shrn(64);
    invariant(intValue.bitLength() <= 64, "value exeeds u64");
    return intValue;
  }

  /**
   * Convert q64.64 value to u64 by shifting right 64 bits,
   * then add 1 if the fractional value is greater than 0.
   *
   * @param value_Q64x64 _Q64x64 big number
   * @returns u64 big number
   */
  public static ceilQ64x64(value_Q64x64: BN): BN {
    const intValue = value_Q64x64.shrn(64);
    const fractionValue = value_Q64x64.and(BNUtils.u64MAX); // MASK by u64 max value

    // add 1 to intValue if fractional bits are greater than 0
    if (fractionValue.gt(new BN(0))) {
      return intValue.add(new BN(1));
    }

    return intValue;
  }
}
