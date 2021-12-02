import BN from "bn.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { Whirlpool } from "./whirlpool";
import invariant from "tiny-invariant";

export interface PositionAccount {
  whirlpool: PublicKey;

  mint: PublicKey;
  liquidity: BN; // u64
  tickLower: number; // i32
  tickUpper: number; // i32

  feeGrowthCheckpointA: BN; // u128
  feeOwedA: BN; // u64

  feeGrowthCheckpointB: BN; // u128
  feeOwedB: BN; // u64

  rewardGrowthCheckpoint0: BN; // u128
  rewardOwed0: BN; // u64

  rewardGrowthCheckpoint1: BN; // u128
  rewardOwed1: BN; // u64

  rewardGrowthCheckpoint2: BN; // u128
  rewardOwed2: BN; // u64

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
