import BN from "bn.js";

export abstract class TickMath {
  private constructor() {}

  public static MIN_TICK: number = -1; // TODO
  public static MAX_TICK: number = -TickMath.MIN_TICK;

  // reference: https://github.com/orca-so/whirlpool/pull/28/files

  /**
   * Returns the sqrt ratio as a Q64.96 for the given tick. The sqrt ratio is computed as sqrt(1.0001)^tick
   * @param tick the tick for which to compute the sqrt ratio
   */
  public static getSqrtPriceAtTick(tick: number): BN {
    throw new Error("TODO - implement");
  }

  /**
   * Returns the tick corresponding to a given sqrt ratio, s.t. #getSqrtRatioAtTick(tick) <= sqrtRatioX96
   * and #getSqrtRatioAtTick(tick + 1) > sqrtRatioX96
   * @param sqrtRatio the sqrt ratio as a Q64.96 for which to compute the tick
   */
  public static getTickAtSqrtRatio(sqrtRatio: BN): number {
    throw new Error("TODO - implement");
  }
}
