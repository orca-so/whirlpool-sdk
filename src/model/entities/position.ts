import { PublicKey } from "@solana/web3.js";
import { PositionStatus } from "../../public";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements, WhirlpoolAccount } from ".";
import BN from "bn.js";

export interface PositionRewardInfo {
  readonly growthInsideCheckpoint_Q64x64: BN;
  readonly amountOwed_U64: BN;
}

export interface PositionAccount {
  readonly whirlpool: PublicKey;

  readonly positionMint: PublicKey;
  readonly liquidity_U64: BN;
  readonly tickLower: number;
  readonly tickUpper: number;

  readonly feeGrowthCheckpointA_Q64x64: BN;
  readonly feeOwedA_U64: BN;

  readonly feeGrowthCheckpointB_Q64x64: BN;
  readonly feeOwedB_U64: BN;

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
