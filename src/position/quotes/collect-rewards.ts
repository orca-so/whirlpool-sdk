import { NUM_REWARDS } from "@orca-so/whirlpool-client-sdk";
import {
  WhirlpoolData,
  PositionData,
  TickData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { BN } from "@project-serum/anchor";
import invariant from "tiny-invariant";
import { PoolUtil } from "../../utils/whirlpool/pool-util";
import { CollectRewardsQuote } from "../public";

export type InternalGetCollectRewardsQuoteParam = {
  whirlpool: WhirlpoolData;
  position: PositionData;
  tickLower: TickData;
  tickUpper: TickData;
};

export function getCollectRewardsQuoteInternal(
  param: InternalGetCollectRewardsQuoteParam
): CollectRewardsQuote {
  const { whirlpool, position, tickLower, tickUpper } = param;

  const { tickCurrentIndex, rewardInfos: whirlpoolRewardsInfos } = whirlpool;
  const { tickLowerIndex, tickUpperIndex, liquidity, rewardInfos } = position;

  // Calculate the reward growths inside the position

  const range = [...Array(NUM_REWARDS).keys()];
  const rewardGrowthsBelowX64: BN[] = range.map(() => new BN(0));
  const rewardGrowthsAboveX64: BN[] = range.map(() => new BN(0));

  for (const i of range) {
    const growthGlobalX64 = whirlpoolRewardsInfos[i].growthGlobalX64;
    const lowerRewardGrowthsOutside = tickLower.rewardGrowthsOutside[i];
    const upperRewardGrowthsOutside = tickUpper.rewardGrowthsOutside[i];

    if (tickCurrentIndex < tickLowerIndex) {
      rewardGrowthsBelowX64[i] = growthGlobalX64.sub(lowerRewardGrowthsOutside);
    } else {
      rewardGrowthsBelowX64[i] = lowerRewardGrowthsOutside;
    }

    if (tickCurrentIndex < tickUpperIndex) {
      rewardGrowthsAboveX64[i] = upperRewardGrowthsOutside;
    } else {
      rewardGrowthsAboveX64[i] = growthGlobalX64.sub(upperRewardGrowthsOutside);
    }
  }

  const rewardGrowthsInsideX64: [BN, boolean][] = range.map(() => [new BN(0), false]);

  for (const i of range) {
    const isRewardInitialized = PoolUtil.isRewardInitialized(whirlpoolRewardsInfos[i]);

    if (isRewardInitialized) {
      const growthInsde = whirlpoolRewardsInfos[i].growthGlobalX64
        .sub(rewardGrowthsBelowX64[i])
        .sub(rewardGrowthsAboveX64[i]);
      rewardGrowthsInsideX64[i] = [growthInsde, true];
    }
  }

  // Calculate the updated rewards owed

  const updatedRewardInfosX64: BN[] = range.map(() => new BN(0));

  for (const i of range) {
    const [rewardGrowthInsideX64, isRewardInitialized] = rewardGrowthsInsideX64[i];

    if (isRewardInitialized) {
      const amountOwedX64 = rewardInfos[i].amountOwed.shln(64);
      const growthInsideCheckpointX64 = rewardInfos[i].growthInsideCheckpoint;
      updatedRewardInfosX64[i] = amountOwedX64.add(
        liquidity.mul(rewardGrowthInsideX64.sub(growthInsideCheckpointX64))
      );
    }
  }

  invariant(rewardGrowthsInsideX64.length >= 3, "rewards length is less than 3");

  const rewardExistsA = rewardGrowthsInsideX64[0][1];
  const rewardExistsB = rewardGrowthsInsideX64[1][1];
  const rewardExistsC = rewardGrowthsInsideX64[2][1];

  const rewardOwedA = rewardExistsA ? updatedRewardInfosX64[0].shrn(64) : undefined;
  const rewardOwedB = rewardExistsB ? updatedRewardInfosX64[1].shrn(64) : undefined;
  const rewardOwedC = rewardExistsC ? updatedRewardInfosX64[2].shrn(64) : undefined;

  return {
    rewardOwedA,
    rewardOwedB,
    rewardOwedC,
  };
}
