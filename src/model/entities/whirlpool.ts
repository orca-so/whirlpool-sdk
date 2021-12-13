import { PublicKey } from "@solana/web3.js";
import { PositionAccount } from ".";
import { u64 } from "@solana/spl-token";
import { PositionStatus, Percentage, q64 } from "../../public";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements } from "./types";

export interface WhirlpoolRewardInfo {
  readonly mint: PublicKey;
  readonly vault: PublicKey;
  readonly authority: PublicKey;
  readonly emissionsPerSecondX64: q64;
  readonly growthGlobalX64: q64;
}

export interface WhirlpoolAccount {
  readonly whirlpoolsConfig: PublicKey;
  readonly whirlpoolBump: number;

  readonly feeRate: number;
  readonly protocolFeeRate: number;

  readonly liquidity: u64;
  readonly sqrtPrice: q64;
  readonly tickArrayStart: number;
  readonly tickCurrentIndex: number;

  readonly protocolFeeOwedA: u64;
  readonly protocolFeeOwedB: u64;

  readonly tokenMintA: PublicKey;
  readonly tokenVaultA: PublicKey;
  readonly feeGrowthGlobalA: q64;

  readonly tokenMintB: PublicKey;
  readonly tokenVaultB: PublicKey;
  readonly feeGrowthGlobalB: q64;

  readonly rewardLastUpdatedTimestamp: u64;

  readonly rewardInfos: [WhirlpoolRewardInfo, WhirlpoolRewardInfo, WhirlpoolRewardInfo];
}

@staticImplements<ParsableEntity<WhirlpoolAccount>>()
export class WhirlpoolEntity {
  private constructor() {}

  public static getPositionStatus(
    whirlpool: WhirlpoolAccount,
    position: PositionAccount
  ): PositionStatus {
    const { tickCurrentIndex } = whirlpool;
    const { tickLower, tickUpper } = position;

    if (tickCurrentIndex < tickLower) {
      return PositionStatus.BelowRange;
    } else if (tickCurrentIndex <= tickUpper) {
      return PositionStatus.InRange;
    } else {
      return PositionStatus.AboveRange;
    }
  }

  public static isRewardInitialized(rewardInfo: WhirlpoolRewardInfo): boolean {
    return !PublicKey.default.equals(rewardInfo.mint);
  }

  // Should ideally return a fraction (but our percentage class is a fraction, so using that for now)
  public static getFeeRate(account: WhirlpoolAccount): Percentage {
    // TODO: This method should parse this.account.feeRate which is a number (u16) and generate a Fraction that can be easily used by the caller for math
    throw new Error("TODO - Implement");
  }

  // Should ideally return a fraction (but our percentage class is a fraction, so using that for now)
  public static getProtocolFeeRate(account: WhirlpoolAccount): Percentage {
    // TODO: This method should parse this.account.protocolFeeRate which is a number (u16) and generate a Fraction that can be easily used by the caller for math
    throw new Error("TODO - Implement");
  }

  public static deriveAddress(
    whirlpoolsConfig: PublicKey,
    programId: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey
  ): PublicKey {
    return PDA.derive(programId, ["whirlpool", whirlpoolsConfig, tokenMintA, tokenMintB]).publicKey;
  }

  public static parse(accountData: Buffer | undefined | null): WhirlpoolAccount | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    throw new Error("TODO - implement");
  }
}
