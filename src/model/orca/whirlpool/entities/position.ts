import { PublicKey } from "@solana/web3.js";
import { Whirlpool } from "./whirlpool";

interface PositionConstructorArgs {
  whirlpool: Whirlpool;
  mint: PublicKey;
  tickLower: number;
  tickUpper: number;
}

// account
export class Position {
  private whirlpool: Whirlpool;
  private mint: PublicKey;
  private tickLower: number;
  private tickUpper: number;

  constructor({ whirlpool, mint, tickLower, tickUpper }: PositionConstructorArgs) {
    this.whirlpool = whirlpool;
    this.mint = mint;
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
  }

  async getAddress(): Promise<PublicKey> {
    return (
      await PublicKey.findProgramAddress([this.mint.toBuffer()], this.whirlpool.programId)
    )[0];
  }

  // static createOpenPositionIx() {}
}
