import { BN } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { ZERO_SLIPPAGE } from "../../constants/public";
import { getRemoveLiquidityQuote } from "../../position/quotes/remove-liquidity";
import { PoolData, PoolRewardInfo } from "../../types";
import { TokenUSDPrices } from "../token-price";
import { DecimalUtil } from "./decimal-utils";

export type EstimatedAprs = {
  fee: number;
  rewards: number[];
};

export const ZERO_APR = {
  fee: 0,
  rewards: [0, 0, 0],
};

export function estimateAprsForPriceRange(
  pool: PoolData,
  // TODO: should this actually be fetched/shared?
  tokenPrices: TokenUSDPrices,
  fees24h: number,
  tickLowerIndex: number,
  tickUpperIndex: number
): EstimatedAprs {
  const {
    liquidity,
    sqrtPrice,
    tokenMintA,
    tokenMintB,
    tokenDecimalsA,
    tokenDecimalsB,
    tickCurrentIndex,
  } = pool;

  // TODO: do we need to use non-whirlpool prices?
  const tokenPriceA = tokenPrices[tokenMintA.toBase58()];
  const tokenPriceB = tokenPrices[tokenMintB.toBase58()];

  if (!tokenPriceA || !tokenPriceB || tickLowerIndex >= tickUpperIndex) {
    return ZERO_APR;
  }

  // Value of liquidity if the entire liquidity were concentrated between tickLower/Upper
  // Since this is virtual liquidity, concentratedValue should actually be less than totalValue
  // TODO(pax): check math
  const { minTokenA, minTokenB } = getRemoveLiquidityQuote({
    positionAddress: PublicKey.default,
    tickCurrentIndex,
    sqrtPrice,
    tickLowerIndex,
    tickUpperIndex,
    liquidity,
    slippageTolerance: ZERO_SLIPPAGE,
  });
  const tokenValueA = getTokenValue(minTokenA, tokenDecimalsA, tokenPriceA);
  const tokenValueB = getTokenValue(minTokenB, tokenDecimalsB, tokenPriceB);
  const concentratedValue = tokenValueA.add(tokenValueB);

  const feesPerYear = new Decimal(fees24h).mul(365);
  const feeApr = feesPerYear.div(concentratedValue).toNumber();

  const rewards = pool.rewards.map((reward) =>
    estimateRewardApr(reward, concentratedValue, tokenPrices)
  );

  return { fee: feeApr, rewards };
}

const SECONDS_PER_YEAR =
  60 * // SECONDS
  60 * // MINUTES
  24 * // HOURS
  365; // DAYS
function estimateRewardApr(
  reward: PoolRewardInfo,
  concentratedValue: Decimal,
  tokenPrices: TokenUSDPrices
) {
  const { mint, emissionsPerSecond } = reward;
  const rewardTokenPrice = tokenPrices[mint.toBase58()];

  if (!emissionsPerSecond || !rewardTokenPrice) {
    return 0;
  }

  return emissionsPerSecond
    .mul(SECONDS_PER_YEAR)
    .mul(rewardTokenPrice)
    .div(concentratedValue)
    .toNumber();
}

function getTokenValue(tokenAmount: BN, tokenDecimals: number, tokenPrice: Decimal) {
  return DecimalUtil.adjustDecimals(new Decimal(tokenAmount.toString()), tokenDecimals).mul(
    tokenPrice
  );
}
