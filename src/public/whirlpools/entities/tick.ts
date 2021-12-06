import { u64 } from "@solana/spl-token";
import BN from "bn.js";
import { q64 } from "../..";
import { NUM_TICKS_IN_ARRAY } from "../constants";

export const TickMin = 0;
export const TickMax = NUM_TICKS_IN_ARRAY - 1;

export interface Tick {
  readonly initialized: number;
  readonly liquidityNet: BN; // i64 TODO
  readonly liquidity_gross: u64;

  readonly feeGrowthOutsideA: q64;
  readonly feeGrowthOutsideB: q64;

  readonly rewardGrowthOutside0: q64;
  readonly rewardGrowthOutside1: q64;
  readonly rewardGrowthOutside2: q64;
}
