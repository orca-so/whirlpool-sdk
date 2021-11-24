import JSBI from "jsbi";
import { NUM_TICKS_IN_ARRAY } from "../constants";

export const TickMin = 0;
export const TickMax = NUM_TICKS_IN_ARRAY - 1;

export interface Tick {
  readonly initialized: number; // u8
  readonly liquidityNet: JSBI; // i64
  readonly liquidity_gross: JSBI; // u64

  readonly feeGrowthOutsideA: JSBI; // u256
  readonly feeGrowthOutsideB: JSBI; // u256

  readonly rewardGrowthOutside0: JSBI; // u256
  readonly rewardGrowthOutside1: JSBI; // u256
  readonly rewardGrowthOutside2: JSBI; // u256
}
