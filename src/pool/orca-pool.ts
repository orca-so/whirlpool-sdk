import { Address, BN, translateAddress } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  ClosePositionQuote,
  ClosePositionQuoteParam,
  ClosePositionTxParam,
  FillTickArraysParam,
  isQuoteByPrice,
  isQuoteByTickIndex,
  OpenPositionQuote,
  OpenPositionQuoteParam,
  OpenPositionTxParam,
  SwapQuote,
  SwapQuoteParam,
  SwapTxParam,
} from "./public/types";
import { defaultSlippagePercentage } from "../constants/public/defaults";
import {
  getAddLiquidityQuote,
  InternalAddLiquidityQuoteParam,
} from "../position/quotes/add-liquidity";
import { getRemoveLiquidityQuote } from "../position/quotes/remove-liquidity";
import { toPubKey } from "../utils/address";
import { MultiTransactionBuilder } from "../utils/public/multi-transaction-builder";
import { deriveATA, resolveOrCreateATA } from "../utils/web3/ata-utils";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { getLiquidityDistribution, LiquidityDistribution } from "./ux/liquidity-distribution";
import { AmountSpecified, SwapDirection, SwapSimulator } from "./quotes/swap-quoter";
import {
  getTickArrayPda,
  getPositionPda,
  TransactionBuilder,
  sqrtPriceX64ToTickIndex,
  toX64,
  WhirlpoolClient,
  InitTickArrayParams,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
  MIN_TICK_INDEX,
  MAX_TICK_INDEX,
  getOraclePda,
  getPositionMetadataPda,
  PDA,
  TickSpacing,
  getWhirlpoolPda,
} from "@orca-so/whirlpool-client-sdk";
import { buildCollectFeesAndRewardsTx } from "../position/txs/fees-and-rewards";
import { adjustAmountForSlippage } from "../utils/public/position-util";
import { ZERO } from "../utils/web3/math-utils";
import { WhirlpoolContext } from "../context";
import { PoolUtil } from "../utils/whirlpool/pool-util";

export class OrcaPool {
  /*** Utilities ***/

  /**
   * Create liquidity distribution across three tick-arrays for a pool.
   * Useful for visualizing the liquidity in the pool.
   *
   * @param poolAddress
   * @param tickLower
   * @param tickUpper
   * @param refresh
   * @returns liquidity distribution
   */
  public async getLiquidityDistribution(
    ctx: WhirlpoolContext,
    poolAddress: Address,
    tickLower: number,
    tickUpper: number,
    refresh = true
  ): Promise<LiquidityDistribution> {
    return getLiquidityDistribution(ctx, poolAddress, tickLower, tickUpper, refresh);
  }

  /**
   * Derive the pool pda given token mints and tick spacing
   * // TODO: Remove stable
   *
   * @param tokenMintA
   * @param tokenMintB
   * @param stable
   * @returns
   */
  public derivePDA(
    ctx: WhirlpoolContext,
    tokenMintA: Address,
    tokenMintB: Address,
    stable: boolean
  ): PDA {
    const [_tokenMintA, _tokenMintB] = PoolUtil.orderMints(tokenMintA, tokenMintB);
    return getWhirlpoolPda(
      ctx.program.programId,
      ctx.configAddress,
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
    ctx: WhirlpoolContext,
    param: OpenPositionTxParam
  ): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey }> {
    return this.getOpenPositionWithOptMetadataTx(ctx, param);
  }

  /**
   * Construct a transaction for opening an new position
   */
  public async getOpenPositionWithMetadataTx(
    ctx: WhirlpoolContext,
    param: OpenPositionTxParam
  ): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey }> {
    return this.getOpenPositionWithOptMetadataTx(ctx, param, true);
  }

  /**
   * Construct a transaction for opening an new position with optional metadata
   */
  async getOpenPositionWithOptMetadataTx(
    ctx: WhirlpoolContext,
    param: OpenPositionTxParam,
    withMetadata: boolean = false
  ): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey }> {
    const {
      quote: { maxTokenA, maxTokenB, liquidity, tickLowerIndex, tickUpperIndex, poolAddress },
    } = param;
    invariant(liquidity.gt(new u64(0)), "liquidity must be greater than zero");

    const client = new WhirlpoolClient(ctx);

    const whirlpool = await ctx.accountFetcher.getPool(poolAddress, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
    }

    const positionMintKeypair = Keypair.generate();
    const positionPda = getPositionPda(ctx.program.programId, positionMintKeypair.publicKey);
    const metadataPda = getPositionMetadataPda(positionMintKeypair.publicKey);
    const positionTokenAccountAddress = await deriveATA(
      ctx.provider.wallet.publicKey,
      positionMintKeypair.publicKey
    );

    const txBuilder = new TransactionBuilder(ctx.provider);
    const preTxBuilder = new TransactionBuilder(ctx.provider);

    const positionIx = (withMetadata ? client.openPositionWithMetadataTx : client.openPositionTx)
      .bind(client)({
        funder: ctx.provider.wallet.publicKey,
        ownerKey: ctx.provider.wallet.publicKey,
        positionPda,
        metadataPda,
        positionMintAddress: positionMintKeypair.publicKey,
        positionTokenAccountAddress,
        whirlpoolKey: toPubKey(poolAddress),
        tickLowerIndex,
        tickUpperIndex,
      })
      .compressIx(false);
    txBuilder.addInstruction(positionIx).addSigner(positionMintKeypair);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA,
      maxTokenA
    );
    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB,
      maxTokenB
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const tickArrayLowerPda = TickUtil.getPdaWithTickIndex(
      tickLowerIndex,
      whirlpool.tickSpacing,
      poolAddress,
      ctx.program.programId
    );
    const tickArrayUpperPda = TickUtil.getPdaWithTickIndex(
      tickUpperIndex,
      whirlpool.tickSpacing,
      poolAddress,
      ctx.program.programId
    );

    const [tickArrayLower, tickArrayUpper] = await ctx.accountFetcher.listTickArrays(
      [tickArrayLowerPda.publicKey, tickArrayUpperPda.publicKey],
      true
    );

    let requirePreTx = false;
    if (tickArrayLower === null) {
      const tickArrayIx = client
        .initTickArrayTx({
          whirlpool: toPubKey(poolAddress),
          tickArrayPda: tickArrayLowerPda,
          startTick: TickUtil.getStartTickIndex(tickLowerIndex, whirlpool.tickSpacing),
          funder: ctx.provider.wallet.publicKey,
        })
        .compressIx(false);
      preTxBuilder.addInstruction(tickArrayIx);
      requirePreTx = true;
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
          funder: ctx.provider.wallet.publicKey,
        })
        .compressIx(false);
      preTxBuilder.addInstruction(tickArrayIx);
      requirePreTx = true;
    }

    const liquidityIx = client
      .increaseLiquidityTx({
        liquidityAmount: liquidity,
        tokenMaxA: maxTokenA,
        tokenMaxB: maxTokenB,
        whirlpool: toPubKey(poolAddress),
        positionAuthority: ctx.provider.wallet.publicKey,
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

    const tx = new MultiTransactionBuilder(ctx.provider, []);
    if (requirePreTx) {
      tx.addTxBuilder(preTxBuilder);
    }
    tx.addTxBuilder(txBuilder);

    return {
      mint: positionMintKeypair.publicKey,
      tx,
    };
  }

  public async getInitTickArrayTx(
    ctx: WhirlpoolContext,
    param: InitTickArrayParams
  ): Promise<TransactionBuilder> {
    const client = new WhirlpoolClient(ctx);
    return client.initTickArrayTx(param);
  }

  /**
   * Construct a transaction for closing an existing position
   */
  public async getClosePositionTx(
    ctx: WhirlpoolContext,
    param: ClosePositionTxParam
  ): Promise<TransactionBuilder> {
    const { quote } = param;

    const client = new WhirlpoolClient(ctx);

    const position = await ctx.accountFetcher.getPosition(quote.positionAddress, true);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(quote.positionAddress).toBase58()}`);
    }

    const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
    }

    const tickArrayLower = TickUtil.getPdaWithTickIndex(
      position.tickLowerIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      ctx.program.programId
    ).publicKey;
    const tickArrayUpper = TickUtil.getPdaWithTickIndex(
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      ctx.program.programId
    ).publicKey;

    const positionTokenAccount = await deriveATA(
      ctx.provider.wallet.publicKey,
      position.positionMint
    );

    const txBuilder = new TransactionBuilder(ctx.provider);

    const resolvedAssociatedTokenAddresses: Record<string, PublicKey> = {};
    const { address: tokenOwnerAccountA, ...createTokenOwnerAccountAIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA
    );
    const { address: tokenOwnerAccountB, ...createTokenOwnerAccountBIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB
    );
    txBuilder.addInstruction(createTokenOwnerAccountAIx).addInstruction(createTokenOwnerAccountBIx);
    resolvedAssociatedTokenAddresses[whirlpool.tokenMintA.toBase58()] = tokenOwnerAccountA;
    resolvedAssociatedTokenAddresses[whirlpool.tokenMintB.toBase58()] = tokenOwnerAccountB;

    const collectTx = await buildCollectFeesAndRewardsTx(ctx, {
      positionAddress: quote.positionAddress,
      resolvedAssociatedTokenAddresses,
    });
    txBuilder.addInstruction(collectTx.compressIx(false));

    /* Remove all liquidity remaining in the position */

    if (position.liquidity.gt(new u64(0))) {
      const liquidityIx = client
        .decreaseLiquidityTx({
          liquidityAmount: position.liquidity,
          tokenMinA: quote.minTokenA,
          tokenMinB: quote.minTokenB,
          whirlpool: position.whirlpool,
          positionAuthority: ctx.provider.wallet.publicKey,
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
        positionAuthority: ctx.provider.wallet.publicKey,
        receiver: ctx.provider.wallet.publicKey,
        positionTokenAccount,
        position: toPubKey(quote.positionAddress),
        positionMint: position.positionMint,
      })
      .compressIx(false);
    txBuilder.addInstruction(positionIx);

    return txBuilder;
  }

  async getLowestInitializedTickArrayTickIndex(
    ctx: WhirlpoolContext,
    poolAddress: Address,
    tickSpacing: number
  ): Promise<number> {
    let offset = 1;
    while (true) {
      const tickArrayPda = TickUtil.getPdaWithTickIndex(
        MIN_TICK_INDEX,
        tickSpacing,
        poolAddress,
        ctx.program.programId,
        offset
      );

      // Throttle to prevent being rate-limited
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const tickArray = await ctx.accountFetcher.getTickArray(tickArrayPda.publicKey, false);
      if (!tickArray) {
        offset++;
        continue;
      }

      return TickUtil.getStartTickIndex(MIN_TICK_INDEX, tickSpacing, offset);
    }
  }

  async getHighestInitializedTickArrayTickIndex(
    ctx: WhirlpoolContext,
    poolAddress: Address,
    tickSpacing: number
  ): Promise<number> {
    let offset = -1;
    while (true) {
      const tickArrayPda = TickUtil.getPdaWithTickIndex(
        MAX_TICK_INDEX,
        tickSpacing,
        poolAddress,
        ctx.program.programId,
        offset
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const tickArray = await ctx.accountFetcher.getTickArray(tickArrayPda.publicKey, false);
      if (!tickArray) {
        offset--;
        continue;
      }

      return TickUtil.getStartTickIndex(MAX_TICK_INDEX, tickSpacing, offset);
    }
  }

  // Finds all uninitialized tick arrays inbetween the lowest and highest
  // initialized tick arrays for a given pool
  public async getInitializeGapTickArraysTx(
    ctx: WhirlpoolContext,
    param: FillTickArraysParam
  ): Promise<MultiTransactionBuilder> {
    const { poolAddress } = param;
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await ctx.accountFetcher.getPool(poolAddress, true);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
    }

    const firstTickIndex = await this.getLowestInitializedTickArrayTickIndex(
      ctx,
      poolAddress,
      whirlpool.tickSpacing
    );
    const lastTickIndex = await this.getHighestInitializedTickArrayTickIndex(
      ctx,
      poolAddress,
      whirlpool.tickSpacing
    );

    // get all lowest and highest tick array
    let numIxs = 0;
    let txBuilder = new TransactionBuilder(ctx.provider);
    const multiTxBuilder = new MultiTransactionBuilder(ctx.provider, []);
    let offset = 1;
    while (true) {
      const tickArrayPda = TickUtil.getPdaWithTickIndex(
        firstTickIndex,
        whirlpool.tickSpacing,
        poolAddress,
        ctx.program.programId,
        offset
      );

      const startTick = TickUtil.getStartTickIndex(firstTickIndex, whirlpool.tickSpacing, offset);
      if (startTick === lastTickIndex) {
        break;
      }

      // Throttle to prevent being rate-limited
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const tickArray = await ctx.accountFetcher.getTickArray(tickArrayPda.publicKey, false);
      if (!tickArray) {
        txBuilder.addInstruction(
          client
            .initTickArrayTx({
              whirlpool: toPubKey(poolAddress),
              tickArrayPda,
              startTick,
              funder: ctx.provider.wallet.publicKey,
            })
            .compressIx(false)
        );

        numIxs++;

        if (!(numIxs % 7)) {
          multiTxBuilder.addTxBuilder(txBuilder);
          txBuilder = new TransactionBuilder(ctx.provider);
        }
      }

      offset++;
    }

    if (numIxs % 7) {
      multiTxBuilder.addTxBuilder(txBuilder);
    }

    return multiTxBuilder;
  }

  /**
   * Construct a transaction for a swap
   */
  public async getSwapTx(
    ctx: WhirlpoolContext,
    param: SwapTxParam
  ): Promise<MultiTransactionBuilder> {
    const {
      quote: {
        sqrtPriceLimitX64,
        otherAmountThreshold,
        amountIn,
        amountOut,
        aToB,
        fixedInput,
        poolAddress,
      },
    } = param;
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await ctx.accountFetcher.getPool(poolAddress, true);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
    }

    const txBuilder = new TransactionBuilder(ctx.provider);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA,
      aToB ? amountIn : ZERO
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);

    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB,
      !aToB ? amountIn : ZERO
    );
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const targetSqrtPriceLimitX64 = sqrtPriceLimitX64 || this.getDefaultSqrtPriceLimit(aToB);

    const tickArrayAddresses = await this.getTickArrayPublicKeysForSwap(
      ctx,
      whirlpool.sqrtPrice,
      targetSqrtPriceLimitX64,
      whirlpool.tickSpacing,
      toPubKey(poolAddress),
      ctx.program.programId
    );

    const oraclePda = getOraclePda(ctx.program.programId, translateAddress(poolAddress));

    txBuilder.addInstruction(
      client
        .swapTx({
          amount: fixedInput ? amountIn : amountOut,
          otherAmountThreshold,
          sqrtPriceLimit: targetSqrtPriceLimitX64,
          amountSpecifiedIsInput: fixedInput,
          aToB,
          whirlpool: toPubKey(poolAddress),
          tokenAuthority: ctx.provider.wallet.publicKey,
          tokenOwnerAccountA,
          tokenVaultA: whirlpool.tokenVaultA,
          tokenOwnerAccountB,
          tokenVaultB: whirlpool.tokenVaultB,
          tickArray0: tickArrayAddresses[0],
          tickArray1: tickArrayAddresses[1],
          tickArray2: tickArrayAddresses[2],
          oracle: oraclePda.publicKey,
        })
        .compressIx(false)
    );

    return new MultiTransactionBuilder(ctx.provider, [txBuilder]);
  }

  private getDefaultSqrtPriceLimit(aToB: boolean): BN {
    return new BN(aToB ? MIN_SQRT_PRICE : MAX_SQRT_PRICE);
  }

  private async getTickArrayPublicKeysForSwap(
    ctx: WhirlpoolContext,
    currentSqrtPriceX64: BN,
    targetSqrtPriceX64: BN,
    tickSpacing: number,
    poolAddress: PublicKey,
    programId: PublicKey
  ): Promise<[PublicKey, PublicKey, PublicKey]> {
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

    while (currentStartTickIndex != targetStartTickIndex && count < 3) {
      const nextStartTickIndex = TickUtil.getStartTickIndex(
        currentTickIndex,
        tickSpacing,
        offset * count
      );
      const nextTickArrayAddress = getTickArrayPda(
        programId,
        poolAddress,
        nextStartTickIndex
      ).publicKey;

      const nextTickArray = await ctx.accountFetcher.getTickArray(nextTickArrayAddress, false);
      if (!nextTickArray) {
        break;
      }

      tickArrayAddresses[count] = nextTickArrayAddress;
      count++;
      currentStartTickIndex = nextStartTickIndex;
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
  public async getClosePositionQuote(
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
  public async getSwapQuote(ctx: WhirlpoolContext, param: SwapQuoteParam): Promise<SwapQuote> {
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
}
