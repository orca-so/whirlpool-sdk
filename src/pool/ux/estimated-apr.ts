import { tickIndexToSqrtPriceX64 } from "@orca-so/whirlpool-client-sdk";
import { PublicKey } from "@solana/web3.js";
import { Decimal } from "decimal.js";
import { DecimalUtil, PoolData } from "../..";
import { zeroSlippage } from "../../constants/defaults";
import { getRemoveLiquidityQuote } from "../../position/quotes/remove-liquidity";
import { TokenUSDPrices } from "../../utils/token-price";

export type EstimatedAprs = {
  fee: number;
  rewards: number[];
};

export function getEstimatedAprForPriceRange(
  fees24h: number,
  tickLower: number,
  tickUpper: number,
  pool: PoolData,
  tokenPrices: TokenUSDPrices
): EstimatedAprs {
  const tokenAPrice = tokenPrices[pool.tokenMintA.toBase58()];
  const tokenBPrice = tokenPrices[pool.tokenMintB.toBase58()];

  if (!tokenAPrice || !tokenBPrice || tickLower >= tickUpper) {
    return { fee: 0, rewards: [0, 0, 0] };
  }

  const poolLiquidity = pool.liquidity;
  const quote = getRemoveLiquidityQuote({
    positionAddress: PublicKey.default,
    tickCurrentIndex: pool.tickCurrentIndex,
    sqrtPrice: pool.sqrtPrice,
    tickLowerIndex: tickLower,
    tickUpperIndex: tickUpper,
    liquidity: poolLiquidity,
    slippageTolerance: zeroSlippage,
  });

  const positionTokenAValue = DecimalUtil.adjustDecimals(
    new Decimal(quote.minTokenA.toString()),
    pool.tokenDecimalsA
  ).mul(tokenAPrice);

  const positionTokenBValue = DecimalUtil.adjustDecimals(
    new Decimal(quote.minTokenB.toString()),
    pool.tokenDecimalsB
  ).mul(tokenBPrice);

  const positionValue = positionTokenAValue.add(positionTokenBValue);
  const feesEarned = new Decimal(fees24h).mul(365);

  return {
    fee: feesEarned.div(positionValue).toNumber(),
    rewards: pool.rewards.map((reward) => {
      const rewardTokenPrice = tokenPrices[reward.mint.toBase58()];

      if (!reward.emissionsPerSecond || !rewardTokenPrice) {
        return 0;
      }

      const rewardsEarned = reward.emissionsPerSecond.mul(60 * 60 * 24 * 365).mul(rewardTokenPrice);
      return rewardsEarned.div(positionValue).toNumber();
    }),
  };
}
