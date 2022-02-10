import { fromX64, WhirlpoolData } from "@orca-so/whirlpool-client-sdk";
import { Address } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
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
  width: number,
  refresh: boolean
): Promise<LiquidityDistribution | null> {
  const datapoints: LiquidityDataPoint[] = [];

  const pool = await dal.getPool(poolAddress, refresh);
  if (!pool) {
    return null;
  }

  const tickArrayAddresses = getSurroundingTickArrayAddresses(
    pool,
    poolAddress,
    width,
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
      const price = new Decimal(1.0001).pow(tickIndex);
      liquidity = liquidity.add(new Decimal(tick.liquidityNet.toString()));
      datapoints.push({ liquidity: new Decimal(liquidity), price, tickIndex });
    });
  });

  return {
    currentPrice: fromX64(pool.sqrtPrice).pow(2),
    currentTickIndex: pool.tickCurrentIndex,
    datapoints,
  };
}

function getSurroundingTickArrayAddresses(
  pool: WhirlpoolData,
  poolAddress: Address,
  width: number,
  programId: PublicKey
): PublicKey[] {
  const tickArrayAddresses: PublicKey[] = [];

  for (let i = -width; i < width + 1; i++) {
    const address = TickUtil.getPdaWithTickIndex(
      pool.tickCurrentIndex,
      pool.tickSpacing,
      poolAddress,
      programId,
      i
    ).publicKey;
    tickArrayAddresses.push(address);
  }

  return tickArrayAddresses;
}
