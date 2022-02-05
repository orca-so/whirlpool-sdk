import invariant from "tiny-invariant";
import { Address } from "@project-serum/anchor";
import { toPubKey } from "../address";
import {
  TickSpacing,
  TickArrayData,
  TickData,
  PDA,
  getTickArrayPda,
  NUM_TICKS_IN_TICK_ARRAY,
  MIN_TICK_INDEX,
  MAX_TICK_INDEX,
} from "@orca-so/whirlpool-client-sdk";

enum TickSearchDirection {
  Left,
  Right,
}

export class TickUtil {
  private constructor() {}

  /**
   * Get the nearest (rounding down) valid tick index from the tickIndex.
   * A valid tick index is a point on the tick spacing grid line.
   */
  public static toValid(tickIndex: number, tickSpacing: TickSpacing): number {
    return tickIndex - (tickIndex % tickSpacing);
  }

  /**
   * Get the tick from tickArray with a global tickIndex.
   */
  public static getTick(
    tickArray: TickArrayData,
    tickIndex: number,
    tickSpacing: TickSpacing
  ): TickData {
    const realIndex = TickUtil.tickIndexToTickArrayIndex(tickArray, tickIndex, tickSpacing);
    const tick = tickArray.ticks[realIndex];
    invariant(!!tick, "tick realIndex out of range");
    return tick;
  }

  /**
   * Get the PDA of the tick array containing tickIndex.
   * tickArrayOffset can be used to get neighboring tick arrays.
   */
  public static getPdaWithTickIndex(
    tickIndex: number,
    tickSpacing: TickSpacing,
    whirlpool: Address,
    programId: Address,
    tickArrayOffset = 0
  ): PDA {
    const startIndex = TickUtil.getStartTickIndex(tickIndex, tickSpacing, tickArrayOffset);
    return getTickArrayPda(toPubKey(programId), toPubKey(whirlpool), startIndex);
  }

  /**
   * Get the startIndex of the tick array containing tickIndex.
   *
   * @param tickIndex
   * @param tickSpacing
   * @param offset can be used to get neighboring tick array startIndex.
   * @returns
   */
  public static getStartTickIndex(tickIndex: number, tickSpacing: TickSpacing, offset = 0): number {
    const realIndex = Math.floor(tickIndex / tickSpacing / NUM_TICKS_IN_TICK_ARRAY);
    const startTickIndex = (realIndex + offset) * tickSpacing * NUM_TICKS_IN_TICK_ARRAY;
    invariant(startTickIndex >= MIN_TICK_INDEX, "startTickIndex is too small");
    invariant(startTickIndex <= MAX_TICK_INDEX, "startTickIndex is too large");
    return startTickIndex;
  }

  /**
   * Get the previous initialized tick index within the same tick array.
   */
  public static getPrevInitializedTickIndex(
    account: TickArrayData,
    currentTickIndex: number,
    tickSpacing: TickSpacing
  ): number | null {
    return TickUtil.findInitializedTick(
      account,
      currentTickIndex,
      tickSpacing,
      TickSearchDirection.Left
    );
  }

  /**
   * Get the next initialized tick index within the same tick array.
   */
  public static getNextInitializedTickIndex(
    account: TickArrayData,
    currentTickIndex: number,
    tickSpacing: TickSpacing
  ): number | null {
    return TickUtil.findInitializedTick(
      account,
      currentTickIndex,
      tickSpacing,
      TickSearchDirection.Right
    );
  }

  private static findInitializedTick(
    account: TickArrayData,
    currentTickIndex: number,
    tickSpacing: TickSpacing,
    searchDirection: TickSearchDirection
  ): number | null {
    const currentTickArrayIndex = TickUtil.tickIndexToTickArrayIndex(
      account,
      currentTickIndex,
      tickSpacing
    );

    const increment = searchDirection === TickSearchDirection.Right ? 1 : -1;

    let stepInitializedTickArrayIndex = TickSearchDirection.Right
      ? currentTickArrayIndex + increment
      : currentTickArrayIndex;
    while (
      stepInitializedTickArrayIndex >= 0 &&
      stepInitializedTickArrayIndex < account.ticks.length
    ) {
      if (account.ticks[stepInitializedTickArrayIndex]?.initialized) {
        return TickUtil.tickArrayIndexToTickIndex(
          account,
          stepInitializedTickArrayIndex,
          tickSpacing
        );
      }

      stepInitializedTickArrayIndex += increment;
    }

    return null;
  }

  private static tickIndexToTickArrayIndex(
    { startTickIndex }: TickArrayData,
    tickIndex: number,
    tickSpacing: TickSpacing
  ): number {
    return startTickIndex >= 0
      ? Math.floor((tickIndex - startTickIndex) / tickSpacing)
      : Math.floor((tickIndex + startTickIndex) / tickSpacing);
  }

  private static tickArrayIndexToTickIndex(
    { startTickIndex }: TickArrayData,
    tickArrayIndex: number,
    tickSpacing: TickSpacing
  ): number {
    return startTickIndex >= 0
      ? startTickIndex + tickArrayIndex * tickSpacing
      : startTickIndex - tickArrayIndex * tickSpacing;
  }
}
