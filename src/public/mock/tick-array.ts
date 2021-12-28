import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export interface TickData {
  readonly index: number;
  readonly initialized: boolean;
  readonly liquidityNetI64: BN;
  readonly liquidityGrossU64: BN;

  readonly feeGrowthOutsideAX64: BN;
  readonly feeGrowthOutsideBX64: BN;

  readonly rewardGrowthsOutsideX64: [BN, BN, BN];
}

export interface TickArrayData {
  readonly whirlpool: PublicKey;
  readonly startTick: number;
  readonly ticks: TickData[];
}
