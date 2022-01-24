import {
  TickArrayData,
  TickData,
  TICK_ARRAY_SIZE,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";
import { Percentage } from "../../src";
import {
  AmountSpecified,
  SwapDirection,
  SwapSimulator,
  SwapSimulatorConfig,
} from "../../src/pool/quotes/swap-quoter";
import { PoolUtil } from "../../src/utils/whirlpool/pool-util";
import { TickArrayOutOfBoundsError, TickUtil } from "../../src/utils/whirlpool/tick-util";
const WhirlpoolsJSON = require("./fixtures/swap/Whirlpools.json");
const TickArraysJSON = require("./fixtures/swap/TickArrays.json");

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

describe("swap", () => {
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

  test("base case", async () => {
    const whirlpoolProgramId = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
    const whirlpoolAddress = new PublicKey("FwfmTvRho5L8ATYssQtXoDrqJRi3AhJrdzf3eCwaL2T6");
    const whirlpool = whirlpoolsMap[whirlpoolAddress.toBase58()];

    async function fetchTickArray(tickIndex: Decimal): Promise<TickArrayData> {
      const tickArrayAddress = TickUtil.getAddressContainingTickIndex(
        tickIndex.toNumber(),
        whirlpool.tickSpacing,
        new PublicKey(whirlpoolAddress),
        new PublicKey(whirlpoolProgramId)
      );
      return tickArraysMap[tickArrayAddress.toBase58()]!;
    }

    async function fetchTick(tickIndex: Decimal): Promise<TickData> {
      return TickUtil.getTick(
        await fetchTickArray(tickIndex),
        tickIndex.toNumber(),
        whirlpool.tickSpacing
      );
    }

    async function getPrevInitializedTickIndex(): Promise<Decimal> {
      let currentTickIndex = whirlpool.tickCurrentIndex;
      let prevInitializedTickIndex: number | undefined = undefined;

      while (!prevInitializedTickIndex) {
        const currentTickArray = await fetchTickArray(new Decimal(currentTickIndex));

        console.log("FINDING PREV TICK");

        try {
          prevInitializedTickIndex = TickUtil.getPrevInitializedTickIndex(
            currentTickArray,
            currentTickIndex,
            whirlpool.tickSpacing
          );
        } catch (err) {
          if (err instanceof TickArrayOutOfBoundsError) {
            currentTickIndex = currentTickArray.startTickIndex - whirlpool.tickSpacing;
          } else {
            throw err;
          }
        }
      }

      return new Decimal(prevInitializedTickIndex);
    }

    async function getNextInitializedTickIndex(): Promise<Decimal> {
      let currentTickIndex = whirlpool.tickCurrentIndex;
      let prevInitializedTickIndex: number | undefined = undefined;

      while (!prevInitializedTickIndex) {
        const currentTickArray = await fetchTickArray(new Decimal(currentTickIndex));

        console.log("FINDING NEXT TICK");

        try {
          prevInitializedTickIndex = TickUtil.getNextInitializedTickIndex(
            currentTickArray,
            currentTickIndex,
            whirlpool.tickSpacing
          );
        } catch (err) {
          if (err instanceof TickArrayOutOfBoundsError) {
            currentTickIndex =
              currentTickArray.startTickIndex + whirlpool.tickSpacing * TICK_ARRAY_SIZE;
          } else {
            throw err;
          }
        }
      }

      return new Decimal(prevInitializedTickIndex);
    }

    const swapSimulatorConfig: SwapSimulatorConfig = {
      swapDirection: SwapDirection.BtoA,
      amountSpecified: AmountSpecified.Input,
      feeRate: PoolUtil.getFeeRate(whirlpool),
      protocolFeeRate: PoolUtil.getProtocolFeeRate(whirlpool),
      slippageTolerance: Percentage.fromFraction(25, 1000), // 2.5% just to give enough room
      fetchTickArray,
      fetchTick,
      getPrevInitializedTickIndex,
      getNextInitializedTickIndex,
    };

    const swapSimulator = new SwapSimulator(swapSimulatorConfig);
    const swapSimulationOutput = await swapSimulator.simulateSwap({
      amount: new Decimal(7_051_000),
      currentTickArray: await fetchTickArray(new Decimal(whirlpool.tickCurrentIndex)),
      currentSqrtPriceX64: new Decimal(whirlpool.sqrtPrice.toString()),
      currentTickIndex: new Decimal(whirlpool.tickCurrentIndex),
      currentLiquidity: new Decimal(whirlpool.liquidity.toString()),
    });

    console.log(JSON.stringify(swapSimulationOutput, null, 2));
    expect(1).toEqual(1);
  });
});