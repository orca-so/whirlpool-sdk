import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  TickArrayData,
  TickData,
  TICK_ARRAY_SIZE,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { getTickArrayPda, TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { PDA } from "@orca-so/whirlpool-client-sdk/dist/types/public/helper-types";

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

export class TickUtil {
  private constructor() {}

  // NOTE: within this tick array
  public static getPrevInitializedTickIndex(
    account: TickArrayData,
    currentTickIndex: number
  ): number {
    return TickUtil.findInitializedTick(account, currentTickIndex, TickSearchDirection.Left);
  }

  // NOTE: within this tick array
  public static getNextInitializedTickIndex(
    account: TickArrayData,
    currentTickIndex: number
  ): number {
    return TickUtil.findInitializedTick(account, currentTickIndex, TickSearchDirection.Right);
  }

  // TODO account for negative
  public static getTick(
    account: TickArrayData,
    tickIndex: number,
    tickSpacing: TickSpacing
  ): TickData {
    const index = Math.floor(tickIndex / tickSpacing) % TICK_ARRAY_SIZE;
    invariant(account.startTickIndex === Math.floor(tickIndex / tickSpacing / TICK_ARRAY_SIZE));
    invariant(index >= 0, "tick index out of range");
    invariant(index < account.ticks.length, "tick index out of range");
    return account.ticks[index];
  }

  public static deriveTickArrayPDA(
    tickIndex: number,
    tickSpacing: TickSpacing,
    whirlpoolAddress: PublicKey,
    programId: PublicKey
  ): PDA {
    const startTick = TickUtil.getStartTickIndex(tickIndex, tickSpacing);
    return getTickArrayPda(programId, whirlpoolAddress, startTick);
  }

  public static getStartTickIndex(tickIndex: number, tickSpacing: TickSpacing): number {
    console.log("TICK INDEX", tickIndex);
    const starTickIndex = Math.floor(tickIndex / tickSpacing / TICK_ARRAY_SIZE) * TICK_ARRAY_SIZE;
    console.log("START TICK INDEX", starTickIndex);
    return starTickIndex;
  }

  public static getAddressContainingTickIndex(
    tickIndex: number,
    tickSpacing: TickSpacing,
    whirlpoolAddress: PublicKey,
    programId: PublicKey
  ): PublicKey {
    return TickUtil.deriveTickArrayPDA(tickIndex, tickSpacing, whirlpoolAddress, programId)
      .publicKey;
  }

  private static isValidTickIndexWithinAccount(account: TickArrayData, tickIndex: number) {
    return (
      tickIndex >= account.startTickIndex && tickIndex < account.startTickIndex + TICK_ARRAY_SIZE
    );
  }

  private static isValidTickArrayIndex(account: TickArrayData, tickArrayIndex: number) {
    return tickArrayIndex >= 0 && tickArrayIndex < account.ticks.length;
  }

  private static tickIndexToTickArrayIndex(account: TickArrayData, tickIndex: number): number {
    invariant(TickUtil.isValidTickIndexWithinAccount(account, tickIndex), "Invalid tickIndex");
    const tickArrayIndex = tickIndex - account.startTickIndex;
    invariant(TickUtil.isValidTickArrayIndex(account, tickArrayIndex), "Invalid tickArrayIndex");

    return tickArrayIndex;
  }

  private static tickArrayIndexToTickIndex(account: TickArrayData, tickArrayIndex: number): number {
    invariant(TickUtil.isValidTickArrayIndex(account, tickArrayIndex), "Invalid tickArrayIndex");
    const tickIndex = account.startTickIndex + tickArrayIndex;
    invariant(TickUtil.isValidTickIndexWithinAccount(account, tickIndex), "Invalid tickIndex");

    return tickIndex;
  }

  private static findInitializedTick(
    account: TickArrayData,
    currentTickIndex: number,
    searchDirection: TickSearchDirection
  ): number {
    const currentTickArrayIndex = TickUtil.tickIndexToTickArrayIndex(account, currentTickIndex);

    const increment = searchDirection === TickSearchDirection.Right ? 1 : -1;

    let nextInitializedTickArrayIndex = currentTickArrayIndex + increment;
    while (
      nextInitializedTickArrayIndex >= 0 &&
      nextInitializedTickArrayIndex < account.ticks.length
    ) {
      if (account.ticks[nextInitializedTickArrayIndex].initialized) {
        return TickUtil.tickArrayIndexToTickIndex(account, nextInitializedTickArrayIndex);
      }

      nextInitializedTickArrayIndex += increment;
    }

    throw new TickArrayOutOfBoundsError(account.ticks);
  }
}
