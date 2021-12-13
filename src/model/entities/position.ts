import { PublicKey } from "@solana/web3.js";
import { u64 } from "@solana/spl-token";
import { q64 } from "../../public";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements } from ".";

export interface PositionRewardInfo {
  readonly growthInsideCheckpoint: q64;
  readonly amountOwed: u64;
}

export interface PositionAccount {
  readonly whirlpool: PublicKey;

  readonly positionMint: PublicKey;
  readonly liquidity: u64;
  readonly tickLower: number;
  readonly tickUpper: number;

  readonly feeGrowthCheckpointA: q64;
  readonly feeOwedA: u64;

  readonly feeGrowthCheckpointB: q64;
  readonly feeOwedB: u64;

  readonly rewardInfos: [PositionRewardInfo, PositionRewardInfo, PositionRewardInfo];
}

@staticImplements<ParsableEntity<PositionAccount>>()
export class PositionEntity {
  private constructor() {}

  public static deriveAddress(
    whirlpool: PublicKey,
    positionMint: PublicKey,
    whirlpoolProgram: PublicKey
  ): PublicKey {
    return PDA.derive(whirlpoolProgram, ["position", whirlpool, positionMint]).publicKey;
  }

  public static parse(accountData: Buffer | undefined | null): PositionAccount | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    throw new Error("TODO - implement");
  }
}
