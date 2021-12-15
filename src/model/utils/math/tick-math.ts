import BN from "bn.js";
import invariant from "tiny-invariant";
import { BNUtils } from ".";

// TODO update comments
export abstract class TickMath {
  private constructor() {}

  /**
   * given that in Solana, the maximum token amount is a u64, and
   *       tick-spacing of 0.0001.
   * max/min tick index is log_b(2^64) = {443,636, -443,636}, if b = 1.0001
   * and we need 19 bits to fit this number as 2^18 < 443,636 < 2^19
   */
  public static readonly MAX_TICK: number = 443_636;
  public static readonly MIN_TICK: number = -443_636;

  /**
   * Returns the sqrt ratio as a Q64.64 for the given tick. The sqrt ratio is computed as sqrt(1.0001)^tick
   * @param tick the tick for which to compute the sqrt ratio
   */
  public static sqrtPriceAtTick(tick: number): BN {
    const absTick = Math.abs(tick);

    invariant(Number.isInteger(tick), "tick is not an integer");
    invariant(absTick <= TickMath.MAX_TICK, "tick is too large");

    let ratioU256 =
      (absTick & 0x1) != 0
        ? new BN("fffcb933bd6fad37aa2d162d1a594001", "hex")
        : new BN("100000000000000000000000000000000", "hex");
    if ((absTick & 0x2) != 0)
      ratioU256.imul(new BN("fff97272373d413259a46990580e213a", "hex")).ishrn(128);
    if ((absTick & 0x4) != 0)
      ratioU256.imul(new BN("fff2e50f5f656932ef12357cf3c7fdcc", "hex")).ishrn(128);
    if ((absTick & 0x8) != 0)
      ratioU256.imul(new BN("ffe5caca7e10e4e61c3624eaa0941cd0", "hex")).ishrn(128);
    if ((absTick & 0x10) != 0)
      ratioU256.imul(new BN("ffcb9843d60f6159c9db58835c926644", "hex")).ishrn(128);
    if ((absTick & 0x20) != 0)
      ratioU256.imul(new BN("ff973b41fa98c081472e6896dfb254c0", "hex")).ishrn(128);
    if ((absTick & 0x40) != 0)
      ratioU256.imul(new BN("ff2ea16466c96a3843ec78b326b52861", "hex")).ishrn(128);
    if ((absTick & 0x80) != 0)
      ratioU256.imul(new BN("fe5dee046a99a2a811c461f1969c3053", "hex")).ishrn(128);
    if ((absTick & 0x100) != 0)
      ratioU256.imul(new BN("fcbe86c7900a88aedcffc83b479aa3a4", "hex")).ishrn(128);
    if ((absTick & 0x200) != 0)
      ratioU256.imul(new BN("f987a7253ac413176f2b074cf7815e54", "hex")).ishrn(128);
    if ((absTick & 0x400) != 0)
      ratioU256.imul(new BN("f3392b0822b70005940c7a398e4b70f3", "hex")).ishrn(128);
    if ((absTick & 0x800) != 0)
      ratioU256.imul(new BN("e7159475a2c29b7443b29c7fa6e889d9", "hex")).ishrn(128);
    if ((absTick & 0x1000) != 0)
      ratioU256.imul(new BN("d097f3bdfd2022b8845ad8f792aa5825", "hex")).ishrn(128);
    if ((absTick & 0x2000) != 0)
      ratioU256.imul(new BN("a9f746462d870fdf8a65dc1f90e061e5", "hex")).ishrn(128);
    if ((absTick & 0x4000) != 0)
      ratioU256.imul(new BN("70d869a156d2a1b890bb3df62baf32f7", "hex")).ishrn(128);
    if ((absTick & 0x8000) != 0)
      ratioU256.imul(new BN("31be135f97d08fd981231505542fcfa6", "hex")).ishrn(128);
    if ((absTick & 0x10000) != 0)
      ratioU256.imul(new BN("9aa508b5b7a84e1c677de54f3e99bc9", "hex")).ishrn(128);
    if ((absTick & 0x20000) != 0)
      ratioU256.imul(new BN("5d6af8dedb81196699c329225ee604", "hex")).ishrn(128);
    if ((absTick & 0x40000) != 0)
      ratioU256.imul(new BN("2216e584f5fa1ea926041bedfe98", "hex")).ishrn(128);

    // The ratio is calculated with inversed constants to prevent overflowing.
    // Inverse the ratio if we are calculating for a positive tick.
    if (tick > 0) ratioU256 = BNUtils.u256MAX.div(ratioU256);

    // Cast back to Q64.64. Any value within tick range will fit in a u128.
    const ratioX64 = ratioU256.shrn(64);
    invariant(ratioX64.bitLength() <= 128, "ratio exceeds 128 bits");

    return ratioX64;
  }

  public static readonly MAX_SQRT_PRICE_X64 = new BN("79226673515401279992447579061");
  public static readonly MIN_SQRT_PRICE_X64 = new BN("4295048016");

  public static readonly LOG_B_2_X64 = new BN("255738958999603826347141");
  public static readonly BIT_PRECISION: number = 14;
  public static readonly LOG_B_P_ERR_MARGIN_LOWER_X128 = new BN(
    "3402823669209384634633746074317682114"
  ); // 0.01
  public static readonly LOG_B_P_ERR_MARGIN_UPPER_X128 = new BN(
    "291339293782892971344202069882609108985"
  ); // 2^-precision / log_2_b + 0.01

  /**
   * Returns the tick corresponding to a given sqrt ratio, s.t. #getSqrtRatioAtTick(tick) <= sqrtRatioX96
   * and #getSqrtRatioAtTick(tick + 1) > sqrtRatioX96
   * @param sqrtRatio the sqrt ratio as a Q64.96 for which to compute the tick
   */
  public static tickAtSqrtPrice(sqrtPriceX64: BN): number {
    invariant(sqrtPriceX64.gte(TickMath.MIN_SQRT_PRICE_X64), "sqrtPriceX64 is too small");
    invariant(sqrtPriceX64.lte(TickMath.MAX_SQRT_PRICE_X64), "sqrtPriceX64 is too large");

    // Invert sqrt_price_x64 if we are dealing with a number less than 1
    let negateResult = false;
    let ratioX64 = sqrtPriceX64.clone();
    if (ratioX64.lte(BNUtils.u64MAX)) {
      negateResult = true;
      ratioX64 = BNUtils.u128MAX.div(ratioX64);
    }

    // Determine log_b(sqrt_ratio). First by calculating integer portion (msb)
    // msb always > 128. Any input with msb under 128 are inverted at the start
    const ratioX128 = ratioX64.shln(64);
    const msb = ratioX128.bitLength() - 1;

    // get fractional value (r/2^msb), msb always > 128
    const log2pFractionX128 = new BN(0);
    // We begin the iteration from bit 127 (0.5 in Q128.128)
    const bitU128 = new BN("80000000000000000000000000000000", "hex");
    let precision: number = 0;
    const log2pIntegerX64 = new BN(msb - 128).shln(64);

    // Log2 iterative approximation for the fractional part
    // Go through each 2^(j) bit where j < 128 in a Q128.128 number
    // Append current bit value to fraction result if r^2 Q2.254 is more than 2
    const r = ratioX128.shrn(msb - 127);
    const zero = new BN(0);
    while (bitU128.gt(zero) && precision < TickMath.BIT_PRECISION) {
      r.imul(r);
      const isRMoreThanTwo = 0; // TODO
      r.ishrn(127 + isRMoreThanTwo);
      log2pFractionX128.add(bitU128.mul(new BN(isRMoreThanTwo)));
      bitU128.ishrn(1);
      precision += 1;
    }

    const log2pFractionX64 = log2pFractionX128.shrn(64);
    const log2pX64 = log2pIntegerX64.add(log2pFractionX64);

    // Transform from base 2 to base b
    const logbpX128 = log2pX64.mul(TickMath.LOG_B_2_X64);

    // TODO saturating sub
    // https://github.com/orca-so/whirlpool/pull/30/files
    // https://docs.rs/primitive-types/0.6.1/primitive_types/struct.U256.html#method.saturating_sub

    // Derive tick_low & high estimate. Adjust with the possibility of under-estimating by 2^precision_bits/log_2(b) + 0.01 error margin.
    // TODO: Error state if input for sqrt_price is between -1 & 1. Such a value would yield a tick estimation that would flip signs
    // and we need additional logic to handle the difference between round up / round down.
    const tickLow: number = logbpX128
      .sub(TickMath.LOG_B_P_ERR_MARGIN_LOWER_X128)
      .shrn(128)
      .toNumber();
    const tickHigh: number = logbpX128
      .add(TickMath.LOG_B_P_ERR_MARGIN_UPPER_X128)
      .shrn(128)
      .toNumber();

    let resultTick: number = tickLow;

    // If our estimation for tick_high returns a lower sqrt_price than the input
    // then the actual tick_high has to be higher than than tick_high.
    // Otherwise, the actual value is between tick_low & tick_high, so a floor value
    // (tick_low) is returned
    if (tickLow !== tickHigh) {
      const actualTickHighSqrtPriceX64 = TickMath.sqrtPriceAtTick(tickHigh);
      if (actualTickHighSqrtPriceX64.lte(ratioX64)) {
        resultTick = tickHigh;
      }
    }

    // Negate the result if the input is less than 1
    if (negateResult) {
      resultTick *= -1;
    }

    return resultTick;
  }
}
