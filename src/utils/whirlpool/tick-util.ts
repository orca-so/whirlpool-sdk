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

  public static getNearestValidTickIndex(tickIndex: number, tickSpacing: TickSpacing): number {
    return tickIndex - (tickIndex % tickSpacing);
  }

  // NOTE: within this tick array
  public static getPrevInitializedTickIndex(
    account: TickArrayData,
    currentTickIndex: number,
    tickSpacing: TickSpacing
  ): number {
    return TickUtil.findInitializedTick(
      account,
      currentTickIndex,
      tickSpacing,
      TickSearchDirection.Left
    );
  }

  // NOTE: within this tick array
  public static getNextInitializedTickIndex(
    account: TickArrayData,
    currentTickIndex: number,
    tickSpacing: TickSpacing
  ): number {
    return TickUtil.findInitializedTick(
      account,
      currentTickIndex,
      tickSpacing,
      TickSearchDirection.Right
    );
  }

  // TODO account for negative
  public static getTick(
    account: TickArrayData,
    tickIndex: number,
    tickSpacing: TickSpacing
  ): TickData {
    const index = Math.floor(tickIndex / tickSpacing) % TICK_ARRAY_SIZE;
    invariant(index >= 0, "tick index out of range");
    invariant(index < account.ticks.length, "tick index out of range");

    const tick = account.ticks[index];
    invariant(!!tick, "account");
    return tick;
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
    return Math.floor(tickIndex / tickSpacing / TICK_ARRAY_SIZE) * tickSpacing * TICK_ARRAY_SIZE;
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

  // private static isValidTickIndexWithinAccount(account: TickArrayData, tickIndex: number) {
  //   return (
  //     tickIndex >= account.startTickIndex && tickIndex < account.startTickIndex + tickSpacing * TICK_ARRAY_SIZE
  //   );
  // }

  // private static isValidTickArrayIndex(account: TickArrayData, tickArrayIndex: number) {
  //   return tickArrayIndex >= 0 && tickArrayIndex < account.ticks.length;
  // }

  private static tickIndexToTickArrayIndex(
    account: TickArrayData,
    tickIndex: number,
    tickSpacing: TickSpacing
  ): number {
    const tickArrayIndex = Math.floor((tickIndex - account.startTickIndex) / tickSpacing);

    return tickArrayIndex;
  }

  private static tickArrayIndexToTickIndex(
    account: TickArrayData,
    tickArrayIndex: number,
    tickSpacing: TickSpacing
  ): number {
    const tickIndex = account.startTickIndex + tickArrayIndex * tickSpacing;

    return tickIndex;
  }

  private static findInitializedTick(
    account: TickArrayData,
    currentTickIndex: number,
    tickSpacing: TickSpacing,
    searchDirection: TickSearchDirection
  ): number {
    const currentTickArrayIndex = TickUtil.tickIndexToTickArrayIndex(
      account,
      currentTickIndex,
      tickSpacing
    );

    const increment = searchDirection === TickSearchDirection.Right ? 1 : -1;

    let nextInitializedTickArrayIndex = currentTickArrayIndex + increment;
    while (
      nextInitializedTickArrayIndex >= 0 &&
      nextInitializedTickArrayIndex < account.ticks.length
    ) {
      if (account.ticks[nextInitializedTickArrayIndex]?.initialized) {
        return TickUtil.tickArrayIndexToTickIndex(
          account,
          nextInitializedTickArrayIndex,
          tickSpacing
        );
      }

      nextInitializedTickArrayIndex += increment;
    }

    throw new TickArrayOutOfBoundsError(account.ticks);
  }
}
