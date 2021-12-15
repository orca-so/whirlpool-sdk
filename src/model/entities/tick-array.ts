import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { TICK_ARRAY_SIZE } from "../../constants";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements } from ".";

export const TickMin = 0;
export const TickMax = TICK_ARRAY_SIZE - 1;

export interface Tick {
  readonly initialized: number;
  readonly liquidityNet_I64: BN;
  readonly liquidityGross_U64: BN;

  readonly feeGrowthOutsideA_Q64x64: BN;
  readonly feeGrowthOutsideB_Q64x64: BN;

  readonly rewardGrowthsOutside_Q64x64: [BN, BN, BN];
}

export interface TickArrayAccount {
  readonly whirlpool: PublicKey;
  readonly startTick: number;
  readonly ticks: Tick[];
  readonly programId: PublicKey; // TODO most likely delete
}

@staticImplements<ParsableEntity<TickArrayAccount>>()
export class TickArray {
  private constructor() {}

  // TODO: Account for when tick goes out of bounds of this tick array (throw error?)
  // TODO: Account for min tick
  public static async getPrevInitializedTick(
    account: TickArrayAccount,
    currentTick: number
  ): Promise<number> {
    // TODO feedback from yutaro:
    // 1. This should get the previous initialized tick within the tick array.
    //    If it reaches the first tick and it's uninitialized, return the first tick.
    // 2. The caller should be responsible for getting the previous tick array in the next iteration.
    throw new Error("TODO");
  }

  // TODO: Account for when tick goes out of bounds of this tick array (throw error?)
  // TODO: Account for max tick
  public static async getNextInitializedTick(
    account: TickArrayAccount,
    currentTick: number
  ): Promise<number> {
    throw new Error("TODO");
  }

  public static getTick(account: TickArrayAccount, tickIndex: number): Tick {
    // invariant(tickIndex >= this.account.startTick, "tickIndex is too small");
    // invariant(tickIndex < this.account.startTick + TICK_ARRAY_SIZE, "tickIndex is too large");
    // const localIndex = (tickIndex - this.account.startTick) % TICK_ARRAY_SIZE;
    // return this.account.ticks[localIndex];
    throw new Error("TODO - implmenet");
  }

  public static getAddressContainingTickIndex(tickIndex: number): PublicKey {
    throw new Error("TODO - implmenet");
  }

  public static findStartTick(tickIndex: number, baseTickStart: number): number {
    const delta = Math.floor(Math.abs(tickIndex - baseTickStart) / TICK_ARRAY_SIZE);
    const direction = tickIndex - baseTickStart > 0 ? 1 : -1;
    return baseTickStart + direction * delta * TICK_ARRAY_SIZE;
  }

  public static deriveAddress(
    whirlpool: PublicKey,
    startTick: number,
    whirlpoolProgram: PublicKey
  ): PublicKey {
    return PDA.derive(whirlpoolProgram, ["tick_array", whirlpool, startTick.toString()]).publicKey;
  }

  public static parse(accountData: Buffer | undefined | null): TickArrayAccount | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    throw new Error("TODO - implement");
  }
}
