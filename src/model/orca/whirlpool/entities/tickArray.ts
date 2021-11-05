import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { Tick, Whirlpool } from ".";
import { NUM_TICKS_IN_ARRAY } from "../../../../public/whirlpools/constants";

interface TickArrayConstructorArgs {
  whirlpool: Whirlpool;
  startTick: number;
  ticks: Tick[];
}

// account
export class TickArray {
  private whirlpool: Whirlpool;
  private startTick: number;
  private ticks: Tick[];

  constructor({ whirlpool, startTick, ticks }: TickArrayConstructorArgs) {
    invariant(ticks.length === NUM_TICKS_IN_ARRAY, "TICK_ARRAY");
    this.whirlpool = whirlpool;
    this.startTick = startTick;
    this.ticks = ticks;
  }

  async getAddress(): Promise<PublicKey> {
    const whirlpoolAddress = await this.whirlpool.getAddress();
    return (
      await PublicKey.findProgramAddress(
        [whirlpoolAddress.toBuffer() /* startTick */],
        this.whirlpool.programId
      )
    )[0];
  }

  // static createInitializeIx() {}
}
