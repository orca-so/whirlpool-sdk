import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { Tick, Whirlpool } from ".";
import { getWhirlpoolProgramId, NUM_TICKS_IN_ARRAY } from "../constants";

export interface TickArrayAccount {
  readonly whirlpool: PublicKey;
  readonly startTick: number; // i32
  readonly ticks: Tick[];
  readonly programId: PublicKey;
}

export class TickArray {
  public readonly account: TickArrayAccount;

  constructor(account: TickArrayAccount) {
    invariant(account.ticks.length === NUM_TICKS_IN_ARRAY, "TICK_ARRAY");
    this.account = account;
  }

  public async getAddress(): Promise<PublicKey> {
    const { whirlpool, startTick, programId } = this.account;
    return TickArray.getAddress(whirlpool, startTick, programId);
  }

  public async equals(tickArray: TickArray): Promise<boolean> {
    const { whirlpool, startTick, programId } = this.account;
    const {
      whirlpool: otherWhirlpool,
      startTick: otherStartTick,
      programId: otherProgramId,
    } = tickArray.account;
    return (
      whirlpool.equals(otherWhirlpool) &&
      startTick === otherStartTick &&
      programId.equals(otherProgramId)
    );
  }

  public getTick(tickIndex: number): Tick {
    invariant(tickIndex >= this.account.startTick, "tickIndex is too small");
    invariant(tickIndex < this.account.startTick + NUM_TICKS_IN_ARRAY, "tickIndex is too large");
    const localIndex = (tickIndex - this.account.startTick) % NUM_TICKS_IN_ARRAY; // ??
    return this.account.ticks[localIndex];
  }

  public getPrevStartTick(): TickArray {
    // invariant()
    const prevStartTick = this.account.startTick - NUM_TICKS_IN_ARRAY;
    throw new Error("TODO - is this needed");
  }

  public static async fetch(
    whirlpool: PublicKey,
    startTick: number,
    programId: PublicKey
  ): Promise<TickArray> {
    const address = await TickArray.getAddress(whirlpool, startTick, programId);
    throw new Error("TODO - fetch, then deserialize the account data into TickArray object");
  }

  public static async getAddress(
    whirlpool: PublicKey,
    startTick: number,
    programId: PublicKey
  ): Promise<PublicKey> {
    const buffers = [whirlpool.toBuffer()]; // TODO startTick to buffer
    return (await PublicKey.findProgramAddress(buffers, programId))[0];
  }
}
