import { u64 } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import invariant from "tiny-invariant";
import { q64 } from "../../public";
import { TICK_ARRAY_SIZE } from "../../constants";
import { PDA } from "../utils/pda";

export const TickMin = 0;
export const TickMax = TICK_ARRAY_SIZE - 1;

export interface Tick {
  readonly initialized: number;
  readonly liquidityNet: BN; // i64 TODO
  readonly liquidityGross: u64;

  readonly feeGrowthOutsideA: q64;
  readonly feeGrowthOutsideB: q64;

  readonly rewardGrowthsOutside: [q64, q64, q64];
}

export interface TickArrayAccount {
  readonly whirlpool: PublicKey;
  readonly startTick: number;
  readonly ticks: Tick[];
  readonly programId: PublicKey; // TODO most likely delete
}

export class TickArray {
  public readonly account: TickArrayAccount;

  // TODO move these to constant?
  private static readonly SEED_HEADER = "tick_array";
  private readonly pda: PDA;

  // TODO most likely not needed, make private empty constructure
  constructor(account: TickArrayAccount) {
    invariant(account.ticks.length === TICK_ARRAY_SIZE, "TICK_ARRAY");
    this.account = account;
    this.pda = TickArray.getPDA(account.whirlpool, account.startTick, account.programId);
  }

  public get address(): PublicKey {
    return this.pda.publicKey;
  }

  // TODO: Account for when tick goes out of bounds of this tick array (throw error?)
  // TODO: Account for min tick
  public async getPrevInitializedTick(currentTick: number): Promise<number> {
    // TODO feedback from yutaro:
    // 1. This should get the previous initialized tick within the tick array.
    //    If it reaches the first tick and it's uninitialized, return the first tick.
    // 2. The caller should be responsible for getting the previous tick array in the next iteration.
    throw new Error("TODO");
  }

  // TODO: Account for when tick goes out of bounds of this tick array (throw error?)
  // TODO: Account for max tick
  public async getNextInitializedTick(currentTick: number): Promise<number> {
    throw new Error("TODO");
  }

  public getTick(tickIndex: number): Tick {
    invariant(tickIndex >= this.account.startTick, "tickIndex is too small");
    invariant(tickIndex < this.account.startTick + TICK_ARRAY_SIZE, "tickIndex is too large");
    const localIndex = (tickIndex - this.account.startTick) % TICK_ARRAY_SIZE;
    return this.account.ticks[localIndex];
  }

  public static getAddressContainingTickIndex(tickIndex: number): PublicKey {
    throw new Error("TODO - implmenet");
  }

  public static findStartTick(tickIndex: number, baseTickStart: number): number {
    const delta = Math.floor(Math.abs(tickIndex - baseTickStart) / TICK_ARRAY_SIZE);
    const direction = tickIndex - baseTickStart > 0 ? 1 : -1;
    return baseTickStart + direction * delta * TICK_ARRAY_SIZE;
  }

  // need to think about how to do batch fetch across different types of accounts
  public static async fetch(connection: Connection, address: PublicKey): Promise<TickArray> {
    throw new Error("TODO - fetch, then deserialize the account data into TickArray object");
  }

  public static getPDA(whirlpool: PublicKey, startTick: number, whirlpoolProgram: PublicKey): PDA {
    return PDA.derive(whirlpoolProgram, [TickArray.SEED_HEADER, whirlpool, startTick.toString()]);
  }

  public static getAddress(
    whirlpool: PublicKey,
    startTick: number,
    whirlpoolProgram: PublicKey
  ): PublicKey {
    return PDA.derive(whirlpoolProgram, [TickArray.SEED_HEADER, whirlpool, startTick.toString()])
      .publicKey;
  }
}
