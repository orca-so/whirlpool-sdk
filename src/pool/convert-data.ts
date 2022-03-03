import { Address } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { PoolRewardInfo } from "../types";
import { OrcaDAL } from "../dal/orca-dal";
import { PoolData } from "../types";
import { toPubKey } from "../utils/address";
import { DecimalUtil } from "../utils/public/decimal-utils";
import { fromX64, TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { sqrtPriceX64ToPrice } from "../utils/public";

export async function convertWhirlpoolDataToPoolData(
  dal: OrcaDAL,
  poolAddresses: Address[],
  refresh: boolean
): Promise<Record<string, PoolData>> {
  if (refresh) {
    const pools = await dal.listPools(poolAddresses, true);

    const allTokenAccounts: Set<string> = new Set();
    const allMintInfos: Set<string> = new Set();
    const allTickArrays: Array<string> = [];
    pools.forEach((pool, index) => {
      const poolAddress = poolAddresses[index];
      if (pool && poolAddress) {
        allTokenAccounts.add(pool.tokenVaultA.toBase58());
        allTokenAccounts.add(pool.tokenVaultB.toBase58());
        allMintInfos.add(pool.tokenMintA.toBase58());
        allMintInfos.add(pool.tokenMintB.toBase58());
        allTickArrays.push(
          TickUtil.getPDAWithSqrtPrice(
            pool.sqrtPrice,
            pool.tickSpacing,
            poolAddress,
            dal.programId
          ).publicKey.toBase58()
        );

        pool.rewardInfos.forEach(({ vault, mint }) => {
          if (!mint.equals(PublicKey.default) && !vault.equals(PublicKey.default)) {
            allTokenAccounts.add(vault.toBase58());
            allMintInfos.add(mint.toBase58());
          }
        });
      }
    });
    await Promise.all([
      dal.listTokenInfos(Array.from(allTokenAccounts), true),
      dal.listMintInfos(Array.from(allMintInfos), false),
      dal.listTickArrays(allTickArrays, true),
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

    const feePercentage = DecimalUtil.fromNumber(pool.feeRate, 6);
    const protocolFeePercentage = new Decimal(1).div(
      DecimalUtil.fromNumber(pool.protocolFeeRate, 2)
    );

    const rewards: PoolRewardInfo[] = [];
    for (const { mint, vault, emissionsPerSecondX64 } of pool.rewardInfos) {
      let amount = undefined;
      let decimals = undefined;
      if (!mint.equals(PublicKey.default) && !vault.equals(PublicKey.default)) {
        amount = (await dal.getTokenInfo(vault, false))?.amount;
        decimals = (await dal.getMintInfo(mint, false))?.decimals;
      }

      rewards.push({
        mint,
        vaultAmount: amount,
        decimalVaultAmount: decimals && amount ? DecimalUtil.fromU64(amount, decimals) : undefined,
        emissionsPerSecondX64,
        emissionsPerSecond: decimals
          ? DecimalUtil.adjustDecimals(fromX64(emissionsPerSecondX64), decimals)
          : undefined,
      });
    }

    result[poolId] = {
      address: toPubKey(address),
      tokenMintA: pool.tokenMintA,
      tokenMintB: pool.tokenMintB,
      stable: pool.tickSpacing === TickSpacing.Stable,
      feeRate: pool.feeRate,
      protocolFeeRate: pool.protocolFeeRate,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      tickCurrentIndex: pool.tickCurrentIndex,
      protocolFeeOwedA: pool.protocolFeeOwedA,
      protocolFeeOwedB: pool.protocolFeeOwedA,
      tokenVaultAmountA: amountA,
      tokenVaultAmountB: amountB,
      rewards,

      // Derived helper fields
      feePercentage,
      protocolFeePercentage,
      price: sqrtPriceX64ToPrice(pool.sqrtPrice, decimalsA, decimalsB),
      decimalProtocolFeeOwedA: DecimalUtil.fromU64(pool.protocolFeeOwedA, decimalsA),
      decimalProtocolFeeOwedB: DecimalUtil.fromU64(pool.protocolFeeOwedB, decimalsB),
      decimalTokenVaultAmountA: DecimalUtil.fromU64(amountA, decimalsA),
      decimalTokenVaultAmountB: DecimalUtil.fromU64(amountB, decimalsB),
      tokenDecimalsA: decimalsA,
      tokenDecimalsB: decimalsB,
    };
  }

  return result;
}
