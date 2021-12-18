import { PublicKey } from "@solana/web3.js";
import { TICK_ARRAY_SIZE } from "../../constants";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements, WhirlpoolEntity } from ".";
import { TickMath } from "../utils";
import invariant from "tiny-invariant";
import { Tick, TickArrayAccount, WhirlpoolAccount } from "../..";

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

  constructor(tickArray: Tick[]) {
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

/**
 * SCUBA-ATAMARI:
 * TODO account for tick-spacing
 */
@staticImplements<ParsableEntity<TickArrayAccount>>()
export class TickArrayEntity {
  private constructor() {}

  // NOTE: within this tick array
  public static getPrevInitializedTickIndex(
    account: TickArrayAccount,
    currentTickIndex: number
  ): number {
    return TickArrayEntity.findInitializedTick(account, currentTickIndex, TickSearchDirection.Left);
  }

  // NOTE: within this tick array
  public static getNextInitializedTickIndex(
    account: TickArrayAccount,
    currentTickIndex: number
  ): number {
    return TickArrayEntity.findInitializedTick(
      account,
      currentTickIndex,
      TickSearchDirection.Right
    );
  }

  public static getTick(account: TickArrayAccount, tickIndex: number): Tick {
    invariant(TickArrayEntity.isValidTickIndex(tickIndex), "getTick - tick index out of range");

    const tickArrayIndex = TickArrayEntity.tickIndexToTickArrayIndex(account, tickIndex);
    invariant(
      tickArrayIndex >= 0 && tickArrayIndex < account.ticks.length,
      "Tick array index out of bounds"
    );

    return account.ticks[tickArrayIndex];
  }

  public static getAddressContainingTickIndex(
    tickIndex: number,
    whirlpool: WhirlpoolAccount,
    programId: PublicKey
  ): PublicKey {
    const startTick = TickArrayEntity.findStartTickWith(tickIndex, whirlpool.tickArrayStart);
    const whirlpoolAddress = WhirlpoolEntity.deriveAddress(
      whirlpool.whirlpoolsConfig,
      programId,
      whirlpool.tokenMintA,
      whirlpool.tokenMintB
    );
    return TickArrayEntity.deriveAddress(whirlpoolAddress, startTick, programId);
  }

  /**
   * Find the startTick of a tick array containing tickIndex.
   * E.g.:
   *   Given
   *     tickIndex = 5042, baseTickStart = 500, TICK_ARRAY_SIZE = 1000
   *   We calculate
   *     delta = Math.floor(Math.abs(5042 - 500) / 1000) = 4
   *     direction = 5042 - 500 > 0 ? 1 : -1 = 1
   *     result = 500 + 1 * 4 * 1000 = 4500
   *   We see that
   *     baseTickStart = 500, and TICK_ARRAY_SIZE = 1000
   *     which means, we have the following tick arrays
   *       [500, 1499] [1500, 2499] [2500, 3499] [3500 4499] [4500, 5499] and so on
   *     tickIndex = 5042 exists in [4500, 5499] and 4500 is the startIndex of this tick array
   *
   * @param tickIndex - desired tickIndex
   * @param baseTickStart - a valid startTick
   * @returns startTick containing tickIndex
   */
  private static findStartTickWith(tickIndex: number, baseTickStart: number): number {
    // delta tells us number of hops we need to make in terms of tick arrays
    const delta = Math.floor(Math.abs(tickIndex - baseTickStart) / TICK_ARRAY_SIZE);
    // direction tells us if we should move left or right
    const direction = tickIndex - baseTickStart > 0 ? 1 : -1;
    return baseTickStart + direction * delta * TICK_ARRAY_SIZE;
  }

  public static deriveAddress(
    whirlpoolAddress: PublicKey,
    startTick: number,
    programId: PublicKey
  ): PublicKey {
    return PDA.derive(programId, ["tick_array", whirlpoolAddress, startTick.toString()]).publicKey;
  }

  public static parse(accountData: Buffer | undefined | null): TickArrayAccount | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    throw new Error("TODO - import from contract code");
  }

  private static isValidTickIndex(tickIndex: number) {
    return tickIndex >= TickMath.MIN_TICK && tickIndex <= TickMath.MAX_TICK;
  }

  private static isValidTickIndexWithinAccount(account: TickArrayAccount, tickIndex: number) {
    invariant(
      TickArrayEntity.isValidTickIndex(tickIndex),
      `tickIndex out of range [${TickMath.MIN_TICK}, ${TickMath.MAX_TICK}]`
    );
    return tickIndex >= account.startTick && tickIndex < account.startTick + TICK_ARRAY_SIZE;
  }

  private static isValidTickArrayIndex(account: TickArrayAccount, tickArrayIndex: number) {
    return tickArrayIndex >= 0 && tickArrayIndex < account.ticks.length;
  }

  private static tickIndexToTickArrayIndex(account: TickArrayAccount, tickIndex: number): number {
    invariant(
      TickArrayEntity.isValidTickIndexWithinAccount(account, tickIndex),
      "Invalid tickIndex"
    );
    const tickArrayIndex = tickIndex - account.startTick;
    invariant(
      TickArrayEntity.isValidTickArrayIndex(account, tickArrayIndex),
      "Invalid tickArrayIndex"
    );

    return tickArrayIndex;
  }

  private static tickArrayIndexToTickIndex(
    account: TickArrayAccount,
    tickArrayIndex: number
  ): number {
    invariant(
      TickArrayEntity.isValidTickArrayIndex(account, tickArrayIndex),
      "Invalid tickArrayIndex"
    );
    const tickIndex = account.startTick + tickArrayIndex;
    invariant(
      TickArrayEntity.isValidTickIndexWithinAccount(account, tickIndex),
      "Invalid tickIndex"
    );

    return tickIndex;
  }

  private static findInitializedTick(
    account: TickArrayAccount,
    currentTickIndex: number,
    searchDirection: TickSearchDirection
  ): number {
    const currentTickArrayIndex = TickArrayEntity.tickIndexToTickArrayIndex(
      account,
      currentTickIndex
    );

    const increment = searchDirection === TickSearchDirection.Right ? 1 : -1;

    let nextInitializedTickArrayIndex = currentTickArrayIndex + increment;
    while (
      nextInitializedTickArrayIndex >= 0 &&
      nextInitializedTickArrayIndex < account.ticks.length
    ) {
      if (account.ticks[nextInitializedTickArrayIndex].initialized) {
        return TickArrayEntity.tickArrayIndexToTickIndex(account, nextInitializedTickArrayIndex);
      }

      nextInitializedTickArrayIndex += increment;
    }

    if (
      TickArrayEntity.isValidTickIndex(
        TickArrayEntity.tickArrayIndexToTickIndex(account, nextInitializedTickArrayIndex)
      )
    ) {
      throw new TickArrayOutOfBoundsError(account.ticks);
    }

    throw new TickOutOfRangeError();
  }
}
