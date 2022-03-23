import { Address } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { PoolRewardInfo } from "../types";
import { AccountFetcher } from "../accounts/account-fetcher";
import { PoolData } from "../types";
import { toPubKey } from "../utils/address";
import { DecimalUtil } from "../utils/public/decimal-utils";
import { fromX64, TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { sqrtPriceX64ToPrice } from "../utils/public";
import { WhirlpoolContext } from "../context";

export async function convertWhirlpoolDataToPoolData(
  ctx: WhirlpoolContext,
  poolAddresses: Address[],
  refresh: boolean
): Promise<Record<string, PoolData>> {
  if (refresh) {
    const pools = await ctx.accountFetcher.listPools(poolAddresses, true);

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
            ctx.program.programId
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
      ctx.accountFetcher.listTokenInfos(Array.from(allTokenAccounts), true),
      ctx.accountFetcher.listMintInfos(Array.from(allMintInfos), false),
      ctx.accountFetcher.listTickArrays(allTickArrays, true),
    ]);
  }

  const result: Record<string, PoolData> = {};
  for (const address of poolAddresses) {
    const poolId = toPubKey(address).toBase58();
    const pool = await ctx.accountFetcher.getPool(address, false);
    if (!pool) {
      console.error(`error - pool not found`);
      continue;
    }

    const amountA = (await ctx.accountFetcher.getTokenInfo(pool.tokenVaultA, false))?.amount;
    const amountB = (await ctx.accountFetcher.getTokenInfo(pool.tokenVaultB, false))?.amount;
    const decimalsA = (await ctx.accountFetcher.getMintInfo(pool.tokenMintA, false))?.decimals;
    const decimalsB = (await ctx.accountFetcher.getMintInfo(pool.tokenMintB, false))?.decimals;
    if (!amountA || !amountB || decimalsA === undefined || decimalsB === undefined) {
      console.error(`error - amount or decimals not found`);
      continue;
    }

    const feePercentage = DecimalUtil.fromNumber(pool.feeRate, 6);
    const protocolFeePercentage = DecimalUtil.fromNumber(pool.protocolFeeRate, 4);

    const rewards: PoolRewardInfo[] = [];
    for (const { mint, vault, emissionsPerSecondX64, growthGlobalX64 } of pool.rewardInfos) {
      let amount = undefined;
      let decimals = undefined;
      if (!mint.equals(PublicKey.default) && !vault.equals(PublicKey.default)) {
        amount = (await ctx.accountFetcher.getTokenInfo(vault, false))?.amount;
        decimals = (await ctx.accountFetcher.getMintInfo(mint, false))?.decimals;
      }

      rewards.push({
        mint,
        vault,
        vaultAmount: amount,
        decimalVaultAmount: decimals && amount ? DecimalUtil.fromU64(amount, decimals) : undefined,
        emissionsPerSecondX64,
        growthGlobalX64,
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
      protocolFeeOwedB: pool.protocolFeeOwedB,
      tokenVaultAmountA: amountA,
      tokenVaultAmountB: amountB,
      rewards,
      feeGrowthGlobalAX64: pool.feeGrowthGlobalA,
      feeGrowthGlobalBX64: pool.feeGrowthGlobalB,

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
