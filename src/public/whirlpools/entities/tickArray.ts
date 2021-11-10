import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { Tick, Whirlpool } from ".";
import { getWhirlpoolProgramId, NUM_TICKS_IN_ARRAY } from "../constants";

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

  static async deriveAddress(
    whirlpoolAddress: PublicKey,
    startTick: number,
    programId: PublicKey
  ): Promise<PublicKey> {
    return (
      await PublicKey.findProgramAddress([whirlpoolAddress.toBuffer() /* startTick */], programId)
    )[0];
  }

  static async fetchTickArray(whirlpool: Whirlpool, startTick: number): Promise<any> {
    const whirlpoolAddress = await whirlpool.getAddress();
    const address = TickArray.deriveAddress(whirlpoolAddress, startTick, whirlpool.programId);
    // TODO get acccount with address
    // TODO deserialize using anchor
    return {}; // TickArray
  }

  async getAddress(): Promise<PublicKey> {
    const whirlpoolAddress = await this.whirlpool.getAddress();
    return TickArray.deriveAddress(whirlpoolAddress, this.startTick, this.whirlpool.programId);
  }

  getTick(tickIndex: number): Tick {
    invariant(
      tickIndex >= this.startTick && tickIndex < this.startTick + NUM_TICKS_IN_ARRAY,
      "getTick"
    );
    const localIndex = (tickIndex - this.startTick) % NUM_TICKS_IN_ARRAY; // check
    return this.ticks[localIndex];
  }
}
