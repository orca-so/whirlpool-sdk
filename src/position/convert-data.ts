import { Address } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import { UserPositionData, UserPositionRewardInfo } from "../types";
import { DecimalUtil } from "../utils/public/decimal-utils";
import { OrcaDAL } from "../dal/orca-dal";
import { toPubKey } from "../utils/address";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { getCollectFeesQuoteInternal } from "./quotes/collect-fees";
import { getCollectRewardsQuoteInternal } from "./quotes/collect-rewards";
import { getPositionPda, tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { ONE } from "../utils/web3/math-utils";

export async function convertPositionDataToUserPositionData(
  dal: OrcaDAL,
  walletAddress: Address,
  refresh: boolean
): Promise<Record<string, UserPositionData>> {
  const positionAddresses = await getUserPositions(dal, walletAddress, refresh);

  const result: Record<string, UserPositionData> = {};
  for (const address of positionAddresses) {
    const positionId = toPubKey(address).toBase58();
    const position = await dal.getPosition(address, false);
    if (!position) {
      console.error(`error - position not found`);
      continue;
    }

    const whirlpool = await dal.getPool(position.whirlpool, false);
    if (!whirlpool) {
      console.error(`error - whirlpool not found`);
      continue;
    }

    const [tickLowerAddress, tickUpperAddress] = TickUtil.getLowerAndUpperTickArrayAddresses(
      position.tickLowerIndex,
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      dal.programId
    );
    const tickArrayLower = await dal.getTickArray(tickLowerAddress, false);
    const tickArrayUpper = await dal.getTickArray(tickUpperAddress, false);
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

    const rewardsQuote = getCollectRewardsQuoteInternal(quoteParam);
    const rewards: UserPositionRewardInfo[] = [];
    for (const [index, { mint, vault }] of whirlpool.rewardInfos.entries()) {
      const quote = rewardsQuote[index];
      let decimals = undefined;
      if (!mint.equals(PublicKey.default) && !vault.equals(PublicKey.default)) {
        decimals = (await dal.getMintInfo(mint, false))?.decimals;
      }
      rewards.push({ mint, amountOwed: quote });
    }

    result[positionId] = {
      address: toPubKey(address),
      poolAddress: position.whirlpool,
      positionMint: position.positionMint,
      liquidity: position.liquidity,
      tickLowerIndex: position.tickLowerIndex,
      tickUpperIndex: position.tickUpperIndex,
      priceLower: tickIndexToSqrtPriceX64(position.tickLowerIndex),
      priceUpper: tickIndexToSqrtPriceX64(position.tickUpperIndex),
      feeOwedA: feesQuote.feeOwedA,
      feeOwedB: feesQuote.feeOwedB,
      rewards,
    };
  }

  return result;
}

async function getUserPositions(
  dal: OrcaDAL,
  walletAddress: Address,
  refresh: boolean
): Promise<Address[]> {
  const potentialPositionAddresses: Address[] = [];
  const userTokens = await dal.listUserTokens(walletAddress, refresh);
  userTokens.forEach(({ amount, decimals, mint }) => {
    if (amount?.eq(ONE) && decimals === 0 && !!mint) {
      potentialPositionAddresses.push(getPositionPda(dal.programId, toPubKey(mint)).publicKey);
    }
  });

  const positions = await dal.listPositions(potentialPositionAddresses, false);
  invariant(potentialPositionAddresses.length === positions.length, "not enough positions data");

  if (refresh) {
    /*** Refresh pools ***/
    const whirlpoolAddresses: Set<string> = new Set();
    positions.forEach((position) => {
      if (position) {
        whirlpoolAddresses.add(position.whirlpool.toBase58());
      }
    });
    const pools = await dal.listPools(Array.from(whirlpoolAddresses), false);

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
        const whirlpool = await dal.getPool(position.whirlpool, false);
        if (whirlpool) {
          const [tickLowerAddress, tickUpperAddress] = TickUtil.getLowerAndUpperTickArrayAddresses(
            position.tickLowerIndex,
            position.tickUpperIndex,
            whirlpool.tickSpacing,
            position.whirlpool,
            dal.programId
          );
          tickArrayAddresses.add(tickLowerAddress.toBase58());
          tickArrayAddresses.add(tickUpperAddress.toBase58());
        }
      }
    }

    await Promise.all([
      dal.listMintInfos(Array.from(allMintInfos), false),
      dal.listTickArrays(Array.from(tickArrayAddresses), true),
    ]);
  }

  return potentialPositionAddresses.filter((_, index) => {
    return positions[index] !== null;
  });
}
