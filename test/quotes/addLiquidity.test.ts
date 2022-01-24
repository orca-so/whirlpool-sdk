import {
  PositionData,
  PositionRewardInfoData,
  TickArrayData,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

Decimal.set({ precision: 40 });

function deserializeWhirlpool(whirlpoolJson: Record<string, any>): WhirlpoolData {
  return {
    whirlpoolsConfig: new PublicKey(whirlpoolJson.whirlpoolsConfig),
    whirlpoolBump: whirlpoolJson.whirlpoolBump,
    feeRate: new BN(whirlpoolJson.feeRate),
    protocolFeeRate: new BN(whirlpoolJson.protocolFeeRate),
    liquidity: new BN(whirlpoolJson.liquidity),
    sqrtPrice: new BN(whirlpoolJson.sqrtPrice),
    tickCurrentIndex: whirlpoolJson.tickCurrentIndex,
    protocolFeeOwedA: new BN(whirlpoolJson.protocolFeeOwedA),
    protocolFeeOwedB: new BN(whirlpoolJson.protocolFeeOwedB),
    tokenMintA: new PublicKey(whirlpoolJson.tokenMintA),
    tokenVaultA: new PublicKey(whirlpoolJson.tokenVaultA),
    feeGrowthGlobalA: new BN(whirlpoolJson.feeGrowthGlobalA),
    tokenMintB: new PublicKey(whirlpoolJson.tokenMintB),
    tokenVaultB: new PublicKey(whirlpoolJson.tokenVaultB),
    feeGrowthGlobalB: new BN(whirlpoolJson.feeGrowthGlobalA),
    rewardLastUpdatedTimestamp: new BN(whirlpoolJson.rewardLastUpdatedTimestamp),
    rewardInfos: whirlpoolJson.rewardInfos.map((infoJson: Record<string, any>) => ({
      mint: new PublicKey(infoJson.mint),
      vault: new PublicKey(infoJson.vault),
      authority: new PublicKey(infoJson.authority),
      emissionsPerSecondX64: new BN(infoJson.emissionsPerSecondX64),
      growthGlobalX64: new BN(infoJson.growthGlobalX64),
    })),
    tickSpacing: whirlpoolJson.tickSpacing,
  };
}

function deserializeTickArray(tickArrayJson: Record<string, any>): TickArrayData {
  return {
    whirlpool: new PublicKey(tickArrayJson.whirlpool),
    startTickIndex: tickArrayJson.startTickIndex,
    ticks: tickArrayJson.ticks.map((tickJson: Record<string, any>) => ({
      initialized: tickJson.initialized,
      liquidityNet: new BN(tickJson.liquidityNet),
      liquidityGross: new BN(tickJson.liquidityGross),
      feeGrowthOutsideA: new BN(tickJson.feeGrowthOutsideA),
      feeGrowthOutsideB: new BN(tickJson.feeGrowthOutsideB),
      rewardGrowthsOutside: tickJson.rewardGrowthsOutside.map(
        (rewardGrowth: string) => new BN(rewardGrowth)
      ),
    })),
  };
}

function deserializePosition(positionJson: Record<string, any>): PositionData {
  return {
    whirlpool: new PublicKey(positionJson.whirlpool),
    positionMint: new PublicKey(positionJson.positionMint),
    liquidity: new BN(positionJson.liquidity),
    tickLowerIndex: parseInt(positionJson.tickLowerIndex, 10),
    tickUpperIndex: parseInt(positionJson.tickUpperIndex, 10),
    feeGrowthCheckpointA: new BN(positionJson.feeGrowthCheckpointA),
    feeOwedA: new BN(positionJson.feeOwedA),
    feeGrowthCheckpointB: new BN(positionJson.feeGrowthCheckpointB),
    feeOwedB: new BN(positionJson.feeOwedB),
    rewardInfos: positionJson.rewardInfos.map(
      (info: Record<string, any>) =>
        ({
          growthInsideCheckpoint: new BN(info.growthInsideCheckpoint),
          amountOwed: new BN(info.amountOwed),
        } as PositionRewardInfoData)
    ),
  };
}
