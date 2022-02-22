import { WhirlpoolRewardInfoData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk";
import { Address } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { Percentage } from "../../utils/public/percentage";
import { toPubKey } from "../address";

export class PoolUtil {
  private constructor() {}

  public static isRewardInitialized(rewardInfo: WhirlpoolRewardInfoData): boolean {
    return (
      !PublicKey.default.equals(rewardInfo.mint) && !PublicKey.default.equals(rewardInfo.vault)
    );
  }

  public static getFeeRate(feeRate: number): Percentage {
    /**
     * Smart Contract comment: https://github.com/orca-so/whirlpool/blob/main/programs/whirlpool/src/state/whirlpool.rs#L9-L11
     * // Stored as hundredths of a basis point
     * // u16::MAX corresponds to ~6.5%
     * pub fee_rate: u16,
     */
    return Percentage.fromFraction(feeRate, 1e6); // TODO
  }

  public static getProtocolFeeRate(protocolFeeRate: number): Percentage {
    /**
     * Smart Contract comment: https://github.com/orca-so/whirlpool/blob/main/programs/whirlpool/src/state/whirlpool.rs#L13-L14
     * // Stored as a basis point
     * pub protocol_fee_rate: u16,
     */
    return Percentage.fromFraction(protocolFeeRate, 1e4); // TODO
  }

  public static orderMints(mintX: Address, mintY: Address): [Address, Address] {
    let mintA, mintB;
    if (Buffer.compare(toPubKey(mintX).toBuffer(), toPubKey(mintY).toBuffer()) < 0) {
      mintA = mintX;
      mintB = mintY;
    } else {
      mintA = mintY;
      mintB = mintX;
    }

    return [mintA, mintB];
  }
}
