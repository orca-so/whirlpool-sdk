import { Address, BN, Provider } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  ClosePositionQuote,
  ClosePositionQuoteParam,
  ClosePositionTxParam,
  isQuoteByPrice,
  isQuoteByTickIndex,
  OpenPositionQuote,
  OpenPositionQuoteParam,
  OpenPositionTxParam,
  SwapQuote,
  SwapQuoteParam,
  SwapTxParam,
} from "./public/types";
import { defaultSlippagePercentage } from "../constants/defaults";
import { OrcaDAL } from "../dal/orca-dal";
import {
  getAddLiquidityQuote,
  InternalAddLiquidityQuoteParam,
} from "../position/quotes/add-liquidity";
import { getRemoveLiquidityQuote } from "../position/quotes/remove-liquidity";
import { toPubKey } from "../utils/address";
import { MultiTransactionBuilder } from "../utils/public/multi-transaction-builder";
import { deriveATA, resolveOrCreateATA } from "../utils/web3/ata-utils";
import { PoolUtil } from "../utils/whirlpool/pool-util";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { getLiquidityDistribution, LiquidityDistribution } from "./ux/liquidity-distribution";
import {
  AmountSpecified,
  MAX_TICK_ARRAY_CROSSINGS,
  SwapDirection,
  SwapSimulator,
} from "./quotes/swap-quoter";
import {
  TickSpacing,
  PDA,
  getWhirlpoolPda,
  getTickArrayPda,
  getPositionPda,
  TransactionBuilder,
  sqrtPriceX64ToTickIndex,
  toX64,
  TICK_ARRAY_SIZE,
  WhirlpoolClient,
  WhirlpoolContext,
  InitTickArrayParams,
} from "@orca-so/whirlpool-client-sdk";
import { getMultipleCollectFeesAndRewardsTx } from "../position/txs/fees-and-rewards";

export class OrcaPool {
  constructor(private readonly dal: OrcaDAL) {}

  /*** Utilities ***/

  /**
   * Create liquidity distribution across three tick-arrays for a pool.
   * Useful for visualizing the liquidity in the pool.
   *
   * @param poolAddress
   * @param width
   * @param refresh
   * @returns liquidity distribution
   */
  public async getLiquidityDistribution(
    poolAddress: Address,
    width: number,
    refresh = true
  ): Promise<LiquidityDistribution | null> {
    return await getLiquidityDistribution(this.dal, poolAddress, width, refresh);
  }

  /**
   * Derive the pool pda given token mints and tick spacing
   *
   * @param tokenMintA
   * @param tokenMintB
   * @param stable
   * @returns
   */
  public derivePDA(tokenMintA: Address, tokenMintB: Address, stable: boolean): PDA {
    const [_tokenMintA, _tokenMintB] = PoolUtil.orderMints(tokenMintA, tokenMintB);
    return getWhirlpoolPda(
      this.dal.programId,
      this.dal.whirlpoolsConfig,
      toPubKey(_tokenMintA),
      toPubKey(_tokenMintB),
      stable ? TickSpacing.Stable : TickSpacing.Standard
    );
  }

  /*** Transactions ***/

  /**
   * Construct a transaction for opening an new position
   */
  public async getOpenPositionTx(
    param: OpenPositionTxParam
  ): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey } | null> {
    const {
      provider,
      quote: { maxTokenA, maxTokenB, liquidity, tickLowerIndex, tickUpperIndex, poolAddress },
    } = param;
    invariant(liquidity.gt(new u64(0)), "liquidity must be greater than zero");

    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.dal.getPool(poolAddress, false);
    if (!whirlpool) {
      return null;
    }

    const positionMintKeypair = Keypair.generate();
    const positionPda = getPositionPda(this.dal.programId, positionMintKeypair.publicKey);
    const positionTokenAccountAddress = await deriveATA(
      provider.wallet.publicKey,
      positionMintKeypair.publicKey
    );

    const txBuilder = new TransactionBuilder(ctx.provider);

    const positionIx = client
      .openPositionTx({
        funder: provider.wallet.publicKey,
        ownerKey: provider.wallet.publicKey,
        positionPda,
        positionMintAddress: positionMintKeypair.publicKey,
        positionTokenAccountAddress,
        whirlpoolKey: toPubKey(poolAddress),
        tickLowerIndex,
        tickUpperIndex,
      })
      .compressIx(false);
    txBuilder.addInstruction(positionIx).addSigner(positionMintKeypair);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintA
    );
    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintB
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const tickArrayLowerPda = TickUtil.getPdaWithTickIndex(
      tickLowerIndex,
      whirlpool.tickSpacing,
      poolAddress,
      this.dal.programId
    );
    const tickArrayUpperPda = TickUtil.getPdaWithTickIndex(
      tickUpperIndex,
      whirlpool.tickSpacing,
      poolAddress,
      this.dal.programId
    );
    const [tickArrayLower, tickArrayUpper] = await this.dal.listTickArrays(
      [tickArrayLowerPda.publicKey, tickArrayUpperPda.publicKey],
      true
    );

    if (tickArrayLower === null) {
      const tickArrayIx = client
        .initTickArrayTx({
          whirlpool: toPubKey(poolAddress),
          tickArrayPda: tickArrayLowerPda,
          startTick: TickUtil.getStartTickIndex(tickLowerIndex, whirlpool.tickSpacing),
          funder: provider.wallet.publicKey,
        })
        .compressIx(false);
      txBuilder.addInstruction(tickArrayIx);
    }

    if (
      tickArrayUpper === null &&
      !tickArrayLowerPda.publicKey.equals(tickArrayUpperPda.publicKey)
    ) {
      const tickArrayIx = client
        .initTickArrayTx({
          whirlpool: toPubKey(poolAddress),
          tickArrayPda: tickArrayUpperPda,
          startTick: TickUtil.getStartTickIndex(tickUpperIndex, whirlpool.tickSpacing),
          funder: provider.wallet.publicKey,
        })
        .compressIx(false);
      txBuilder.addInstruction(tickArrayIx);
    }

    const liquidityIx = client
      .increaseLiquidityTx({
        liquidityAmount: liquidity,
        tokenMaxA: maxTokenA,
        tokenMaxB: maxTokenB,
        whirlpool: toPubKey(poolAddress),
        positionAuthority: provider.wallet.publicKey,
        position: positionPda.publicKey,
        positionTokenAccount: positionTokenAccountAddress,
        tokenOwnerAccountA,
        tokenOwnerAccountB,
        tokenVaultA: whirlpool.tokenVaultA,
        tokenVaultB: whirlpool.tokenVaultB,
        tickArrayLower: tickArrayLowerPda.publicKey,
        tickArrayUpper: tickArrayUpperPda.publicKey,
      })
      .compressIx(false);
    txBuilder.addInstruction(liquidityIx);

    return {
      mint: positionMintKeypair.publicKey,
      tx: new MultiTransactionBuilder(provider, [txBuilder]),
    };
  }

  public async getInitTickArrayTx(
    provider: Provider,
    param: InitTickArrayParams
  ): Promise<TransactionBuilder> {
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);
    return client.initTickArrayTx(param);
  }

  /**
   * Construct a transaction for closing an existing position
   */
  public async getClosePositionTx(param: ClosePositionTxParam): Promise<TransactionBuilder | null> {
    const { provider, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.dal.getPosition(quote.positionAddress, true);
    if (!position) {
      return null;
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, false);
    if (!whirlpool) {
      return null;
    }

    const tickArrayLower = TickUtil.getPdaWithTickIndex(
      position.tickLowerIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.dal.programId
    ).publicKey;
    const tickArrayUpper = TickUtil.getPdaWithTickIndex(
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.dal.programId
    ).publicKey;

    const positionTokenAccount = await deriveATA(provider.wallet.publicKey, position.positionMint);

    const txBuilder = new TransactionBuilder(provider);

    /* Collect fees and rewards from the position */

    const collectTx = await getMultipleCollectFeesAndRewardsTx(this.dal, {
      provider,
      positionAddresses: [quote.positionAddress],
    });
    if (!collectTx) {
      return null;
    }
    collectTx.tx.txBuilders.forEach((builder) =>
      txBuilder.addInstruction(builder.compressIx(false))
    );
    const tokenOwnerAccountA = collectTx.ataMap[whirlpool.tokenMintA.toBase58()]?.address;
    const tokenOwnerAccountB = collectTx.ataMap[whirlpool.tokenMintB.toBase58()]?.address;
    invariant(tokenOwnerAccountA, "tokenOwnerAccountA doesn't exist");
    invariant(tokenOwnerAccountB, "tokenOwnerAccountB doesn't exist");

    /* Remove all liquidity remaining in the position */

    if (position.liquidity.gt(new u64(0))) {
      const liquidityIx = client
        .decreaseLiquidityTx({
          liquidityAmount: position.liquidity,
          tokenMinA: quote.minTokenA,
          tokenMinB: quote.minTokenB,
          whirlpool: position.whirlpool,
          positionAuthority: provider.wallet.publicKey,
          position: toPubKey(quote.positionAddress),
          positionTokenAccount,
          tokenOwnerAccountA,
          tokenOwnerAccountB,
          tokenVaultA: whirlpool.tokenVaultA,
          tokenVaultB: whirlpool.tokenVaultB,
          tickArrayLower,
          tickArrayUpper,
        })
        .compressIx(false);
      txBuilder.addInstruction(liquidityIx);
    }

    /* Close position */

    const positionIx = client
      .closePositionTx({
        positionAuthority: provider.wallet.publicKey,
        receiver: provider.wallet.publicKey,
        positionTokenAccount,
        position: toPubKey(quote.positionAddress),
        positionMint: position.positionMint,
      })
      .compressIx(false);
    txBuilder.addInstruction(positionIx);

    return txBuilder;
  }

  /**
   * Construct a transaction for a swap
   */
  public async getSwapTx(param: SwapTxParam): Promise<MultiTransactionBuilder | null> {
    const {
      provider,
      quote: { sqrtPriceLimitX64, amountIn, amountOut, aToB, fixedOutput, poolAddress },
    } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.dal.getPool(poolAddress, true);
    if (!whirlpool) {
      return null;
    }

    const txBuilder = new TransactionBuilder(ctx.provider);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintA
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);

    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintB
    );
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const tickArrayAddresses = this.getTickArrayPublicKeysForSwap(
      whirlpool.sqrtPrice,
      sqrtPriceLimitX64,
      whirlpool.tickSpacing,
      toPubKey(poolAddress),
      this.dal.programId
    );

    txBuilder.addInstruction(
      client
        .swapTx({
          amount: fixedOutput ? amountOut : amountIn,
          sqrtPriceLimit: sqrtPriceLimitX64,
          amountSpecifiedIsInput: !fixedOutput,
          aToB,
          whirlpool: toPubKey(poolAddress),
          tokenAuthority: provider.wallet.publicKey,
          tokenOwnerAccountA,
          tokenVaultA: whirlpool.tokenVaultA,
          tokenOwnerAccountB,
          tokenVaultB: whirlpool.tokenVaultB,
          tickArray0: tickArrayAddresses[0],
          tickArray1: tickArrayAddresses[1],
          tickArray2: tickArrayAddresses[2],
        })
        .compressIx(false)
    );

    return new MultiTransactionBuilder(provider, [txBuilder]);
  }

  private getTickArrayPublicKeysForSwap(
    currentSqrtPriceX64: BN,
    targetSqrtPriceX64: BN,
    tickSpacing: number,
    poolAddress: PublicKey,
    programId: PublicKey
  ): [PublicKey, PublicKey, PublicKey] {
    const currentTickIndex = sqrtPriceX64ToTickIndex(currentSqrtPriceX64);
    const targetTickIndex = sqrtPriceX64ToTickIndex(targetSqrtPriceX64);

    let currentStartTickIndex = TickUtil.getStartTickIndex(currentTickIndex, tickSpacing);
    const targetStartTickIndex = TickUtil.getStartTickIndex(targetTickIndex, tickSpacing);

    const offset = currentTickIndex < targetTickIndex ? 1 : -1;

    let count = 1;
    const tickArrayAddresses: [PublicKey, PublicKey, PublicKey] = [
      getTickArrayPda(programId, poolAddress, currentStartTickIndex).publicKey,
      PublicKey.default,
      PublicKey.default,
    ];

    while (currentStartTickIndex != targetStartTickIndex) {
      currentStartTickIndex = TickUtil.getStartTickIndex(
        currentTickIndex,
        tickSpacing,
        offset * count
      );
      tickArrayAddresses[count] = getTickArrayPda(
        programId,
        poolAddress,
        currentStartTickIndex
      ).publicKey;
      count++;
    }

    while (count < 3) {
      tickArrayAddresses[count] = getTickArrayPda(
        programId,
        poolAddress,
        currentStartTickIndex
      ).publicKey;
      count++;
    }

    return tickArrayAddresses;
  }

  /*** Quotes ***/

  /**
   * Construct a quote for opening a new position
   */
  public async getOpenPositionQuote(
    param: OpenPositionQuoteParam
  ): Promise<OpenPositionQuote | null> {
    const { poolAddress, tokenMint, tokenAmount, slippageTolerance, refresh } = param;
    const whirlpool = await this.dal.getPool(poolAddress, refresh);
    if (!whirlpool) {
      return null;
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
  public async getClosePositionQuote(
    param: ClosePositionQuoteParam
  ): Promise<ClosePositionQuote | null> {
    const { positionAddress, refresh, slippageTolerance } = param;
    const position = await this.dal.getPosition(positionAddress, refresh);
    if (!position) {
      return null;
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, refresh);
    if (!whirlpool) {
      return null;
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
  public async getSwapQuote(param: SwapQuoteParam): Promise<SwapQuote | null> {
    const {
      poolAddress,
      tokenMint,
      tokenAmount,
      isOutput,
      slippageTolerance = defaultSlippagePercentage,
      refresh,
    } = param;

    const whirlpool = await this.dal.getPool(poolAddress, refresh);
    if (!whirlpool) {
      return null;
    }

    const fetchTickArray = async (tickIndex: number) => {
      const tickArray = await this.dal.getTickArray(
        TickUtil.getPdaWithTickIndex(
          tickIndex,
          whirlpool.tickSpacing,
          poolAddress,
          this.dal.programId
        ).publicKey,
        refresh || false
      );
      invariant(!!tickArray, "tickArray is null");
      return tickArray;
    };

    const fetchTick = async (tickIndex: number) => {
      const tickArray = await fetchTickArray(tickIndex);
      return TickUtil.getTick(tickArray, tickIndex, whirlpool.tickSpacing);
    };

    const swapDirection =
      tokenMint === whirlpool.tokenMintA && isOutput ? SwapDirection.BtoA : SwapDirection.AtoB;
    const swapSimulator = new SwapSimulator({
      swapDirection,
      amountSpecified: isOutput ? AmountSpecified.Output : AmountSpecified.Input,
      feeRate: PoolUtil.getFeeRate(whirlpool),
      slippageTolerance,
      fetchTick,
      getNextInitializedTickIndex: async (
        currentTickIndex: number,
        tickArraysCrossed: number,
        swapDirection: SwapDirection,
        tickSpacing: number
      ) => {
        let nextInitializedTickIndex: number | undefined = undefined;

        while (!nextInitializedTickIndex) {
          const currentTickArray = await fetchTickArray(currentTickIndex);

          let temp;
          if (swapDirection == SwapDirection.AtoB) {
            temp = TickUtil.getPrevInitializedTickIndex(
              currentTickArray,
              currentTickIndex,
              tickSpacing
            );
          } else {
            temp = TickUtil.getNextInitializedTickIndex(
              currentTickArray,
              currentTickIndex,
              tickSpacing
            );
          }

          if (temp) {
            nextInitializedTickIndex = temp;
          } else {
            let nextTick;
            if (swapDirection == SwapDirection.AtoB) {
              nextTick = currentTickArray.startTickIndex - 1;
            } else {
              nextTick = currentTickArray.startTickIndex + TICK_ARRAY_SIZE * tickSpacing - 1;
            }

            if (tickArraysCrossed == MAX_TICK_ARRAY_CROSSINGS) {
              nextInitializedTickIndex = nextTick;
            } else {
              currentTickIndex = nextTick;
              tickArraysCrossed++;
            }
          }
        }

        return {
          tickIndex: nextInitializedTickIndex,
          tickArraysCrossed,
        };
      },
    });

    const { sqrtPriceLimitX64, amountIn, amountOut } = await swapSimulator.simulateSwap({
      amount: tokenAmount,
      currentSqrtPriceX64: whirlpool.sqrtPrice,
      currentTickIndex: whirlpool.tickCurrentIndex,
      currentLiquidity: whirlpool.liquidity,
      tickSpacing: whirlpool.tickSpacing,
    });

    return {
      poolAddress,
      sqrtPriceLimitX64,
      amountIn,
      amountOut,
      aToB: swapDirection === SwapDirection.AtoB,
      fixedOutput: isOutput,
    };
  }
}
