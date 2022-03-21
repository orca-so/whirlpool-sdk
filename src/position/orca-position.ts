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
import { defaultSlippagePercentage } from "../constants/defaults";
import { OrcaDAL } from "../dal/orca-dal";
import { MultiTransactionBuilder } from "../utils/public/multi-transaction-builder";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { deriveATA, resolveOrCreateATA } from "../utils/web3/ata-utils";
import { getAddLiquidityQuote, InternalAddLiquidityQuoteParam } from "./quotes/add-liquidity";
import { getRemoveLiquidityQuote } from "./quotes/remove-liquidity";
import { Address, translateAddress } from "@project-serum/anchor";
import { toPubKey } from "../utils/address";
import {
  PDA,
  getPositionPda,
  TransactionBuilder,
  WhirlpoolContext,
  WhirlpoolClient,
} from "@orca-so/whirlpool-client-sdk";
import {
  buildCollectFeesAndRewardsTx,
  buildMultipleCollectFeesAndRewardsTx,
} from "./txs/fees-and-rewards";

export class OrcaPosition {
  constructor(private readonly dal: OrcaDAL) {}

  /*** Utilities ***/

  /**
   * Derive the position pda given position mint
   *
   * @param positionMint
   * @returns
   */
  public derivePDA(positionMint: Address): PDA {
    return getPositionPda(this.dal.programId, toPubKey(positionMint));
  }

  /*** Transactions ***/

  /**
   * Construct a transaction for adding liquidity to an existing pool
   */
  public async getAddLiquidityTx(param: AddLiquidityTxParam): Promise<TransactionBuilder> {
    const { provider, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.dal.getPosition(quote.positionAddress, false);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(quote.positionAddress).toBase58()}`);
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
    }

    const [tickArrayLower, tickArrayUpper] = TickUtil.getLowerAndUpperTickArrayAddresses(
      position.tickLowerIndex,
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.dal.programId
    );
    const positionTokenAccount = await deriveATA(provider.wallet.publicKey, position.positionMint);

    const txBuilder = new TransactionBuilder(ctx.provider);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintA,
      quote.maxTokenA
    );
    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
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
    txBuilder.addInstruction(addLiquidityIx);

    return txBuilder;
  }

  /**
   * Construct a transaction for removing liquidity from an existing pool
   */
  public async getRemoveLiquidityTx(param: RemoveLiquidityTxParam): Promise<TransactionBuilder> {
    const { provider, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.dal.getPosition(quote.positionAddress, false);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(quote.positionAddress).toBase58()}`);
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
    }

    const [tickArrayLower, tickArrayUpper] = TickUtil.getLowerAndUpperTickArrayAddresses(
      position.tickLowerIndex,
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.dal.programId
    );
    const positionTokenAccount = await deriveATA(provider.wallet.publicKey, position.positionMint);

    const txBuilder = new TransactionBuilder(ctx.provider);

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

    const removeLiquidityIx = client
      .decreaseLiquidityTx({
        liquidityAmount: quote.liquidity,
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
    txBuilder.addInstruction(removeLiquidityIx);

    return txBuilder;
  }

  /**
   * Construct a transaction for collecting fees and rewards from an existing pool
   */
  public async getCollectFeesAndRewardsTx(
    param: CollectFeesAndRewardsTxParam
  ): Promise<TransactionBuilder> {
    return buildCollectFeesAndRewardsTx(this.dal, {
      provider: param.provider,
      positionAddress: param.positionAddress,
    });
  }

  /**
   * Construct a transaction for collecting fees and rewards from a list of  existing pools
   */
  public async getCollectMultipleFeesAndRewardsTx(
    param: CollectMultipleFeesAndRewardsTxParam
  ): Promise<MultiTransactionBuilder> {
    return buildMultipleCollectFeesAndRewardsTx(this.dal, param);
  }

  /*** Quotes ***/

  /**
   * Construct a quote for adding liquidity to an existing pool
   */
  public async getAddLiquidityQuote(param: AddLiquidityQuoteParam): Promise<AddLiquidityQuote> {
    const { positionAddress, tokenMint, tokenAmount, refresh, slippageTolerance } = param;
    const position = await this.dal.getPosition(positionAddress, refresh);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(positionAddress).toBase58()}`);
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, refresh);
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
    param: RemoveLiquidityQuoteParam
  ): Promise<RemoveLiquidityQuote> {
    const { positionAddress, liquidity, refresh, slippageTolerance } = param;

    const position = await this.dal.getPosition(positionAddress, refresh);
    if (!position) {
      throw new Error(`Position not found: {$translateAddress(positionAddress).toBase58()}`);
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, refresh);
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
