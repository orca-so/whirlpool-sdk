import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { Position, TickArray } from ".";
import { u64 } from "@solana/spl-token";
import { PositionStatus, Percentage, q64 } from "../../public";
import { PDA } from "../utils/pda";
import { Account } from "./account";

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

export class Whirlpool extends Account {
  // TODO move these to constant?
  private static SEED_HEADER = "whirlpool";

  public readonly account: WhirlpoolAccount;

  private readonly pda: PDA;

  constructor(account: WhirlpoolAccount, programId: PublicKey) {
    invariant(!account.tokenMintA.equals(account.tokenMintB), "tokens cannot be the same");
    super();
    this.account = account;
    this.pda = Whirlpool.getPDA(
      account.whirlpoolsConfig,
      account.tokenMintA,
      account.tokenMintB,
      programId
    );
  }

  public get address(): PublicKey {
    return this.pda.publicKey;
  }

  public async getCurrentTickArrayAddress(): Promise<PublicKey> {
    const { publicKey } = TickArray.getPDA(
      this.address,
      this.account.tickArrayStart,
      this.account.programId
    );

    return publicKey;
  }

  public static async fetch(connection: Connection, address: PublicKey): Promise<Whirlpool> {
    throw new Error("TODO - fetch, then deserialize the account data into Whirlpool object");
  }

  public parse(): Whirlpool {
    throw new Error("TODO - implement");
  }

  public static getAddress(
    whirlpoolsConfig: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    programId: PublicKey
  ): PublicKey {
    return PDA.derive(programId, [Whirlpool.SEED_HEADER, whirlpoolsConfig, tokenMintA, tokenMintB])
      .publicKey;
  }

  public static getPDA(
    whirlpoolsConfig: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    programId: PublicKey
  ): PDA {
    return PDA.derive(programId, [Whirlpool.SEED_HEADER, whirlpoolsConfig, tokenMintA, tokenMintB]);
  }

  public getPositionStatus(position: Position): PositionStatus {
    if (this.account.tickCurrentIndex < position.account.tickLower) {
      return PositionStatus.BelowRange;
    } else if (this.account.tickCurrentIndex <= position.account.tickUpper) {
      return PositionStatus.InRange;
    } else {
      return PositionStatus.AboveRange;
    }
  }

  public static isRewardInitialized(rewardInfo: WhirlpoolRewardInfo): boolean {
    return !PublicKey.default.equals(rewardInfo.mint);
  }

  // Should ideally return a fraction (but our percentage class is a fraction, so using that for now)
  public getFeeRate(): Percentage {
    // TODO: This method should parse this.account.feeRate which is a number (u16) and generate a Fraction that can be easily used by the caller for math
    throw new Error("TODO - Implement");
  }

  // Should ideally return a fraction (but our percentage class is a fraction, so using that for now)
  public getProtocolFeeRate(): Percentage {
    // TODO: This method should parse this.account.protocolFeeRate which is a number (u16) and generate a Fraction that can be easily used by the caller for math
    throw new Error("TODO - Implement");
  }
}
