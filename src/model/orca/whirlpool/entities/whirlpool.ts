import invariant from "tiny-invariant";
import { NUM_TICKS_IN_ARRAY } from "../../../../public/whirlpools/constants";

export interface TickConstructorArgs {
  initialized: any;
  liquidityGross: any;
  liquidityNet: any;
}

const MIN_TICK = 0;
const MAX_TICK = NUM_TICKS_IN_ARRAY - 1;

export class Tick {
  public readonly initialized: any;
  public readonly liquidityGross: any;
  public readonly liquidityNet: any;

  constructor({ initialized, liquidityGross, liquidityNet }: TickConstructorArgs) {
    invariant(initialized >= MIN_TICK && initialized <= MAX_TICK, "TICK");
    this.initialized = initialized;
    this.liquidityGross = liquidityGross;
    this.liquidityNet = liquidityNet;
  }
}
