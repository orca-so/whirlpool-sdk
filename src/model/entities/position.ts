import { PublicKey } from "@solana/web3.js";
import { PositionData, PositionStatus, WhirlpoolData } from "../..";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements } from ".";

@staticImplements<ParsableEntity<PositionData>>()
export class PositionEntity {
  private constructor() {}

  public static deriveAddress(positionMint: PublicKey, programId: PublicKey): PublicKey {
    return PDA.derive(programId, ["position", positionMint]).publicKey;
  }

  public static getPositionStatus(
    whirlpool: WhirlpoolData,
    position: PositionData
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

  public static parse(accountData: Buffer | undefined | null): PositionData | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    throw new Error("TODO - import from contract code");
  }
}
