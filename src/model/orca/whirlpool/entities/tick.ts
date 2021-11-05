import invariant from "tiny-invariant";
import { NUM_TICKS_IN_ARRAY } from "../../../../public/whirlpools/constants";

const MIN_TICK: number = 0;
const MAX_TICK: number = NUM_TICKS_IN_ARRAY - 1;

export interface TickConstructorArgs {
  initialized: number;
  liquidityGross: any;
  liquidityNet: any;
}

export class Tick {
  public readonly initialized: number;
  public readonly liquidityGross: any;
  public readonly liquidityNet: any;

  constructor({ initialized, liquidityGross, liquidityNet }: TickConstructorArgs) {
    invariant(initialized >= MIN_TICK && initialized <= MAX_TICK, "TICK");
    this.initialized = initialized;
    this.liquidityGross = liquidityGross;
    this.liquidityNet = liquidityNet;
  }

  // fee_growth_outside_a
  // fee_growth_outside_b
  // reward_growth_outside_0
  // reward_growth_outside_1
  // reward_growth_outside_2
}
