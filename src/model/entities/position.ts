import { PublicKey } from "@solana/web3.js";
import { PositionData, PositionStatus, WhirlpoolData } from "../..";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements } from ".";
import { AccountsCoder, Coder } from "@project-serum/anchor";

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

  public static parse(coder: Coder, accountData: Buffer | undefined | null): PositionData | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    const discriminator = AccountsCoder.accountDiscriminator("position");
    if (discriminator.compare(accountData.slice(0, 8))) {
      return null;
    }
    return coder.accounts.decode("position", accountData);
  }
}
