import {
  WhirlpoolData,
  WhirlpoolRewardInfoData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../..";

export class PoolUtil {
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
    return Percentage.fromFraction(1, account.protocolFeeRate.toNumber() * 100);
  }
}
