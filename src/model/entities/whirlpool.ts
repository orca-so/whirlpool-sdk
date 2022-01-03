import { AccountsCoder, Coder } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../..";
import { WhirlpoolData, WhirlpoolRewardInfoData } from "../../public/mock";
import { PDA } from "../utils/pda";
import { ParsableEntity, staticImplements } from "./types";

@staticImplements<ParsableEntity<WhirlpoolData>>()
export class WhirlpoolEntity {
  private constructor() {}

  public static isRewardInitialized(rewardInfo: WhirlpoolRewardInfoData): boolean {
    return !PublicKey.default.equals(rewardInfo.mint);
  }

  public static getFeeRate(account: WhirlpoolData): Percentage {
    /**
     * Smart Contract comment: https://github.com/orca-so/whirlpool/blob/main/programs/whirlpool/src/state/whirlpool.rs#L9-L11
     * // Stored as hundredths of a basis point
     * // u16::MAX corresponds to ~6.5%
     * pub fee_rate: u16,
     */
    return Percentage.fromFraction(account.feeRate, 1e6);
  }

  public static getProtocolFeeRate(account: WhirlpoolData): Percentage {
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

  public static parse(coder: Coder, accountData: Buffer | undefined | null): WhirlpoolData | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    const discriminator = AccountsCoder.accountDiscriminator("whirlpool");
    if (discriminator.compare(accountData.slice(0, 8))) {
      return null;
    }
    return coder.accounts.decode("whirlpool", accountData);
  }
}
