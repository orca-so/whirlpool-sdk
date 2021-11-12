import JSBI from "jsbi";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { u256 } from "../../utils/numbers/u256";

interface WhirlpoolConstructorArgs {
  whirlpoolsConfig: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  programId: PublicKey;
}

// account
export class Whirlpool {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly tokenMintA: PublicKey;
  public readonly tokenMintB: PublicKey;
  public readonly programId: PublicKey;

  public readonly liquidity: JSBI;
  public readonly sqrtPrice: JSBI;
  public readonly tickArrayStart: number; // i32
  public readonly currentTick: number; // i32

  constructor({ whirlpoolsConfig, tokenMintA, tokenMintB, programId }: WhirlpoolConstructorArgs) {
    invariant(!tokenMintA.equals(tokenMintB), "Whirlpool");

    this.whirlpoolsConfig = whirlpoolsConfig;
    this.tokenMintA = tokenMintA;
    this.tokenMintB = tokenMintB;
    this.programId = programId;

    this.liquidity = JSBI.BigInt("1");
    this.sqrtPrice = JSBI.BigInt("1");
    this.tickArrayStart = 1;
    this.currentTick = 1;
  }

  /**
   * Derives the whirlpool address
   *
   * @returns whirlpoolAddress
   */
  async getAddress(): Promise<PublicKey> {
    return (
      await PublicKey.findProgramAddress(
        [
          this.whirlpoolsConfig.toBuffer(),
          this.tokenMintA.toBuffer(),
          this.tokenMintB.toBuffer(),
          // fee tier
        ],
        this.programId
      )
    )[0];
  }
}
