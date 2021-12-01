import BN from "bn.js";
import { NUM_TICKS_IN_ARRAY } from "../constants";

export const TickMin = 0;
export const TickMax = NUM_TICKS_IN_ARRAY - 1;

export interface Tick {
  readonly initialized: number; // u8
  readonly liquidityNet: BN; // i64
  readonly liquidity_gross: BN; // u64

  readonly feeGrowthOutsideA: BN; // u256
  readonly feeGrowthOutsideB: BN; // u256

  readonly rewardGrowthOutside0: BN; // u256
  readonly rewardGrowthOutside1: BN; // u256
  readonly rewardGrowthOutside2: BN; // u256
}
