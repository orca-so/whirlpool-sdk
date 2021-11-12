import JSBI from "jsbi";
import { PublicKey } from "@solana/web3.js";
import { BigintIsh } from "../constants";
import { Whirlpool } from "./whirlpool";
import invariant from "tiny-invariant";

interface PositionConstructorArgs {
  whirlpool: Whirlpool;
  tickLower: number;
  tickUpper: number;
  liquidity: BigintIsh;
  mint: PublicKey;
}

// account
export class Position {
  public readonly whirlpool: Whirlpool;
  public readonly tickLower: number;
  public readonly tickUpper: number;
  public readonly liquidity: JSBI;
  public readonly mint: PublicKey;

  constructor({ whirlpool, tickLower, tickUpper, liquidity, mint }: PositionConstructorArgs) {
    invariant(tickLower < tickUpper, "TICK_ORDER");

    this.whirlpool = whirlpool;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this.liquidity = JSBI.BigInt(liquidity);
    this.mint = mint;
  }

  async getAddress(): Promise<PublicKey> {
    return (
      await PublicKey.findProgramAddress([this.mint.toBuffer()], this.whirlpool.programId)
    )[0];
  }

  // static createOpenPositionIx() {}
}
