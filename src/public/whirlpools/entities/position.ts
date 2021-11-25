import JSBI from "jsbi";
import { Connection, PublicKey } from "@solana/web3.js";
import { BigintIsh } from "../constants";
import { Whirlpool } from "./whirlpool";
import invariant from "tiny-invariant";

export interface PositionAccount {
  whirlpool: PublicKey;

  mint: PublicKey;
  liquidity: JSBI; // u64
  tickLower: number; // i32
  tickUpper: number; // i32

  feeGrowthCheckpointA: JSBI; // u256
  feeOwedA: JSBI; // u64

  feeGrowthCheckpointB: JSBI; // u256
  feeOwedB: JSBI; // u64

  rewardGrowthCheckpoint0: JSBI; // u256
  rewardOwed0: JSBI; // u64

  rewardGrowthCheckpoint1: JSBI; // u256
  rewardOwed1: JSBI; // u64

  rewardGrowthCheckpoint2: JSBI; // u256
  rewardOwed2: JSBI; // u64

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
