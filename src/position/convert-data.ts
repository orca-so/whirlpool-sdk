import { Address } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import { UserPositionData, UserPositionRewardInfo } from "../types";
import { DecimalUtil } from "../utils/public/decimal-utils";
import { AccountFetcher } from "../accounts/account-fetcher";
import { toPubKey } from "../utils/address";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { getCollectFeesQuoteInternal } from "./quotes/collect-fees";
import { getCollectRewardsQuoteInternal } from "./quotes/collect-rewards";
import { getPositionPda } from "@orca-so/whirlpool-client-sdk";
import { tickIndexToPrice } from "..";
import { WhirlpoolContext } from "../context";

export async function convertPositionDataToUserPositionData(
  ctx: WhirlpoolContext,
  walletAddress: Address,
  refresh: boolean
): Promise<Record<string, UserPositionData>> {
  const positionAddresses = await getUserPositions(ctx, walletAddress, refresh);

  const result: Record<string, UserPositionData> = {};
  for (const address of positionAddresses) {
    const positionId = toPubKey(address).toBase58();
    const position = await ctx.accountFetcher.getPosition(address, refresh);
    if (!position) {
      console.error(`error - position not found`);
      continue;
    }

    const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, refresh);
    if (!whirlpool) {
      console.error(`error - whirlpool not found`);
      continue;
    }

    const [tickLowerAddress, tickUpperAddress] = TickUtil.getLowerAndUpperTickArrayAddresses(
      position.tickLowerIndex,
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      ctx.program.programId
    );
    const tickArrayLower = await ctx.accountFetcher.getTickArray(tickLowerAddress, false);
    const tickArrayUpper = await ctx.accountFetcher.getTickArray(tickUpperAddress, false);
    if (!tickArrayLower || !tickArrayUpper) {
      console.error(`error - tick array not found`);
      continue;
    }

    const tickLower = TickUtil.getTick(
      tickArrayLower,
      position.tickLowerIndex,
      whirlpool.tickSpacing
    );
    const tickUpper = TickUtil.getTick(
      tickArrayUpper,
      position.tickUpperIndex,
      whirlpool.tickSpacing
    );
    const quoteParam = { whirlpool, position, tickLower, tickUpper };
    const feesQuote = getCollectFeesQuoteInternal(quoteParam);
    const decimalsA = (await ctx.accountFetcher.getMintInfo(whirlpool.tokenMintA, false))?.decimals;
    const decimalsB = (await ctx.accountFetcher.getMintInfo(whirlpool.tokenMintB, false))?.decimals;
    if (decimalsA === undefined || decimalsB === undefined) {
      console.error(`error - decimals not found`);
      continue;
    }
    const decimalFeeOwedA = DecimalUtil.fromU64(feesQuote.feeOwedA, decimalsA);
    const decimalFeeOwedB = DecimalUtil.fromU64(feesQuote.feeOwedB, decimalsB);

    const rewardsQuote = getCollectRewardsQuoteInternal(quoteParam);
    const rewards: UserPositionRewardInfo[] = [];
    for (const [index, { mint, vault }] of whirlpool.rewardInfos.entries()) {
      const amountOwed = rewardsQuote[index];
      const decimals =
        !mint.equals(PublicKey.default) && !vault.equals(PublicKey.default)
          ? (await ctx.accountFetcher.getMintInfo(mint, false))?.decimals
          : undefined;
      const decimalAmountOwed =
        amountOwed && decimals ? DecimalUtil.fromU64(amountOwed, decimals) : undefined;
      rewards.push({
        mint,
        amountOwed,
        decimalAmountOwed,
      });
    }

    result[positionId] = {
      address: toPubKey(address),
      poolAddress: position.whirlpool,
      positionMint: position.positionMint,
      liquidity: position.liquidity,
      tickLowerIndex: position.tickLowerIndex,
      tickUpperIndex: position.tickUpperIndex,
      feeOwedA: feesQuote.feeOwedA,
      feeOwedB: feesQuote.feeOwedB,
      rewards,

      // Derived helper fields
      priceLower: tickIndexToPrice(position.tickLowerIndex, decimalsA, decimalsB),
      priceUpper: tickIndexToPrice(position.tickUpperIndex, decimalsA, decimalsB),
      decimalFeeOwedA,
      decimalFeeOwedB,
    };
  }

  return result;
}

async function getUserPositions(
  ctx: WhirlpoolContext,
  walletAddress: Address,
  refresh: boolean
): Promise<Address[]> {
  const potentialPositionAddresses: Address[] = [];
  const userTokens = await ctx.accountFetcher.listUserTokens(walletAddress, refresh);
  userTokens.forEach(({ amount, decimals, mint }) => {
    if (amount === "1" && decimals === 0 && !!mint) {
      potentialPositionAddresses.push(
        getPositionPda(ctx.program.programId, toPubKey(mint)).publicKey
      );
    }
  });

  const positions = await ctx.accountFetcher.listPositions(potentialPositionAddresses, refresh);
  invariant(potentialPositionAddresses.length === positions.length, "not enough positions data");

  if (refresh) {
    /*** Refresh pools ***/
    const whirlpoolAddresses: Set<string> = new Set();
    positions.forEach((position) => {
      if (position) {
        whirlpoolAddresses.add(position.whirlpool.toBase58());
      }
    });
    const pools = await ctx.accountFetcher.listPools(Array.from(whirlpoolAddresses), refresh);

    /*** Refresh mint infos ***/
    const allMintInfos: Set<string> = new Set();
    pools.forEach((pool) => {
      if (pool) {
        allMintInfos.add(pool.tokenMintA.toBase58());
        allMintInfos.add(pool.tokenMintB.toBase58());
        pool.rewardInfos.forEach(({ mint, vault }) => {
          if (!mint.equals(PublicKey.default) && !vault.equals(PublicKey.default)) {
            allMintInfos.add(mint.toBase58());
          }
        });
      }
    });

    /*** Refresh tick arrays ***/
    const tickArrayAddresses: Set<string> = new Set();
    for (const position of positions) {
      if (position) {
        const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, false);
        if (whirlpool) {
          const [tickLowerAddress, tickUpperAddress] = TickUtil.getLowerAndUpperTickArrayAddresses(
            position.tickLowerIndex,
            position.tickUpperIndex,
            whirlpool.tickSpacing,
            position.whirlpool,
            ctx.program.programId
          );
          tickArrayAddresses.add(tickLowerAddress.toBase58());
          tickArrayAddresses.add(tickUpperAddress.toBase58());
        }
      }
    }

    await Promise.all([
      ctx.accountFetcher.listMintInfos(Array.from(allMintInfos), false),
      ctx.accountFetcher.listTickArrays(Array.from(tickArrayAddresses), true),
    ]);
  }

  return potentialPositionAddresses.filter((_, index) => {
    return positions[index] !== null;
  });
}
