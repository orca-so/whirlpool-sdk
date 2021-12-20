import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export interface PositionRewardInfo {
  readonly growthInsideCheckpointX64: BN;
  readonly amountOwedU64: BN;
}

export interface PositionAccount {
  readonly whirlpool: PublicKey;

  readonly positionMint: PublicKey;
  readonly liquidityU64: BN;
  readonly tickLower: number;
  readonly tickUpper: number;

  readonly feeGrowthCheckpointAX64: BN;
  readonly feeOwedAU64: BN;

  readonly feeGrowthCheckpointBX64: BN;
  readonly feeOwedBU64: BN;

  readonly rewardInfos: [PositionRewardInfo, PositionRewardInfo, PositionRewardInfo];
}
