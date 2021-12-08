import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { Position, TickArray } from ".";
import { u64 } from "@solana/spl-token";
import { q64 } from "../..";
import { Token } from "../../../model/token";
import { PositionStatus } from "..";
import { PDA } from "../../../model/pda";

export interface WhirlpoolAccount {
  readonly whirlpoolsConfig: PublicKey;
  readonly whirlpoolBump: number;

  readonly feeRate: number;
  readonly protocolFeeRate: number;

  readonly liquidity: u64;
  readonly sqrtPrice: q64;
  readonly tickArrayStart: number;
  readonly currentTick: number;

  readonly protocolFeeOwedA: u64;
  readonly protocolFeeOwedB: u64;

  readonly tokenMintA: PublicKey;
  readonly tokenVaultA: PublicKey;
  readonly feeGrowthGlobalA: q64;

  readonly tokenMintB: PublicKey;
  readonly tokenVaultB: PublicKey;
  readonly feeGrowthGlobalB: q64;

  readonly secondsSinceLastUpdate: u64;

  readonly rewardMint0: PublicKey;
  readonly rewardVault0: PublicKey;
  readonly rewardEmissionsAuthority0: PublicKey;
  readonly rewardEmissionsPerSecond0: q64;
  readonly rewardGrowthGlobal0: q64;

  readonly rewardMint1: PublicKey;
  readonly rewardVault1: PublicKey;
  readonly rewardEmissionsAuthority1: PublicKey;
  readonly rewardEmissionsPerSecond1: q64;
  readonly rewardGrowthGlobal1: q64;

  readonly rewardMint2: PublicKey;
  readonly rewardVault2: PublicKey;
  readonly rewardEmissionsAuthority2: PublicKey;
  readonly rewardEmissionsPerSecond2: q64;
  readonly rewardGrowthGlobal2: q64;

  readonly programId: PublicKey;
}

export class Whirlpool {
  private static SEED_HEADER = "whirlpool";

  public readonly account: WhirlpoolAccount;

  private readonly pda: PDA;

  constructor(account: WhirlpoolAccount) {
    invariant(account.tokenMintA !== account.tokenMintB, "TOKEN_MINT");
    this.account = account;
    this.pda = Whirlpool.getPDA(
      account.whirlpoolsConfig,
      account.tokenMintA,
      account.tokenMintB,
      account.programId
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

  public async equals(whirlpool: Whirlpool): Promise<boolean> {
    const { whirlpoolsConfig, tokenMintA, tokenMintB, programId } = this.account;
    const {
      whirlpoolsConfig: otherWhirlpoolsConfig,
      tokenMintA: otherTokenMintA,
      tokenMintB: otherTokenMintB,
      programId: otherProgramId,
    } = whirlpool.account;
    return (
      whirlpoolsConfig.equals(otherWhirlpoolsConfig) &&
      tokenMintA.equals(otherTokenMintA) &&
      tokenMintB.equals(otherTokenMintB) &&
      programId.equals(otherProgramId)
    );
  }

  public static async fetch(connection: Connection, address: PublicKey): Promise<Whirlpool> {
    throw new Error("TODO - fetch, then deserialize the account data into Whirlpool object");
  }

  public static getPDA(
    whirlpoolsConfig: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    programId: PublicKey
  ): PDA {
    return PDA.derive(programId, [Whirlpool.SEED_HEADER, whirlpoolsConfig, tokenMintA, tokenMintB]);
  }

  public async getPositionStatus(position: Position): Promise<PositionStatus> {
    if (this.account.currentTick < position.account.tickLower) {
      return PositionStatus.BelowRange;
    } else if (this.account.currentTick <= position.account.tickUpper) {
      return PositionStatus.InRange;
    } else {
      return PositionStatus.AboveRange;
    }
  }
}
