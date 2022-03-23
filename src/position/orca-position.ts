import {
  AddLiquidityQuote,
  AddLiquidityQuoteParam,
  AddLiquidityTxParam,
  CollectFeesAndRewardsTxParam,
  CollectMultipleFeesAndRewardsTxParam,
  RemoveLiquidityQuote,
  RemoveLiquidityQuoteParam,
  RemoveLiquidityTxParam,
} from "./public/types";
import { defaultSlippagePercentage } from "../constants/public/defaults";
import { MultiTransactionBuilder } from "../utils/public/multi-transaction-builder";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { deriveATA, resolveOrCreateATA } from "../utils/web3/ata-utils";
import { getAddLiquidityQuote, InternalAddLiquidityQuoteParam } from "./quotes/add-liquidity";
import { getRemoveLiquidityQuote } from "./quotes/remove-liquidity";
import { Address, translateAddress } from "@project-serum/anchor";
import { toPubKey } from "../utils/address";
import {
  getPositionPda,
  PDA,
  TransactionBuilder,
  WhirlpoolClient,
} from "@orca-so/whirlpool-client-sdk";
import {
  buildCollectFeesAndRewardsTx,
  buildMultipleCollectFeesAndRewardsTx,
} from "./txs/fees-and-rewards";
import { WhirlpoolContext } from "../context";

export class OrcaPosition {
  /*** Utilities ***/

  /**
   * Derive the position pda given position mint
   *
   * @param positionMint
   * @returns
   */
  public derivePDA(ctx: WhirlpoolContext, positionMint: Address): PDA {
    return getPositionPda(ctx.program.programId, toPubKey(positionMint));
  }

  /*** Transactions ***/

  /**
   * Construct a transaction for adding liquidity to an existing pool
   */
  public async getAddLiquidityTx(
    ctx: WhirlpoolContext,
    param: AddLiquidityTxParam
  ): Promise<TransactionBuilder> {
    const { quote } = param;
    const client = new WhirlpoolClient(ctx);

    const position = await ctx.accountFetcher.getPosition(quote.positionAddress, false);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(quote.positionAddress).toBase58()}`);
    }

    const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
    }

    const [tickArrayLower, tickArrayUpper] = TickUtil.getLowerAndUpperTickArrayAddresses(
      position.tickLowerIndex,
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      ctx.program.programId
    );
    const positionTokenAccount = await deriveATA(
      ctx.provider.wallet.publicKey,
      position.positionMint
    );

    const txBuilder = new TransactionBuilder(ctx.provider);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA,
      quote.maxTokenA
    );
    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB,
      quote.maxTokenB
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const addLiquidityIx = client
      .increaseLiquidityTx({
        liquidityAmount: quote.liquidity,
        tokenMaxA: quote.maxTokenA,
        tokenMaxB: quote.maxTokenB,
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
    txBuilder.addInstruction(addLiquidityIx);

    return txBuilder;
  }

  /**
   * Construct a transaction for removing liquidity from an existing pool
   */
  public async getRemoveLiquidityTx(
    ctx: WhirlpoolContext,
    param: RemoveLiquidityTxParam
  ): Promise<TransactionBuilder> {
    const { quote } = param;
    const client = new WhirlpoolClient(ctx);

    const position = await ctx.accountFetcher.getPosition(quote.positionAddress, false);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(quote.positionAddress).toBase58()}`);
    }

    const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
    }

    const [tickArrayLower, tickArrayUpper] = TickUtil.getLowerAndUpperTickArrayAddresses(
      position.tickLowerIndex,
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      ctx.program.programId
    );
    const positionTokenAccount = await deriveATA(
      ctx.provider.wallet.publicKey,
      position.positionMint
    );

    const txBuilder = new TransactionBuilder(ctx.provider);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA
    );
    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const removeLiquidityIx = client
      .decreaseLiquidityTx({
        liquidityAmount: quote.liquidity,
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
    txBuilder.addInstruction(removeLiquidityIx);

    return txBuilder;
  }

  /**
   * Construct a transaction for collecting fees and rewards from an existing pool
   */
  public async getCollectFeesAndRewardsTx(
    ctx: WhirlpoolContext,
    param: CollectFeesAndRewardsTxParam
  ): Promise<TransactionBuilder> {
    return buildCollectFeesAndRewardsTx(ctx, {
      positionAddress: param.positionAddress,
    });
  }

  /**
   * Construct a transaction for collecting fees and rewards from a list of  existing pools
   */
  public async getCollectMultipleFeesAndRewardsTx(
    ctx: WhirlpoolContext,
    param: CollectMultipleFeesAndRewardsTxParam
  ): Promise<MultiTransactionBuilder> {
    return buildMultipleCollectFeesAndRewardsTx(ctx, param);
  }

  /*** Quotes ***/

  /**
   * Construct a quote for adding liquidity to an existing pool
   */
  public async getAddLiquidityQuote(
    ctx: WhirlpoolContext,
    param: AddLiquidityQuoteParam
  ): Promise<AddLiquidityQuote> {
    const { positionAddress, tokenMint, tokenAmount, refresh, slippageTolerance } = param;
    const position = await ctx.accountFetcher.getPosition(positionAddress, refresh);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(positionAddress).toBase58()}`);
    }

    const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, refresh);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
    }

    const internalParam: InternalAddLiquidityQuoteParam = {
      tokenMintA: whirlpool.tokenMintA,
      tokenMintB: whirlpool.tokenMintB,
      tickCurrentIndex: whirlpool.tickCurrentIndex,
      sqrtPrice: whirlpool.sqrtPrice,
      inputTokenMint: toPubKey(tokenMint),
      inputTokenAmount: tokenAmount,
      tickLowerIndex: position.tickLowerIndex,
      tickUpperIndex: position.tickUpperIndex,
      slippageTolerance: slippageTolerance || defaultSlippagePercentage,
    };

    return {
      positionAddress,
      ...getAddLiquidityQuote(internalParam),
    };
  }

  /**
   * Construct a quote for removing liquidity from an existing pool
   */
  public async getRemoveLiquidityQuote(
    ctx: WhirlpoolContext,
    param: RemoveLiquidityQuoteParam
  ): Promise<RemoveLiquidityQuote> {
    const { positionAddress, liquidity, refresh, slippageTolerance } = param;

    const position = await ctx.accountFetcher.getPosition(positionAddress, refresh);
    if (!position) {
      throw new Error(`Position not found: {$translateAddress(positionAddress).toBase58()}`);
    }

    const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, refresh);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: {$translateAddress(poolAddress).toBase58()}`);
    }

    return getRemoveLiquidityQuote({
      positionAddress: toPubKey(positionAddress),
      tickCurrentIndex: whirlpool.tickCurrentIndex,
      sqrtPrice: whirlpool.sqrtPrice,
      tickLowerIndex: position.tickLowerIndex,
      tickUpperIndex: position.tickUpperIndex,
      liquidity,
      slippageTolerance: slippageTolerance || defaultSlippagePercentage,
    });
  }
}
