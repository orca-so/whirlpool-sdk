import invariant from "tiny-invariant";
import { q64, u256 } from "../..";

// TODO update comments
export abstract class TickMath {
  private constructor() {}

  /**
   * given that in Solana, the maximum token amount is a u64, and
   *       tick-spacing of 0.0001.
   * max/min tick index is log_b(2^64) = {443,636, -443,636}, if b = 1.0001
   * and we need 19 bits to fit this number as 2^18 < 443,636 < 2^19
   */
  public static MAX_TICK: number = 443_636;
  public static MIN_TICK: number = -443_636;

  /**
   * Returns the sqrt ratio as a Q64.64 for the given tick. The sqrt ratio is computed as sqrt(1.0001)^tick
   * @param tick the tick for which to compute the sqrt ratio
   */
  public static sqrtPriceAtTick(tick: number): q64 {
    const absTick = Math.abs(tick);

    invariant(Number.isInteger(tick), "tick is not an integer");
    invariant(absTick <= TickMath.MAX_TICK, "tick is too large");

    let ratio: u256 =
      (absTick & 0x1) != 0
        ? new u256("fffcb933bd6fad37aa2d162d1a594001", "hex")
        : new u256("100000000000000000000000000000000", "hex");
    if ((absTick & 0x2) != 0)
      ratio.imul(new u256("fff97272373d413259a46990580e213a", "hex")).ishrn(128);
    if ((absTick & 0x4) != 0)
      ratio.imul(new u256("fff2e50f5f656932ef12357cf3c7fdcc", "hex")).ishrn(128);
    if ((absTick & 0x8) != 0)
      ratio.imul(new u256("ffe5caca7e10e4e61c3624eaa0941cd0", "hex")).ishrn(128);
    if ((absTick & 0x10) != 0)
      ratio.imul(new u256("ffcb9843d60f6159c9db58835c926644", "hex")).ishrn(128);
    if ((absTick & 0x20) != 0)
      ratio.imul(new u256("ff973b41fa98c081472e6896dfb254c0", "hex")).ishrn(128);
    if ((absTick & 0x40) != 0)
      ratio.imul(new u256("ff2ea16466c96a3843ec78b326b52861", "hex")).ishrn(128);
    if ((absTick & 0x80) != 0)
      ratio.imul(new u256("fe5dee046a99a2a811c461f1969c3053", "hex")).ishrn(128);
    if ((absTick & 0x100) != 0)
      ratio.imul(new u256("fcbe86c7900a88aedcffc83b479aa3a4", "hex")).ishrn(128);
    if ((absTick & 0x200) != 0)
      ratio.imul(new u256("f987a7253ac413176f2b074cf7815e54", "hex")).ishrn(128);
    if ((absTick & 0x400) != 0)
      ratio.imul(new u256("f3392b0822b70005940c7a398e4b70f3", "hex")).ishrn(128);
    if ((absTick & 0x800) != 0)
      ratio.imul(new u256("e7159475a2c29b7443b29c7fa6e889d9", "hex")).ishrn(128);
    if ((absTick & 0x1000) != 0)
      ratio.imul(new u256("d097f3bdfd2022b8845ad8f792aa5825", "hex")).ishrn(128);
    if ((absTick & 0x2000) != 0)
      ratio.imul(new u256("a9f746462d870fdf8a65dc1f90e061e5", "hex")).ishrn(128);
    if ((absTick & 0x4000) != 0)
      ratio.imul(new u256("70d869a156d2a1b890bb3df62baf32f7", "hex")).ishrn(128);
    if ((absTick & 0x8000) != 0)
      ratio.imul(new u256("31be135f97d08fd981231505542fcfa6", "hex")).ishrn(128);
    if ((absTick & 0x10000) != 0)
      ratio.imul(new u256("9aa508b5b7a84e1c677de54f3e99bc9", "hex")).ishrn(128);
    if ((absTick & 0x20000) != 0)
      ratio.imul(new u256("5d6af8dedb81196699c329225ee604", "hex")).ishrn(128);
    if ((absTick & 0x40000) != 0)
      ratio.imul(new u256("2216e584f5fa1ea926041bedfe98", "hex")).ishrn(128);

    // The ratio is calculated with inversed constants to prevent overflowing.
    // Inverse the ratio if we are calculating for a positive tick.
    if (tick > 0) ratio = u256.MAX.div(ratio);

    // Cast back to Q64.64. Any value within tick range will fit in a u128.
    ratio.ishrn(64);
    invariant(ratio.bitLength() <= 128, "ratio exceeds 128 bits");

    return ratio;
  }

  /**
   * Returns the tick corresponding to a given sqrt ratio, s.t. #getSqrtRatioAtTick(tick) <= sqrtRatioX96
   * and #getSqrtRatioAtTick(tick + 1) > sqrtRatioX96
   * @param sqrtRatio the sqrt ratio as a Q64.96 for which to compute the tick
   */
  public static tickAtSqrtPrice(sqrtRatio: q64): number {
    throw new Error("TODO - implement");
  }
}
