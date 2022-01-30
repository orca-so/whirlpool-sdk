import { fromX64 } from "@orca-so/whirlpool-client-sdk";
import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { Address } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { OrcaDAL } from "../dal/orca-dal";
import { toPubKey } from "../utils/address";
import { TickUtil } from "../utils/whirlpool/tick-util";

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
  refresh: boolean
): Promise<LiquidityDistribution | null> {
  const datapoints: LiquidityDataPoint[] = [];

  const pool = await dal.getPool(poolAddress, refresh);
  if (pool) {
    const tickArrayAddresses = getSurroundingTickArrayAddresses(pool, poolAddress, dal.programId);
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

  return null;
}

// TODO min, max check for left edge and right edge
function getSurroundingTickArrayAddresses(
  pool: WhirlpoolData,
  poolAddress: Address,
  programId: PublicKey
): [PublicKey, PublicKey, PublicKey] {
  const tickAddress0 = TickUtil.getPdaWithTickIndex(
    pool.tickCurrentIndex,
    pool.tickSpacing,
    toPubKey(poolAddress),
    programId,
    -1
  ).publicKey;
  const tickAddress1 = TickUtil.getPdaWithTickIndex(
    pool.tickCurrentIndex,
    pool.tickSpacing,
    toPubKey(poolAddress),
    programId,
    0
  ).publicKey;
  const tickAddress2 = TickUtil.getPdaWithTickIndex(
    pool.tickCurrentIndex,
    pool.tickSpacing,
    toPubKey(poolAddress),
    programId,
    1
  ).publicKey;
  return [tickAddress0, tickAddress1, tickAddress2];
}
