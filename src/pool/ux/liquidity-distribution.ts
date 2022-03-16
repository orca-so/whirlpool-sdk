import { getTickArrayPda, WhirlpoolData } from "@orca-so/whirlpool-client-sdk";
import { Address, translateAddress } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { sqrtPriceX64ToPrice, tickIndexToPrice } from "../..";
import { OrcaDAL } from "../../dal/orca-dal";
import { toPubKey } from "../../utils/address";
import { TickUtil } from "../../utils/whirlpool/tick-util";

export type LiquidityDataPoint = {
  liquidity: Decimal;
  price: Decimal;
  tickIndex: number;
};
export type LiquidityDistribution = {
  currentPrice: Decimal;
  currentTickIndex: number;
  datapoints: LiquidityDataPoint[];
};

export async function getLiquidityDistribution(
  dal: OrcaDAL,
  poolAddress: Address,
  tickLower: number,
  tickUpper: number,
  refresh: boolean
): Promise<LiquidityDistribution> {
  const datapoints: LiquidityDataPoint[] = [];

  const pool = await dal.getPool(poolAddress, refresh);
  if (!pool) {
    throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
  }

  const tokenDecimalsA = (await dal.getMintInfo(pool.tokenMintA, false))?.decimals;
  if (!tokenDecimalsA) {
    throw new Error(`Token mint not found: ${pool.tokenMintA.toBase58()}`);
  }

  const tokenDecimalsB = (await dal.getMintInfo(pool.tokenMintB, false))?.decimals;
  if (!tokenDecimalsB) {
    throw new Error(`Token mint not found: ${pool.tokenMintB.toBase58()}`);
  }

  const tickArrayAddresses = getSurroundingTickArrayAddresses(
    pool,
    poolAddress,
    tickLower,
    tickUpper,
    dal.programId
  );
  const tickArrays = await dal.listTickArrays(tickArrayAddresses, refresh);

  let absoluteLiquidity = new Decimal(pool.liquidity.toString());
  let liquidity = new Decimal(0);
  tickArrays.forEach((tickArray) => {
    if (!tickArray) {
      return;
    }

    const startIndex = tickArray.startTickIndex;
    tickArray.ticks.forEach((tick, index) => {
      const tickIndex = startIndex + index * pool.tickSpacing;
      const price = tickIndexToPrice(tickIndex, tokenDecimalsA, tokenDecimalsB);
      const liquidityNet = new Decimal(tick.liquidityNet.toString());
      liquidity = liquidity.add(liquidityNet);
      datapoints.push({ liquidity: new Decimal(liquidity), price, tickIndex });

      if (tickIndex === pool.tickCurrentIndex) {
        absoluteLiquidity = absoluteLiquidity.sub(liquidityNet);
      }
    });
  });

  datapoints.forEach((datapoint) => {
    datapoint.liquidity = datapoint.liquidity.add(absoluteLiquidity);
  });

  return {
    currentPrice: sqrtPriceX64ToPrice(pool.sqrtPrice, tokenDecimalsA, tokenDecimalsB),
    currentTickIndex: pool.tickCurrentIndex,
    datapoints,
  };
}

function getSurroundingTickArrayAddresses(
  pool: WhirlpoolData,
  poolAddress: Address,
  tickLower: number,
  tickUpper: number,
  programId: PublicKey
): PublicKey[] {
  const tickArrayAddresses: PublicKey[] = [];

  let startIndex = TickUtil.getStartTickIndex(tickLower, pool.tickSpacing);
  while (startIndex <= tickUpper) {
    const address = getTickArrayPda(
      toPubKey(programId),
      toPubKey(poolAddress),
      startIndex
    ).publicKey;
    tickArrayAddresses.push(address);

    try {
      startIndex = TickUtil.getStartTickIndex(startIndex, pool.tickSpacing, 1);
    } catch (_e) {
      return tickArrayAddresses;
    }
  }
  return tickArrayAddresses;
}
