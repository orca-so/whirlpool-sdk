import JSBI from "jsbi";
import { PublicKey } from "@solana/web3.js";
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
}

export class Position {
  public readonly account: PositionAccount;

  constructor(account: PositionAccount) {
    invariant(account.tickLower < account.tickUpper, "TICK_ORDER");

    this.account = account;
  }

  public static async fetch(mint: PublicKey, programId: PublicKey): Promise<Position> {
    const address = await Position.getAddress(mint, programId);
    throw new Error("TODO - fetch, then deserialize the account data into Position object");
  }

  public static async getAddress(mint: PublicKey, programId: PublicKey): Promise<PublicKey> {
    const buffers = [mint.toBuffer()];
    return (await PublicKey.findProgramAddress(buffers, programId))[0];
  }
}
