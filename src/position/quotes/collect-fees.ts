import { WhirlpoolData, PositionData, TickData } from "@orca-so/whirlpool-client-sdk";
import { BN } from "@project-serum/anchor";
import { subUnderflowU128, U128, ZERO } from "../../utils/web3/math-utils";
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

  const {
    tickCurrentIndex,
    feeGrowthGlobalA: feeGrowthGlobalAX64,
    feeGrowthGlobalB: feeGrowthGlobalBX64,
  } = whirlpool;
  const {
    tickLowerIndex,
    tickUpperIndex,
    liquidity,
    feeOwedA,
    feeOwedB,
    feeGrowthCheckpointA: feeGrowthCheckpointAX64,
    feeGrowthCheckpointB: feeGrowthCheckpointBX64,
  } = position;
  const {
    feeGrowthOutsideA: tickLowerFeeGrowthOutsideAX64,
    feeGrowthOutsideB: tickLowerFeeGrowthOutsideBX64,
  } = tickLower;
  const {
    feeGrowthOutsideA: tickUpperFeeGrowthOutsideAX64,
    feeGrowthOutsideB: tickUpperFeeGrowthOutsideBX64,
  } = tickUpper;

  // Calculate the fee growths inside the position

  let feeGrowthBelowAX64: BN | null = null;
  let feeGrowthBelowBX64: BN | null = null;

  if (tickCurrentIndex < tickLowerIndex) {
    feeGrowthBelowAX64 = feeGrowthGlobalAX64.sub(tickLowerFeeGrowthOutsideAX64);
    feeGrowthBelowBX64 = feeGrowthGlobalBX64.sub(tickLowerFeeGrowthOutsideBX64);
  } else {
    feeGrowthBelowAX64 = tickLowerFeeGrowthOutsideAX64;
    feeGrowthBelowBX64 = tickLowerFeeGrowthOutsideBX64;
  }

  let feeGrowthAboveAX64: BN | null = null;
  let feeGrowthAboveBX64: BN | null = null;

  if (tickCurrentIndex < tickUpperIndex) {
    feeGrowthAboveAX64 = tickUpperFeeGrowthOutsideAX64;
    feeGrowthAboveBX64 = tickUpperFeeGrowthOutsideBX64;
  } else {
    feeGrowthAboveAX64 = feeGrowthGlobalAX64.sub(tickUpperFeeGrowthOutsideAX64);
    feeGrowthAboveBX64 = feeGrowthGlobalBX64.sub(tickUpperFeeGrowthOutsideBX64);
  }

  const feeGrowthInsideAX64 = subUnderflowU128(
    feeGrowthGlobalAX64.sub(feeGrowthBelowAX64),
    feeGrowthAboveAX64
  );
  const feeGrowthInsideBX64 = subUnderflowU128(
    feeGrowthGlobalBX64.sub(feeGrowthBelowBX64),
    feeGrowthAboveBX64
  );

  // Calculate the updated fees owed
  const feeOwedADelta = subUnderflowU128(feeGrowthInsideAX64, feeGrowthCheckpointAX64)
    .mul(liquidity)
    .shrn(64);
  const feeOwedBDelta = subUnderflowU128(feeGrowthInsideBX64, feeGrowthCheckpointBX64)
    .mul(liquidity)
    .shrn(64);

  const updatedFeeOwedA = feeOwedA.add(feeOwedADelta);
  const updatedFeeOwedB = feeOwedB.add(feeOwedBDelta);

  return {
    feeOwedA: updatedFeeOwedA,
    feeOwedB: updatedFeeOwedB,
  };
}
