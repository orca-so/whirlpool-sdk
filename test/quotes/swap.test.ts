import {
  WhirlpoolData,
  TickArrayData,
  TickData,
  TICK_ARRAY_SIZE,
} from "@orca-so/whirlpool-client-sdk";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { Percentage } from "../../src";
import {
  AmountSpecified,
  MAX_TICK_ARRAY_CROSSINGS,
  SwapDirection,
  SwapSimulator,
  SwapSimulatorConfig,
} from "../../src/pool/quotes/swap-quoter";
import { PoolUtil } from "../../src/utils/whirlpool/pool-util";
import { TickUtil } from "../../src/utils/whirlpool/tick-util";
const WhirlpoolsJSON = require("./fixtures/swap/Whirlpools.json");
const TickArraysJSON = require("./fixtures/swap/TickArrays.json");

function deserializeWhirlpool(whirlpoolJson: Record<string, any>): WhirlpoolData {
  return {
    whirlpoolsConfig: new PublicKey(whirlpoolJson.whirlpoolsConfig),
    whirlpoolBump: whirlpoolJson.whirlpoolBump,
    feeRate: whirlpoolJson.feeRate,
    protocolFeeRate: whirlpoolJson.protocolFeeRate,
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
    const whirlpool = whirlpoolsMap[whirlpoolAddress.toBase58()] as WhirlpoolData;

    async function fetchTickArray(tickIndex: number): Promise<TickArrayData> {
      const tickArrayAddress = TickUtil.getPdaWithTickIndex(
        tickIndex,
        whirlpool.tickSpacing,
        new PublicKey(whirlpoolAddress),
        new PublicKey(whirlpoolProgramId)
      ).publicKey;
      return tickArraysMap[tickArrayAddress.toBase58()]!;
    }

    async function fetchTick(tickIndex: number): Promise<TickData> {
      return TickUtil.getTick(await fetchTickArray(tickIndex), tickIndex, whirlpool.tickSpacing);
    }

    async function getNextInitializedTickIndex(
      currentTickIndex: number,
      tickArraysCrossed: number,
      swapDirection: SwapDirection,
      tickSpacing: number
    ) {
      let nextInitializedTickIndex: number | undefined = undefined;

      while (!nextInitializedTickIndex) {
        const currentTickArray = await fetchTickArray(currentTickIndex);

        let temp;
        if (swapDirection == SwapDirection.AtoB) {
          temp = TickUtil.getPrevInitializedTickIndex(
            currentTickArray,
            currentTickIndex,
            tickSpacing
          );
        } else {
          temp = TickUtil.getNextInitializedTickIndex(
            currentTickArray,
            currentTickIndex,
            tickSpacing
          );
        }

        if (temp) {
          nextInitializedTickIndex = temp;
        } else {
          let nextTick;
          if (swapDirection == SwapDirection.AtoB) {
            nextTick = currentTickArray.startTickIndex - 1;
          } else {
            nextTick = currentTickArray.startTickIndex + TICK_ARRAY_SIZE * tickSpacing - 1;
          }

          if (tickArraysCrossed == MAX_TICK_ARRAY_CROSSINGS) {
            nextInitializedTickIndex = nextTick;
          } else {
            currentTickIndex = nextTick;
            tickArraysCrossed++;
          }
        }
      }

      return {
        tickIndex: nextInitializedTickIndex,
        tickArraysCrossed,
      };
    }

    const swapSimulatorConfig: SwapSimulatorConfig = {
      swapDirection: SwapDirection.BtoA,
      amountSpecified: AmountSpecified.Input,
      feeRate: PoolUtil.getFeeRate(whirlpool.feeRate),
      fetchTick,
      getNextInitializedTickIndex,
    };

    const swapSimulator = new SwapSimulator(swapSimulatorConfig);
    const swapSimulationOutput = await swapSimulator.simulateSwap({
      amount: new u64(7_051_000),
      currentSqrtPriceX64: whirlpool.sqrtPrice,
      currentTickIndex: whirlpool.tickCurrentIndex,
      currentLiquidity: whirlpool.liquidity,
      tickSpacing: whirlpool.tickSpacing,
    });

    expect(swapSimulationOutput.amountIn.toString()).toEqual("7051000");
    expect(swapSimulationOutput.amountOut.toString()).toEqual("437271");
  });
});
