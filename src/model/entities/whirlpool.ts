import { PublicKey } from "@solana/web3.js";
import { Percentage, WhirlpoolAccount, WhirlpoolRewardInfo } from "../..";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements } from "./types";

@staticImplements<ParsableEntity<WhirlpoolAccount>>()
export class WhirlpoolEntity {
  private constructor() {}

  public static isRewardInitialized(rewardInfo: WhirlpoolRewardInfo): boolean {
    return !PublicKey.default.equals(rewardInfo.mint);
  }

  public static getFeeRate(account: WhirlpoolAccount): Percentage {
    /**
     * Smart Contract comment: https://github.com/orca-so/whirlpool/blob/main/programs/whirlpool/src/state/whirlpool.rs#L9-L11
     * // Stored as hundredths of a basis point
     * // u16::MAX corresponds to ~6.5%
     * pub fee_rate: u16,
     */
    return Percentage.fromFraction(account.feeRate, 1e6);
  }

  public static getProtocolFeeRate(account: WhirlpoolAccount): Percentage {
    /**
     * Smart Contract comment: https://github.com/orca-so/whirlpool/blob/main/programs/whirlpool/src/state/whirlpool.rs#L13-L14
     * // Denominator for portion of fee rate taken (1/x)%
     * pub protocol_fee_rate: u16,
     */
    return Percentage.fromFraction(1, account.protocolFeeRate * 100);
  }

  public static deriveAddress(
    whirlpoolsConfig: PublicKey,
    programId: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey
  ): PublicKey {
    return PDA.derive(programId, ["whirlpool", whirlpoolsConfig, tokenMintA, tokenMintB]).publicKey;
  }

  public static parse(accountData: Buffer | undefined | null): WhirlpoolAccount | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    throw new Error("TODO - import from contract code");
  }
}
