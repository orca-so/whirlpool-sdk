import { sqrtPriceX64ToTickIndex, TickSpacing, toX64 } from "@orca-so/whirlpool-client-sdk";
import Decimal from "decimal.js";
import { TickUtil } from "../whirlpool/tick-util";

export function getNearestValidTickIndex(price: Decimal, stable = false) {
  const tickSpacing = stable ? TickSpacing.Stable : TickSpacing.Standard;
  return TickUtil.toValid(sqrtPriceX64ToTickIndex(toX64(price.sqrt())), tickSpacing);
}

export function getNextValidTickIndex(tickIndex: number, stable = false) {
  const tickSpacing = stable ? TickSpacing.Stable : TickSpacing.Standard;
  return tickIndex + tickSpacing;
}

export function getPrevValidTickIndex(tickIndex: number, stable = false) {
  const tickSpacing = stable ? TickSpacing.Stable : TickSpacing.Standard;
  return tickIndex + tickSpacing;
}
