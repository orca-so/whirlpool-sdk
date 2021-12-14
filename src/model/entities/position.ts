import { PublicKey } from "@solana/web3.js";
import { u64 } from "@solana/spl-token";
import { PositionStatus, q64 } from "../../public";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements, WhirlpoolAccount } from ".";

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
export class Position {
  private constructor() {}

  // TODO maybe add typing to the return so only getPosition() can receive
  public static deriveAddress(
    whirlpool: PublicKey,
    positionMint: PublicKey,
    whirlpoolProgram: PublicKey
  ): PublicKey {
    return PDA.derive(whirlpoolProgram, ["position", whirlpool, positionMint]).publicKey;
  }

  public static getPositionStatus(
    whirlpool: WhirlpoolAccount,
    position: PositionAccount
  ): PositionStatus {
    const { tickCurrentIndex } = whirlpool;
    const { tickLower, tickUpper } = position;

    if (tickCurrentIndex < tickLower) {
      return PositionStatus.BelowRange;
    } else if (tickCurrentIndex <= tickUpper) {
      return PositionStatus.InRange;
    } else {
      return PositionStatus.AboveRange;
    }
  }

  public static parse(accountData: Buffer | undefined | null): PositionAccount | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    throw new Error("TODO - implement");
  }
}
