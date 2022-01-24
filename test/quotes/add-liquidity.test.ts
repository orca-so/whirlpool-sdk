import {
  PositionData,
  PositionRewardInfoData,
  TickArrayData,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";
const WhirlpoolsJSON = require("./fixtures/add-liquidity/Whirlpools.json");
const TickArraysJSON = require("./fixtures/add-liquidity/TickArrays.json");
const PositionsJSON = require("./fixtures/add-liquidity/Positions.json");

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

describe("Add Liquidity", () => {
  const whirlpoolsMap: Record<string, WhirlpoolData> = Object.keys(WhirlpoolsJSON).reduce(
    (map, key) => ({
      ...map,
      [key]: deserializeWhirlpool(WhirlpoolsJSON[key]),
    }),
    {}
  );

  const tickArraysMap: Record<string, TickArrayData> = Object.keys(TickArraysJSON).reduce(
    (map, key) => ({
      ...map,
      [key]: deserializeTickArray(TickArraysJSON[key]),
    }),
    {}
  );

  const positionsMap: Record<string, PositionData> = Object.keys(PositionsJSON).reduce(
    (map, key) => ({
      ...map,
      [key]: deserializePosition(PositionsJSON[key]),
    }),
    {}
  );

  test("base case: increase liquidity of a position spanning two tick arrays", () => {
    const whirlpoolProgramId = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
    const whirlpoolAddress = new PublicKey("6wADQSNfubas7sExoKhoFo4vXM72RaYqin3mk7ce3tf7");
    const whirlpool = whirlpoolsMap[whirlpoolAddress.toBase58()];
  });
});
