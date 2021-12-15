import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../../public";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements } from "./types";
import BN from "bn.js";

export interface WhirlpoolRewardInfo {
  readonly mint: PublicKey;
  readonly vault: PublicKey;
  readonly authority: PublicKey;
  readonly emissionsPerSecondX64: BN;
  readonly growthGlobalX64: BN;
}

export interface WhirlpoolAccount {
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

  readonly rewardInfos: [WhirlpoolRewardInfo, WhirlpoolRewardInfo, WhirlpoolRewardInfo];
}

@staticImplements<ParsableEntity<WhirlpoolAccount>>()
export class Whirlpool {
  private constructor() {}

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
