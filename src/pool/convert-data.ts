import { fromX64 } from "@orca-so/whirlpool-client-sdk";
import { Address } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { PoolRewardInfo } from "../types";
import { OrcaDAL } from "../dal/orca-dal";
import { PoolData } from "../types";
import { toPubKey } from "../utils/address";
import { DecimalUtil } from "../utils/public/decimal-utils";

export async function convertWhirlpoolDataToPoolData(
  dal: OrcaDAL,
  poolAddresses: Address[],
  refresh: boolean
): Promise<Record<string, PoolData>> {
  if (refresh) {
    const pools = await dal.listPools(poolAddresses, true);

    const allTokenAccounts: Set<string> = new Set();
    const allMintInfos: Set<string> = new Set();
    pools.forEach((pool) => {
      if (pool) {
        allTokenAccounts.add(pool.tokenVaultA.toBase58());
        allTokenAccounts.add(pool.tokenVaultB.toBase58());
        allMintInfos.add(pool.tokenMintA.toBase58());
        allMintInfos.add(pool.tokenMintB.toBase58());

        pool.rewardInfos.forEach(({ vault, mint }) => {
          if (!mint.equals(PublicKey.default)) {
            allTokenAccounts.add(vault.toBase58());
            allMintInfos.add(mint.toBase58());
          }
        });
      }
    });
    await Promise.all([
      dal.listTokenInfos(Array.from(allTokenAccounts), true),
      dal.listMintInfos(Array.from(allMintInfos), false),
    ]);
  }

  const result: Record<string, PoolData> = {};
  for (const address of poolAddresses) {
    const poolId = toPubKey(address).toBase58();
    const pool = await dal.getPool(address, false);
    if (!pool) {
      console.error(`error - pool not found`);
      continue;
    }

    const amountA = (await dal.getTokenInfo(pool.tokenVaultA, false))?.amount;
    const amountB = (await dal.getTokenInfo(pool.tokenVaultB, false))?.amount;
    const decimalsA = (await dal.getMintInfo(pool.tokenMintA, false))?.decimals;
    const decimalsB = (await dal.getMintInfo(pool.tokenMintB, false))?.decimals;
    if (!amountA || !amountB || decimalsA === undefined || decimalsB === undefined) {
      console.error(`error - amount or decimals not found`);
      continue;
    }

    const feeRate = DecimalUtil.fromU64(pool.feeRate, 6);
    const protocolFeeRate = new Decimal(1).div(DecimalUtil.fromU64(pool.protocolFeeRate, 2));

    const rewards: PoolRewardInfo[] = [];
    for (const { mint, vault, emissionsPerSecondX64 } of pool.rewardInfos) {
      let amount = undefined;
      let decimals = undefined;
      if (!mint.equals(PublicKey.default)) {
        amount = (await dal.getTokenInfo(vault, false))?.amount;
        decimals = (await dal.getMintInfo(mint, false))?.decimals;
      }

      let vaultAmount = new Decimal(0);
      if (amount && decimals !== undefined) {
        vaultAmount = DecimalUtil.fromU64(amount, decimals);
      }
      rewards.push({ mint, vaultAmount, emissionsPerSecond: fromX64(emissionsPerSecondX64) });
    }

    result[poolId] = {
      address: toPubKey(address),
      tokenMintA: pool.tokenMintA,
      tokenMintB: pool.tokenMintB,
      tickSpacing: pool.tickSpacing,
      feeRate,
      protocolFeeRate,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      tickCurrentIndex: pool.tickCurrentIndex,
      price: fromX64(pool.sqrtPrice).pow(2),
      protocolFeeOwedA: DecimalUtil.fromU64(pool.protocolFeeOwedA, decimalsA),
      protocolFeeOwedB: DecimalUtil.fromU64(pool.protocolFeeOwedA, decimalsA),
      tokenVaultAmountA: DecimalUtil.fromU64(amountA, decimalsA),
      tokenVaultAmountB: DecimalUtil.fromU64(amountB, decimalsB),
      rewards,
    };
  }

  return result;
}
