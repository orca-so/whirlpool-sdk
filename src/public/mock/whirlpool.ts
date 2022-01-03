import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export interface WhirlpoolRewardInfoData {
  readonly mint: PublicKey;
  readonly vault: PublicKey;
  readonly authority: PublicKey;
  readonly emissionsPerSecondX64: BN;
  readonly growthGlobalX64: BN;
}

export interface WhirlpoolData {
  readonly whirlpoolsConfig: PublicKey;
  readonly whirlpoolBump: number;

  readonly feeRate: number;
  readonly protocolFeeRate: number;

  readonly liquidityU64: BN;
  readonly sqrtPriceX64: BN;
  readonly tickArrayStart: number;
  readonly tickCurrentIndex: number;

  readonly protocolFeeOwedAU64: BN;
  readonly protocolFeeOwedBU64: BN;

  readonly tokenMintA: PublicKey;
  readonly tokenVaultA: PublicKey;
  readonly feeGrowthGlobalAX64: BN;

  readonly tokenMintB: PublicKey;
  readonly tokenVaultB: PublicKey;
  readonly feeGrowthGlobalBX64: BN;

  readonly rewardLastUpdatedTimestampU64: BN;

  readonly rewardInfos: [WhirlpoolRewardInfoData, WhirlpoolRewardInfoData, WhirlpoolRewardInfoData];
}
