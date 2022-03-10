import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk";
import { Address, translateAddress } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { sqrtPriceX64ToPrice, tickIndexToPrice } from "../..";
import { OrcaDAL } from "../../dal/orca-dal";
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

  let liquidity = new Decimal(0);
  tickArrays.forEach((tickArray) => {
    if (!tickArray) {
      return;
    }

    const startIndex = tickArray.startTickIndex;
    tickArray.ticks.forEach((tick, index) => {
      const tickIndex = startIndex + index * pool.tickSpacing;
      const price = tickIndexToPrice(tickIndex, tokenDecimalsA, tokenDecimalsB);
      liquidity = liquidity.add(new Decimal(tick.liquidityNet.toString()));
      datapoints.push({ liquidity: new Decimal(liquidity), price, tickIndex });
    });
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

  let startTickIndex = TickUtil.getStartTickIndex(tickLower, pool.tickSpacing);
  while (startTickIndex <= tickUpper) {
    const address = TickUtil.getPdaWithTickIndex(
      pool.tickCurrentIndex,
      pool.tickSpacing,
      poolAddress,
      programId
    ).publicKey;
    tickArrayAddresses.push(address);

    startTickIndex = TickUtil.getStartTickIndex(startTickIndex, pool.tickSpacing, 1);
  }

  return tickArrayAddresses;
}
