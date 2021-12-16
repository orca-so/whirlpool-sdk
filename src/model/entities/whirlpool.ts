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

  public static getFeeRate(account: WhirlpoolAccount): Percentage {
    /**
     * Smart Contract comment: https://github.com/orca-so/whirlpool/blob/main/programs/whirlpool/src/state/whirlpool.rs#L9-L11
     * // Stored as hundredths of a basis point
     * // u16::MAX corresponds to ~6.5%
     * pub fee_rate: u16,
     */
    return Percentage.fromFraction(account.feeRate, 1e6);
  }

  public static getProtocolFeeRate(account: WhirlpoolAccount): Percentage {
    /**
     * Smart Contract comment: https://github.com/orca-so/whirlpool/blob/main/programs/whirlpool/src/state/whirlpool.rs#L13-L14
     * // Denominator for portion of fee rate taken (1/x)%
     * pub protocol_fee_rate: u16,
     */
    return Percentage.fromFraction(1, account.protocolFeeRate * 100);
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

    throw new Error("TODO - import from contract code");
  }
}
