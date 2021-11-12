import JSBI from "jsbi";
import invariant from "tiny-invariant";
import { BigintIsh, NUM_TICKS_IN_ARRAY } from "../constants";

const MIN_TICK: number = 0;
const MAX_TICK: number = NUM_TICKS_IN_ARRAY - 1;

export interface TickConstructorArgs {
  initialized: number;
  liquidityNet: BigintIsh;
  liquidityGross: BigintIsh;
}

export class Tick {
  public readonly initialized: number;
  public readonly liquidityNet: JSBI;
  public readonly liquidityGross: JSBI;

  // fee_growth_outside_a
  // fee_growth_outside_b
  // reward_growth_outside_0
  // reward_growth_outside_1
  // reward_growth_outside_2

  constructor({ initialized, liquidityGross, liquidityNet }: TickConstructorArgs) {
    invariant(initialized >= MIN_TICK && initialized <= MAX_TICK, "TICK");
    this.initialized = initialized;
    this.liquidityGross = JSBI.BigInt(liquidityGross);
    this.liquidityNet = JSBI.BigInt(liquidityNet);
  }
}
