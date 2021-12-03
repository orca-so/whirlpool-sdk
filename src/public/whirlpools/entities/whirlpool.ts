import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { TickArray } from ".";
import { u64 } from "@solana/spl-token";
import { q64 } from "../../utils/numbers/q64";

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
  public readonly account: WhirlpoolAccount;

  private _address: PublicKey | null = null;

  constructor(account: WhirlpoolAccount) {
    invariant(account.tokenMintA !== account.tokenMintB, "TOKEN_MINT");
    this.account = account;
  }

  public async getAddress(): Promise<PublicKey> {
    if (!this._address) {
      const { whirlpoolsConfig, tokenMintA, tokenMintB, programId } = this.account;
      this._address = await Whirlpool.getAddress(
        whirlpoolsConfig,
        tokenMintA,
        tokenMintB,
        programId
      );
    }
    return this._address;
  }

  public async getCurrentTickArrayAddress(): Promise<PublicKey> {
    return TickArray.getAddress(
      await this.getAddress(),
      this.account.tickArrayStart,
      this.account.programId
    );
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

  // TODO - connection: Connection
  public static async fetch(address: PublicKey): Promise<Whirlpool> {
    throw new Error("TODO - fetch, then deserialize the account data into Whirlpool object");
  }

  public static async getAddress(
    whirlpoolsConfig: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    programId: PublicKey
  ): Promise<PublicKey> {
    const buffers = [whirlpoolsConfig.toBuffer(), tokenMintA.toBuffer(), tokenMintB.toBuffer()];
    return (await PublicKey.findProgramAddress(buffers, programId))[0];
  }
}
