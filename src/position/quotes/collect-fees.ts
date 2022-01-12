import { fromX64, toX64 } from "@orca-so/whirlpool-client-sdk";
import {
  PositionData,
  TickData,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import Decimal from "decimal.js";
import { DecimalUtil } from "../../utils/math/decimal-utils";
import { CollectFeesQuote } from "../public";

export type InternalGetCollectFeesQuoteParam = {
  whirlpool: WhirlpoolData;
  position: PositionData;
  tickLower: TickData;
  tickUpper: TickData;
};

export function getCollectFeesQuoteInternal(
  param: InternalGetCollectFeesQuoteParam
): CollectFeesQuote {
  const { whirlpool, position, tickLower, tickUpper } = param;

  const { tickCurrentIndex, feeGrowthGlobalA, feeGrowthGlobalB } = whirlpool;
  const {
    tickLowerIndex,
    tickUpperIndex,
    liquidity,
    feeOwedA,
    feeOwedB,
    feeGrowthCheckpointA,
    feeGrowthCheckpointB,
  } = position;
  const {
    feeGrowthOutsideA: tickLowerFeeGrowthOutsideA,
    feeGrowthOutsideB: tickLowerFeeGrowthOutsideB,
  } = tickLower;
  const {
    feeGrowthOutsideA: tickUpperFeeGrowthOutsideA,
    feeGrowthOutsideB: tickUpperFeeGrowthOutsideB,
  } = tickUpper;

  const liquidityX64 = toX64(DecimalUtil.fromU64(liquidity));
  const feeGrowthGlobalAX64 = toX64(DecimalUtil.fromU64(feeGrowthGlobalA));
  const feeGrowthGlobalBX64 = toX64(DecimalUtil.fromU64(feeGrowthGlobalB));
  const feeOwedAX64 = toX64(DecimalUtil.fromU64(feeOwedA));
  const feeOwedBX64 = toX64(DecimalUtil.fromU64(feeOwedB));
  const feeGrowthCheckpointAX64 = toX64(DecimalUtil.fromU64(feeGrowthCheckpointA));
  const feeGrowthCheckpointBX64 = toX64(DecimalUtil.fromU64(feeGrowthCheckpointB));
  const tickLowerFeeGrowthOutsideAX64 = toX64(DecimalUtil.fromU64(tickLowerFeeGrowthOutsideA));
  const tickLowerFeeGrowthOutsideBX64 = toX64(DecimalUtil.fromU64(tickLowerFeeGrowthOutsideB));
  const tickUpperFeeGrowthOutsideAX64 = toX64(DecimalUtil.fromU64(tickUpperFeeGrowthOutsideA));
  const tickUpperFeeGrowthOutsideBX64 = toX64(DecimalUtil.fromU64(tickUpperFeeGrowthOutsideB));

  // Calculate the fee growths inside the position

  let feeGrowthBelowAX64: Decimal | null = null;
  let feeGrowthBelowBX64: Decimal | null = null;

  if (tickCurrentIndex < tickLowerIndex) {
    feeGrowthBelowAX64 = feeGrowthGlobalAX64.sub(tickLowerFeeGrowthOutsideAX64);
    feeGrowthBelowBX64 = feeGrowthGlobalBX64.sub(tickLowerFeeGrowthOutsideBX64);
  } else {
    feeGrowthBelowAX64 = tickLowerFeeGrowthOutsideAX64;
    feeGrowthBelowBX64 = tickLowerFeeGrowthOutsideBX64;
  }

  let feeGrowthAboveAX64: Decimal | null = null;
  let feeGrowthAboveBX64: Decimal | null = null;

  if (tickCurrentIndex < tickUpperIndex) {
    feeGrowthAboveAX64 = tickUpperFeeGrowthOutsideAX64;
    feeGrowthAboveBX64 = tickUpperFeeGrowthOutsideBX64;
  } else {
    feeGrowthAboveAX64 = feeGrowthGlobalAX64.sub(tickUpperFeeGrowthOutsideAX64);
    feeGrowthAboveBX64 = feeGrowthGlobalBX64.sub(tickUpperFeeGrowthOutsideBX64);
  }

  const feeGrowthInsideAX64 = feeGrowthGlobalAX64.sub(feeGrowthBelowAX64).sub(feeGrowthAboveAX64);
  const feeGrowthInsideBX64 = feeGrowthGlobalBX64.sub(feeGrowthBelowBX64).sub(feeGrowthAboveBX64);

  // Calculate the updated fees owed

  const feeOwedADeltaX64 = liquidityX64.mul(feeGrowthInsideAX64).sub(feeGrowthCheckpointAX64);
  const feeOwedBDeltaX64 = liquidityX64.mul(feeGrowthInsideBX64).sub(feeGrowthCheckpointBX64);

  const updatedFeeOwedAX64 = feeOwedAX64.add(feeOwedADeltaX64);
  const updatedFeeOwedBX64 = feeOwedBX64.add(feeOwedBDeltaX64);

  // TODO decimal point shold be moved or no?
  return {
    feeOwedA: DecimalUtil.toU64(fromX64(updatedFeeOwedAX64)),
    feeOwedB: DecimalUtil.toU64(fromX64(updatedFeeOwedBX64)),
  };
}
