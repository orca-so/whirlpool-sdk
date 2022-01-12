import { fromX64, NUM_REWARDS, toX64 } from "@orca-so/whirlpool-client-sdk";
import {
  WhirlpoolData,
  PositionData,
  TickData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import Decimal from "decimal.js";
import { DecimalUtil } from "../../utils/math/decimal-utils";
import { WhirlpoolUtil } from "../../utils/whirlpool-util";
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
  const rewardGrowthsBelowX64: Decimal[] = range.map(() => new Decimal(0));
  const rewardGrowthsAboveX64: Decimal[] = range.map(() => new Decimal(0));

  for (const i of range) {
    if (tickCurrentIndex < tickLowerIndex) {
      const growthGlobalX64 = toX64(DecimalUtil.fromU64(whirlpoolRewardsInfos[i].growthGlobalX64));
      const rewardGrowthsOutsideX64 = toX64(DecimalUtil.fromU64(tickLower.rewardGrowthsOutside[i]));
      rewardGrowthsBelowX64[i] = growthGlobalX64.sub(rewardGrowthsOutsideX64);
    } else {
      rewardGrowthsBelowX64[i] = toX64(DecimalUtil.fromU64(tickLower.rewardGrowthsOutside[i]));
    }

    if (tickCurrentIndex < tickUpperIndex) {
      rewardGrowthsAboveX64[i] = toX64(DecimalUtil.fromU64(tickUpper.rewardGrowthsOutside[i]));
    } else {
      const growthGlobalX64 = toX64(DecimalUtil.fromU64(whirlpoolRewardsInfos[i].growthGlobalX64));
      const rewardGrowthsOutsideX64 = toX64(DecimalUtil.fromU64(tickUpper.rewardGrowthsOutside[i]));
      rewardGrowthsAboveX64[i] = growthGlobalX64.sub(rewardGrowthsOutsideX64);
    }
  }

  const rewardGrowthsInsideX64: [Decimal, boolean][] = range.map(() => [new Decimal(0), false]);

  for (const i of range) {
    if (WhirlpoolUtil.isRewardInitialized(whirlpoolRewardsInfos[i])) {
      const growthGlobalX64 = toX64(DecimalUtil.fromU64(whirlpoolRewardsInfos[i].growthGlobalX64));
      rewardGrowthsInsideX64[i] = [
        growthGlobalX64.sub(rewardGrowthsBelowX64[i]).sub(rewardGrowthsAboveX64[i]),
        true,
      ];
    }
  }

  // Calculate the updated rewards owed

  const liquidityX64 = toX64(DecimalUtil.fromU64(liquidity));
  const updatedRewardInfosX64: Decimal[] = range.map(() => new Decimal(0));

  for (const i of range) {
    if (rewardGrowthsInsideX64[i][1]) {
      const amountOwedX64 = toX64(DecimalUtil.fromU64(rewardInfos[i].amountOwed));
      const growthInsideCheckpointX64 = toX64(
        DecimalUtil.fromU64(rewardInfos[i].growthInsideCheckpoint)
      );

      updatedRewardInfosX64[i] = amountOwedX64.add(
        liquidityX64.mul(rewardGrowthsInsideX64[i][0].sub(growthInsideCheckpointX64))
      );
    }
  }

  const rewardExistsA = rewardGrowthsInsideX64[0][1];
  const rewardExistsB = rewardGrowthsInsideX64[1][1];
  const rewardExistsC = rewardGrowthsInsideX64[2][1];

  const rewardOwedAX64 = updatedRewardInfosX64[0];
  const rewardOwedBX64 = updatedRewardInfosX64[1];
  const rewardOwedCX64 = updatedRewardInfosX64[2];

  return {
    rewardOwedA: rewardExistsA ? DecimalUtil.toU64(fromX64(rewardOwedAX64)) : undefined,
    rewardOwedB: rewardExistsB ? DecimalUtil.toU64(fromX64(rewardOwedBX64)) : undefined,
    rewardOwedC: rewardExistsC ? DecimalUtil.toU64(fromX64(rewardOwedCX64)) : undefined,
  };
}
