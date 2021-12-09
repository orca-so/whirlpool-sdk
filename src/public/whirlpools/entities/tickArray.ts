import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { Tick } from ".";
import { PDA } from "../../../model/pda";
import { NUM_TICKS_IN_ARRAY } from "../constants";

export interface TickArrayAccount {
  readonly whirlpool: PublicKey;
  readonly startTick: number;
  readonly ticks: Tick[];
  readonly programId: PublicKey;
}

export class TickArray {
  public readonly account: TickArrayAccount;

  private static readonly SEED_HEADER = "tick_array";
  private readonly pda: PDA;

  constructor(account: TickArrayAccount) {
    invariant(account.ticks.length === NUM_TICKS_IN_ARRAY, "TICK_ARRAY");
    this.account = account;
    this.pda = TickArray.getPDA(account.whirlpool, account.startTick, account.programId);
  }

  public get address(): PublicKey {
    return this.pda.publicKey;
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

  // TODO: Account for when tick goes out of bounds of this tick array (throw error?)
  // TODO: Account for min tick
  public async getPrevInitializedTick(currentTick: number): Promise<number> {
    throw new Error("TODO");
  }

  // TODO: Account for when tick goes out of bounds of this tick array (throw error?)
  // TODO: Account for max tick
  public async getNextInitializedTick(currentTick: number): Promise<number> {
    throw new Error("TODO");
  }

  public getTick(tickIndex: number): Tick {
    invariant(tickIndex >= this.account.startTick, "tickIndex is too small");
    invariant(tickIndex < this.account.startTick + NUM_TICKS_IN_ARRAY, "tickIndex is too large");
    const localIndex = (tickIndex - this.account.startTick) % NUM_TICKS_IN_ARRAY;
    return this.account.ticks[localIndex];
  }

  public static findStartTick(tickIndex: number, baseTickStart: number): number {
    const delta = Math.floor(Math.abs(tickIndex - baseTickStart) / NUM_TICKS_IN_ARRAY);
    const direction = tickIndex - baseTickStart > 0 ? 1 : -1;
    return baseTickStart + direction * delta * NUM_TICKS_IN_ARRAY;
  }

  // need to think about how to do batch fetch across different types of accounts
  public static async fetch(connection: Connection, address: PublicKey): Promise<TickArray> {
    throw new Error("TODO - fetch, then deserialize the account data into TickArray object");
  }

  public static getPDA(whirlpool: PublicKey, startTick: number, whirlpoolProgram: PublicKey): PDA {
    return PDA.derive(whirlpoolProgram, [TickArray.SEED_HEADER, whirlpool, startTick.toString()]);
  }
}
