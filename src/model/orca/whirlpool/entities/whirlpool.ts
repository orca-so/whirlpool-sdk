import { PublicKey } from "@solana/web3.js";
import { FeeTier } from "../../../../public/whirlpools";

interface WhirlpoolConstructorArgs {
  whirlpoolsConfig: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  feeTier: FeeTier;
  programId: PublicKey;
}

// account
export class Whirlpool {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly tokenMintA: PublicKey;
  public readonly tokenMintB: PublicKey;
  public readonly feeTier: FeeTier;
  public readonly programId: PublicKey;

  constructor({
    whirlpoolsConfig,
    tokenMintA,
    tokenMintB,
    feeTier,
    programId,
  }: WhirlpoolConstructorArgs) {
    this.whirlpoolsConfig = whirlpoolsConfig;
    this.tokenMintA = tokenMintA;
    this.tokenMintB = tokenMintB;
    this.feeTier = feeTier;
    this.programId = programId;
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
