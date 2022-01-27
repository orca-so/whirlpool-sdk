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
    const rewardInfo = whirlpoolRewardsInfos[i];
    invariant(!!rewardInfo, "whirlpoolRewardsInfos cannot be undefined");

    const growthGlobalX64 = rewardInfo.growthGlobalX64;
    const lowerRewardGrowthsOutside = tickLower.rewardGrowthsOutside[i];
    const upperRewardGrowthsOutside = tickUpper.rewardGrowthsOutside[i];
    invariant(!!lowerRewardGrowthsOutside, "lowerRewardGrowthsOutside cannot be undefined");
    invariant(!!upperRewardGrowthsOutside, "upperRewardGrowthsOutside cannot be undefined");

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
    const rewardInfo = whirlpoolRewardsInfos[i];
    invariant(!!rewardInfo, "whirlpoolRewardsInfos cannot be undefined");

    const isRewardInitialized = PoolUtil.isRewardInitialized(rewardInfo);

    if (isRewardInitialized) {
      const growthBelowX64 = rewardGrowthsBelowX64[i];
      const growthAboveX64 = rewardGrowthsAboveX64[i];
      invariant(!!growthBelowX64, "growthBelowX64 cannot be undefined");
      invariant(!!growthAboveX64, "growthAboveX64 cannot be undefined");

      const growthInsde = rewardInfo.growthGlobalX64.sub(growthBelowX64).sub(growthAboveX64);
      rewardGrowthsInsideX64[i] = [growthInsde, true];
    }
  }

  // Calculate the updated rewards owed

  const updatedRewardInfosX64: BN[] = range.map(() => new BN(0));

  for (const i of range) {
    const growthInsideX64 = rewardGrowthsInsideX64[i];
    invariant(!!growthInsideX64, "growthInsideX64 cannot be undefined");

    const [rewardGrowthInsideX64, isRewardInitialized] = growthInsideX64;

    if (isRewardInitialized) {
      const rewardInfo = rewardInfos[i];
      invariant(!!rewardInfo, "rewardInfo cannot be undefined");

      const amountOwedX64 = rewardInfo.amountOwed.shln(64);
      const growthInsideCheckpointX64 = rewardInfo.growthInsideCheckpoint;
      updatedRewardInfosX64[i] = amountOwedX64.add(
        liquidity.mul(rewardGrowthInsideX64.sub(growthInsideCheckpointX64))
      );
    }
  }

  invariant(rewardGrowthsInsideX64.length >= 3, "rewards length is less than 3");

  const rewardExistsA = rewardGrowthsInsideX64[0]?.[1];
  const rewardExistsB = rewardGrowthsInsideX64[1]?.[1];
  const rewardExistsC = rewardGrowthsInsideX64[2]?.[1];

  const rewardOwedA = rewardExistsA ? updatedRewardInfosX64[0]?.shrn(64) : undefined;
  const rewardOwedB = rewardExistsB ? updatedRewardInfosX64[1]?.shrn(64) : undefined;
  const rewardOwedC = rewardExistsC ? updatedRewardInfosX64[2]?.shrn(64) : undefined;

  return {
    rewardOwedA,
    rewardOwedB,
    rewardOwedC,
  };
}
