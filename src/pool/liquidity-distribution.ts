import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { Address } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { OrcaDAL } from "../dal/orca-dal";
import { toPubKey } from "../utils/address";
import { TickUtil } from "../utils/whirlpool/tick-util";

export type LiquidityDataPoint = {
  liquidity: u64;
  tickIndex: number;
};
export type LiquidityDistribution = LiquidityDataPoint[];

export async function getLiquidityDistribution(
  dal: OrcaDAL,
  poolAddress: Address,
  refresh: boolean
): Promise<LiquidityDistribution | null> {
  const result: LiquidityDistribution = [];

  const pool = await dal.getPool(poolAddress, refresh);
  if (pool) {
    const tickArrayAddresses = getSurroundingTickArrayAddresses(pool, poolAddress, dal.programId);
    const tickArrays = await dal.listTickArrays(tickArrayAddresses, refresh);
  }

  return result;
}

function getSurroundingTickArrayAddresses(
  pool: WhirlpoolData,
  poolAddress: Address,
  programId: PublicKey
): [PublicKey, PublicKey, PublicKey] {
  const tickAddress1 = TickUtil.getAddressContainingTickIndex(
    pool.tickCurrentIndex,
    pool.tickSpacing,
    toPubKey(poolAddress),
    programId
  );
  return [tickAddress1, tickAddress1, tickAddress1];
}
