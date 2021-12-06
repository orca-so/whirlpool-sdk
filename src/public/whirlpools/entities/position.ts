import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import { q64 } from "../..";

export interface PositionAccount {
  whirlpool: PublicKey;

  mint: PublicKey;
  liquidity: u64;
  tickLower: number;
  tickUpper: number;

  feeGrowthCheckpointA: q64;
  feeOwedA: u64;

  feeGrowthCheckpointB: q64;
  feeOwedB: u64;

  rewardGrowthCheckpoint0: q64;
  rewardOwed0: u64;

  rewardGrowthCheckpoint1: q64;
  rewardOwed1: u64;

  rewardGrowthCheckpoint2: q64;
  rewardOwed2: u64;

  programId: PublicKey;
}

export class Position {
  public readonly account: PositionAccount;

  private _address: PublicKey | null = null;

  constructor(account: PositionAccount) {
    invariant(account.tickLower < account.tickUpper, "tick boundaries are not in order");
    this.account = account;
  }

  public async getAddress(): Promise<PublicKey> {
    if (!this._address) {
      const { mint, programId } = this.account;
      this._address = await Position.getAddress(mint, programId);
    }
    return this._address;
  }

  public async equals(position: Position): Promise<boolean> {
    const { mint, programId } = this.account;
    const { mint: otherMint, programId: otherProgramId } = position.account;
    return mint.equals(otherMint) && programId.equals(otherProgramId);
  }

  public static async fetch(connection: Connection, address: PublicKey): Promise<Position> {
    throw new Error("TODO - fetch, then deserialize the account data into Position object");
  }

  public static async getAddress(mint: PublicKey, programId: PublicKey): Promise<PublicKey> {
    const buffers = [mint.toBuffer()];
    return (await PublicKey.findProgramAddress(buffers, programId))[0];
  }
}
