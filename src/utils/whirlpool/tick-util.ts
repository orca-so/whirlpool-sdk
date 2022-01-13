import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  TickArrayData,
  TickData,
  TICK_ARRAY_SIZE,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { getTickArrayPda } from "@orca-so/whirlpool-client-sdk";

enum TickSearchDirection {
  Left,
  Right,
}

export const TickMin = 0;
export const TickMax = TICK_ARRAY_SIZE - 1;

/**
 * Tick is outside the given tick array's range (inclusive)
 */
export class TickArrayOutOfBoundsError extends Error {
  public readonly lowerBound: number;
  public readonly upperBound: number;

  constructor(tickArray: TickData[]) {
    super("Tick is outside the given tick array's range (inclusive)");
    this.lowerBound = 0;
    this.upperBound = tickArray.length - 1;
  }
}
/**
 * Outside of the [MIN_TICK, MAX_TICK] range
 */
export class TickOutOfRangeError extends Error {
  constructor() {
    super(`Outside of the [MIN_TICK, MAX_TICK] range`);
  }
}

export class TickUtil {
  private constructor() {}

  // NOTE: within this tick array
  // public static getPrevInitializedTickIndex(
  //   account: TickArrayData,
  //   currentTickIndex: number
  // ): number {
  //   return TickArrayUtil.findInitializedTick(account, currentTickIndex, TickSearchDirection.Left);
  // }

  // NOTE: within this tick array
  // public static getNextInitializedTickIndex(
  //   account: TickArrayData,
  //   currentTickIndex: number
  // ): number {
  //   return TickArrayUtil.findInitializedTick(account, currentTickIndex, TickSearchDirection.Right);
  // }

  // TODO account for negative
  public static getTick(account: TickArrayData, tickIndex: number): TickData {
    const index = tickIndex % TICK_ARRAY_SIZE;
    invariant(account.startTickIndex === Math.floor(tickIndex / TICK_ARRAY_SIZE));
    invariant(index >= 0, "tick index out of range");
    invariant(index < account.ticks.length, "tick index out of range");
    return account.ticks[index];
  }

  public static getAddressContainingTickIndex(
    tickIndex: number,
    whirlpoolAddress: PublicKey,
    programId: PublicKey
  ): PublicKey {
    const startTick = Math.floor(tickIndex / TICK_ARRAY_SIZE) * TICK_ARRAY_SIZE;
    return getTickArrayPda(programId, whirlpoolAddress, startTick).publicKey;
  }

  // private static isValidTickIndexWithinAccount(account: TickArrayData, tickIndex: number) {
  //   invariant(
  //     TickArrayUtil.isValidTickIndex(tickIndex),
  //     `tickIndex out of range [${TickMath.MIN_TICK}, ${TickMath.MAX_TICK}]`
  //   );
  //   return tickIndex >= account.startTick && tickIndex < account.startTick + TICK_ARRAY_SIZE;
  // }

  // private static isValidTickArrayIndex(account: TickArrayData, tickArrayIndex: number) {
  //   return tickArrayIndex >= 0 && tickArrayIndex < account.ticks.length;
  // }

  // private static tickIndexToTickArrayIndex(account: TickArrayData, tickIndex: number): number {
  //   invariant(TickArrayUtil.isValidTickIndexWithinAccount(account, tickIndex), "Invalid tickIndex");
  //   const tickArrayIndex = tickIndex - account.startTick;
  //   invariant(
  //     TickArrayUtil.isValidTickArrayIndex(account, tickArrayIndex),
  //     "Invalid tickArrayIndex"
  //   );

  //   return tickArrayIndex;
  // }

  // private static tickArrayIndexToTickIndex(account: TickArrayData, tickArrayIndex: number): number {
  //   invariant(
  //     TickArrayUtil.isValidTickArrayIndex(account, tickArrayIndex),
  //     "Invalid tickArrayIndex"
  //   );
  //   const tickIndex = account.startTick + tickArrayIndex;
  //   invariant(TickArrayUtil.isValidTickIndexWithinAccount(account, tickIndex), "Invalid tickIndex");

  //   return tickIndex;
  // }

  // private static findInitializedTick(
  //   account: TickArrayData,
  //   currentTickIndex: number,
  //   searchDirection: TickSearchDirection
  // ): number {
  //   const currentTickArrayIndex = TickArrayUtil.tickIndexToTickArrayIndex(
  //     account,
  //     currentTickIndex
  //   );

  //   const increment = searchDirection === TickSearchDirection.Right ? 1 : -1;

  //   let nextInitializedTickArrayIndex = currentTickArrayIndex + increment;
  //   while (
  //     nextInitializedTickArrayIndex >= 0 &&
  //     nextInitializedTickArrayIndex < account.ticks.length
  //   ) {
  //     if (account.ticks[nextInitializedTickArrayIndex].initialized) {
  //       return TickArrayUtil.tickArrayIndexToTickIndex(account, nextInitializedTickArrayIndex);
  //     }

  //     nextInitializedTickArrayIndex += increment;
  //   }

  //   if (
  //     TickArrayUtil.isValidTickIndex(
  //       TickArrayUtil.tickArrayIndexToTickIndex(account, nextInitializedTickArrayIndex)
  //     )
  //   ) {
  //     throw new TickArrayOutOfBoundsError(account.ticks);
  //   }

  //   throw new TickOutOfRangeError();
  // }
}
