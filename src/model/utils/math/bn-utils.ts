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
    invariant(valueU64.bitLength() <= 64, "u64ToX64 - valueU64 exceeds u64");
    return valueU64.shln(64);
  }

  /**
   * Convert x64 value to u64 by shifting right 64 bits.
   *
   * @param valueX64 x64 big number
   * @returns u64 big number
   */
  public static x64ToU64Floor(valueX64: BN): BN {
    invariant(valueX64.bitLength() <= 128, "x64ToU64Floor - valueX64 exceeds x64");
    const intValue = valueX64.shrn(64);
    return intValue;
  }

  /**
   * Convert x64 value to u64 by shifting right 64 bits,
   * then add 1 if the fractional value is greater than 0.
   *
   * @param valueX64 x64 big number
   * @returns u64 big number
   */
  public static x64ToU64Ceil(valueX64: BN): BN {
    invariant(valueX64.bitLength() <= 128, "x64ToU64Ceil - valueX64 exceeds x64");
    const intValue = valueX64.shrn(64);
    const fractionValue = valueX64.and(BNUtils.u64MAX); // MASK by u64 max value

    // add 1 to intValue if fractional bits are greater than 0
    if (fractionValue.gt(new BN(0))) {
      return intValue.add(new BN(1));
    }

    return intValue;
  }

  /**
   * Multiply two x64 big numbers, by first multiplying then shifting.
   *
   * @param aX64 x64 big number
   * @param bX64 x64 big number
   * @returns x64 big number
   */
  public static mulX64(aX64: BN, bX64: BN): BN {
    invariant(aX64.bitLength() <= 128, "mulX64 - aX64 exceeds x64");
    invariant(bX64.bitLength() <= 128, "mulX64 - bX64 exceeds x64");
    const resultU256 = aX64.mul(bX64);
    return resultU256.shrn(128);
  }

  /**
   * Divide two x64 big numbers, by , then floor.
   *
   * @param aX64 x64 big number
   * @param bX64 x64 big number
   * @returns x64 big number
   */
  public static divFloorX64(aX64: BN, bX64: BN): BN {
    invariant(aX64.bitLength() <= 128, "divFloorX64 - aX64 exceeds x64");
    invariant(bX64.bitLength() <= 128, "divFloorX64 - bX64 exceeds x64");
    throw new Error("TODO - implement");
  }

  /**
   * Divide two x64 big numbers, by , then ceil.
   *
   * @param aX64 x64 big number
   * @param bX64 x64 big number
   * @returns x64 big number
   */
  public static divCeilX64(aX64: BN, bX64: BN): BN {
    invariant(aX64.bitLength() <= 128, "divCeilX64 - aX64 exceeds x64");
    invariant(bX64.bitLength() <= 128, "divCeilX64 - bX64 exceeds x64");
    throw new Error("TODO - implement");
  }

  /**
   * Calculate sqrt of a x64 big number.
   *
   * @param valueX64 x64 big number
   * @returns x64 big number
   */
  public static sqrtX64(valueX64: BN): BN {
    throw new Error("TODO - implement");
  }
}
