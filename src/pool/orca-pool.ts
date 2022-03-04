import { Address, BN, Provider, translateAddress } from "@project-serum/anchor";
import { NATIVE_MINT, u64 } from "@solana/spl-token";
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
import { AmountSpecified, SwapDirection, SwapSimulator } from "./quotes/swap-quoter";
import {
  TickSpacing,
  PDA,
  getWhirlpoolPda,
  getTickArrayPda,
  getPositionPda,
  TransactionBuilder,
  sqrtPriceX64ToTickIndex,
  toX64,
  WhirlpoolClient,
  WhirlpoolContext,
  InitTickArrayParams,
} from "@orca-so/whirlpool-client-sdk";
import { getMultipleCollectFeesAndRewardsTx } from "../position/txs/fees-and-rewards";
import { adjustPriceForSlippage } from "../utils/whirlpool/position-util";
import { ZERO } from "../utils/web3/math-utils";

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
  ): Promise<LiquidityDistribution> {
    return getLiquidityDistribution(this.dal, poolAddress, width, refresh);
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
  ): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey }> {
    const {
      provider,
      quote: { maxTokenA, maxTokenB, liquidity, tickLowerIndex, tickUpperIndex, poolAddress },
    } = param;
    invariant(liquidity.gt(new u64(0)), "liquidity must be greater than zero");

    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.dal.getPool(poolAddress, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
    }

    const positionMintKeypair = Keypair.generate();
    const positionPda = getPositionPda(this.dal.programId, positionMintKeypair.publicKey);
    const positionTokenAccountAddress = await deriveATA(
      provider.wallet.publicKey,
      positionMintKeypair.publicKey
    );

    const txBuilder = new TransactionBuilder(provider);
    const preTxBuilder = new TransactionBuilder(provider);

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
      whirlpool.tokenMintA,
      maxTokenA
    );
    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintB,
      maxTokenB
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

    let requirePreTx = false;
    if (tickArrayLower === null) {
      const tickArrayIx = client
        .initTickArrayTx({
          whirlpool: toPubKey(poolAddress),
          tickArrayPda: tickArrayLowerPda,
          startTick: TickUtil.getStartTickIndex(tickLowerIndex, whirlpool.tickSpacing),
          funder: provider.wallet.publicKey,
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
          funder: provider.wallet.publicKey,
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

    const tx = new MultiTransactionBuilder(provider, []);
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
  public async getClosePositionTx(param: ClosePositionTxParam): Promise<TransactionBuilder> {
    const { provider, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.dal.getPosition(quote.positionAddress, true);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(quote.positionAddress).toBase58()}`);
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
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
  public async getSwapTx(param: SwapTxParam): Promise<MultiTransactionBuilder> {
    const {
      provider,
      quote: { sqrtPriceLimitX64, amountIn, amountOut, aToB, fixedInput, poolAddress },
    } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.dal.getPool(poolAddress, true);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
    }

    const txBuilder = new TransactionBuilder(ctx.provider);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintA,
      aToB ? amountIn : ZERO
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);

    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintB,
      !aToB ? amountIn : ZERO
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
          amount: fixedInput ? amountIn : amountOut,
          sqrtPriceLimit: sqrtPriceLimitX64,
          amountSpecifiedIsInput: fixedInput,
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
  public async getOpenPositionQuote(param: OpenPositionQuoteParam): Promise<OpenPositionQuote> {
    const { poolAddress, tokenMint, tokenAmount, slippageTolerance, refresh } = param;
    const whirlpool = await this.dal.getPool(poolAddress, refresh);
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
  public async getClosePositionQuote(param: ClosePositionQuoteParam): Promise<ClosePositionQuote> {
    const { positionAddress, refresh, slippageTolerance } = param;
    const position = await this.dal.getPosition(positionAddress, refresh);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(positionAddress).toBase58()}`);
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, refresh);
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
  public async getSwapQuote(param: SwapQuoteParam): Promise<SwapQuote> {
    const {
      poolAddress,
      tokenMint,
      tokenAmount,
      isInput,
      slippageTolerance = defaultSlippagePercentage,
      refresh,
    } = param;

    const whirlpool = await this.dal.getPool(poolAddress, refresh);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
    }

    const swapDirection =
      toPubKey(tokenMint).equals(whirlpool.tokenMintA) === isInput
        ? SwapDirection.AtoB
        : SwapDirection.BtoA;
    const amountSpecified = isInput ? AmountSpecified.Input : AmountSpecified.Output;

    const swapSimulator = new SwapSimulator();

    const { amountIn, amountOut, sqrtPriceAfterSwapX64 } = await swapSimulator.simulateSwap(
      {
        refresh,
        dal: this.dal,
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

    const sqrtPriceLimitX64 = adjustPriceForSlippage(
      sqrtPriceAfterSwapX64,
      slippageTolerance,
      swapDirection === SwapDirection.BtoA
    );

    return {
      poolAddress,
      sqrtPriceLimitX64,
      amountIn,
      amountOut,
      aToB: swapDirection === SwapDirection.AtoB,
      fixedInput: isInput,
    };
  }
}
