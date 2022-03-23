import { sqrtPriceX64ToTickIndex, toX64 } from "@orca-so/whirlpool-client-sdk";
import { translateAddress } from "@project-serum/anchor";
import invariant from "tiny-invariant";
import { defaultSlippagePercentage } from "../constants/public";
import { WhirlpoolContext } from "../context";
import {
  OpenPositionQuoteParam,
  OpenPositionQuote,
  isQuoteByTickIndex,
  isQuoteByPrice,
  ClosePositionQuoteParam,
  ClosePositionQuote,
  SwapQuoteParam,
  SwapQuote,
} from "../pool/public";
import {
  InternalAddLiquidityQuoteParam,
  getAddLiquidityQuote,
} from "../position/quotes/add-liquidity";
import { getRemoveLiquidityQuote } from "../position/quotes/remove-liquidity";
import { toPubKey } from "../utils/address";
import { adjustAmountForSlippage } from "../utils/public";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { SwapDirection, AmountSpecified, SwapSimulator } from "./swap-quoter";

/**
 * Construct a quote for opening a new position
 */
async function getOpenPositionQuote(
  ctx: WhirlpoolContext,
  param: OpenPositionQuoteParam
): Promise<OpenPositionQuote> {
  const { poolAddress, tokenMint, tokenAmount, slippageTolerance, refresh } = param;
  const whirlpool = await ctx.accountFetcher.getPool(poolAddress, refresh);
  if (!whirlpool) {
    throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
  }

  let tickLowerIndex = undefined;
  let tickUpperIndex = undefined;

  if (isQuoteByTickIndex(param)) {
    tickLowerIndex = param.tickLowerIndex;
    tickUpperIndex = param.tickUpperIndex;
  } else {
    invariant(isQuoteByPrice(param), "invalid OpenPositionQuoteParam");
    tickLowerIndex = TickUtil.toValid(
      sqrtPriceX64ToTickIndex(toX64(param.priceLower.sqrt())),
      whirlpool.tickSpacing
    );
    tickUpperIndex = TickUtil.toValid(
      sqrtPriceX64ToTickIndex(toX64(param.priceUpper.sqrt())),
      whirlpool.tickSpacing
    );
  }

  const internalParam: InternalAddLiquidityQuoteParam = {
    tokenMintA: whirlpool.tokenMintA,
    tokenMintB: whirlpool.tokenMintB,
    tickCurrentIndex: whirlpool.tickCurrentIndex,
    sqrtPrice: whirlpool.sqrtPrice,
    inputTokenMint: toPubKey(tokenMint),
    inputTokenAmount: tokenAmount,
    tickLowerIndex,
    tickUpperIndex,
    slippageTolerance: slippageTolerance || defaultSlippagePercentage,
  };

  return {
    poolAddress,
    tickLowerIndex,
    tickUpperIndex,
    ...getAddLiquidityQuote(internalParam),
  };
}

/**
 * Construct a quote for closing an existing position
 */
async function getClosePositionQuote(
  ctx: WhirlpoolContext,
  param: ClosePositionQuoteParam
): Promise<ClosePositionQuote> {
  const { positionAddress, refresh, slippageTolerance } = param;
  const position = await ctx.accountFetcher.getPosition(positionAddress, refresh);
  if (!position) {
    throw new Error(`Position not found: ${translateAddress(positionAddress).toBase58()}`);
  }

  const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, refresh);
  if (!whirlpool) {
    throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
  }

  return getRemoveLiquidityQuote({
    positionAddress: toPubKey(positionAddress),
    tickCurrentIndex: whirlpool.tickCurrentIndex,
    sqrtPrice: whirlpool.sqrtPrice,
    tickLowerIndex: position.tickLowerIndex,
    tickUpperIndex: position.tickUpperIndex,
    liquidity: position.liquidity,
    slippageTolerance: slippageTolerance || defaultSlippagePercentage,
  });
}

/**
 * Construct a quote for swap
 */
async function getSwapQuote(ctx: WhirlpoolContext, param: SwapQuoteParam): Promise<SwapQuote> {
  const {
    poolAddress,
    tokenMint,
    tokenAmount,
    isInput,
    slippageTolerance = defaultSlippagePercentage,
    refresh,
  } = param;

  const whirlpool = await ctx.accountFetcher.getPool(poolAddress, refresh);
  if (!whirlpool) {
    throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
  }

  const swapDirection =
    toPubKey(tokenMint).equals(whirlpool.tokenMintA) === isInput
      ? SwapDirection.AtoB
      : SwapDirection.BtoA;
  const amountSpecified = isInput ? AmountSpecified.Input : AmountSpecified.Output;

  const swapSimulator = new SwapSimulator();

  // Return sqrtPriceLimit
  const { amountIn, amountOut, sqrtPriceLimitX64 } = await swapSimulator.simulateSwap(
    ctx,
    {
      refresh,
      dal: ctx.accountFetcher,
      poolAddress,
      whirlpoolData: whirlpool,
      amountSpecified,
      swapDirection,
    },
    {
      amount: tokenAmount,
      currentSqrtPriceX64: whirlpool.sqrtPrice,
      currentTickIndex: whirlpool.tickCurrentIndex,
      currentLiquidity: whirlpool.liquidity,
    }
  );

  const otherAmountThreshold = adjustAmountForSlippage(
    amountIn,
    amountOut,
    slippageTolerance,
    amountSpecified
  );

  return {
    poolAddress,
    otherAmountThreshold,
    sqrtPriceLimitX64,
    amountIn,
    amountOut,
    aToB: swapDirection === SwapDirection.AtoB,
    fixedInput: isInput,
  };
}
