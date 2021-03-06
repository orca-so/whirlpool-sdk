import {
  fromX64,
  sqrtPriceX64ToTickIndex,
  tickIndexToSqrtPriceX64,
  TICK_ARRAY_SIZE,
  toX64,
} from "@orca-so/whirlpool-client-sdk";
import { BN } from "@project-serum/anchor";
import Decimal from "decimal.js";
import { TickUtil } from "../whirlpool/tick-util";

export function getNearestValidTickIndexFromTickIndex(tickIndex: number, tickSpacing: number) {
  return TickUtil.toValid(tickIndex, tickSpacing);
}

export function getNearestValidTickIndex(
  price: Decimal,
  decimalsA: number,
  decimalsB: number,
  tickSpacing: number
) {
  return TickUtil.toValid(priceToTickIndex(price, decimalsA, decimalsB), tickSpacing);
}

export function getNextValidTickIndex(tickIndex: number, tickSpacing: number) {
  return tickIndex + tickSpacing;
}

export function getPrevValidTickIndex(tickIndex: number, tickSpacing: number) {
  return tickIndex - tickSpacing;
}

export function sqrtPriceX64ToPrice(
  sqrtPriceX64: BN,
  decimalsA: number,
  decimalsB: number
): Decimal {
  return fromX64(sqrtPriceX64)
    .pow(2)
    .mul(Decimal.pow(10, decimalsA - decimalsB));
}

export function priceToSqrtX64(price: Decimal, decimalsA: number, decimalsB: number): BN {
  return toX64(price.mul(Decimal.pow(10, decimalsB - decimalsA)).sqrt());
}

export function tickIndexToPrice(tickIndex: number, decimalsA: number, decimalsB: number): Decimal {
  return sqrtPriceX64ToPrice(tickIndexToSqrtPriceX64(tickIndex), decimalsA, decimalsB);
}

export function priceToTickIndex(price: Decimal, decimalsA: number, decimalsB: number): number {
  return sqrtPriceX64ToTickIndex(priceToSqrtX64(price, decimalsA, decimalsB));
}

/**
 * Get the startIndex of the tick array containing tickIndex.
 *
 * @param tickIndex
 * @param tickSpacing
 * @param offset can be used to get neighboring tick array startIndex.
 * @returns
 */
export function getStartTickIndex(tickIndex: number, tickSpacing: number, offset = 0): number {
  const realIndex = Math.floor(tickIndex / tickSpacing / TICK_ARRAY_SIZE);
  const startTickIndex = (realIndex + offset) * tickSpacing * TICK_ARRAY_SIZE;
  return startTickIndex;
}
