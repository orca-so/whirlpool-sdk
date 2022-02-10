import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
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
import { PoolUtil } from "../utils/whirlpool/pool-util";
import { MultiTransactionBuilder } from "../utils/public/multi-transaction-builder";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { deriveATA, resolveOrCreateATA } from "../utils/web3/ata-utils";
import { getAddLiquidityQuote, InternalAddLiquidityQuoteParam } from "./quotes/add-liquidity";
import { getRemoveLiquidityQuote } from "./quotes/remove-liquidity";
import { Address } from "@project-serum/anchor";
import { toPubKey } from "../utils/address";
import {
  PDA,
  getPositionPda,
  TransactionBuilder,
  WhirlpoolContext,
  WhirlpoolClient,
  NUM_REWARDS,
  PositionData,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk";
import { getMultipleCollectFeesAndRewardsTx } from "./txs/fees-and-rewards";

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
  public async getAddLiquidityTx(param: AddLiquidityTxParam): Promise<TransactionBuilder | null> {
    const { provider, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.dal.getPosition(quote.positionAddress, false);
    if (!position) {
      return null;
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, false);
    if (!whirlpool) {
      return null;
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
  public async getRemoveLiquidityTx(
    param: RemoveLiquidityTxParam
  ): Promise<TransactionBuilder | null> {
    const { provider, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.dal.getPosition(quote.positionAddress, false);
    if (!position) {
      return null;
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, false);
    if (!whirlpool) {
      return null;
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
  ): Promise<MultiTransactionBuilder | null> {
    const { provider, positionAddress } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.dal.getPosition(positionAddress, false);
    if (!position) {
      return null;
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, false);
    if (!whirlpool) {
      return null;
    }

    const [tickArrayLower, tickArrayUpper] = TickUtil.getLowerAndUpperTickArrayAddresses(
      position.tickLowerIndex,
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.dal.programId
    );
    const positionTokenAccount = await deriveATA(provider.wallet.publicKey, position.positionMint);

    // step 0. create transaction builders, and check if the wallet has the position mint
    const ataTxBuilder = new TransactionBuilder(ctx.provider);
    const mainTxBuilder = new TransactionBuilder(ctx.provider);

    // step 1. update state of owed fees and rewards
    const updateIx = client
      .updateFeesAndRewards({
        whirlpool: position.whirlpool,
        position: toPubKey(positionAddress),
        tickArrayLower,
        tickArrayUpper,
      })
      .compressIx(false);
    mainTxBuilder.addInstruction(updateIx);

    // step 2. collect fees
    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintA
    );
    ataTxBuilder.addInstruction(tokenOwnerAccountAIx);

    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintB
    );
    ataTxBuilder.addInstruction(tokenOwnerAccountBIx);

    const feeIx = client
      .collectFeesTx({
        whirlpool: position.whirlpool,
        positionAuthority: provider.wallet.publicKey,
        position: toPubKey(positionAddress),
        positionTokenAccount,
        tokenOwnerAccountA,
        tokenOwnerAccountB,
        tokenVaultA: whirlpool.tokenVaultA,
        tokenVaultB: whirlpool.tokenVaultB,
        tickArrayLower,
        tickArrayUpper,
      })
      .compressIx(false);
    mainTxBuilder.addInstruction(feeIx);

    // step 3. collect rewards A, B, C
    for (const i of [...Array(NUM_REWARDS).keys()]) {
      const rewardInfo = whirlpool.rewardInfos[i];
      invariant(!!rewardInfo, "rewardInfo cannot be undefined");

      if (PoolUtil.isRewardInitialized(rewardInfo)) {
        const { address: rewardOwnerAccount, ...rewardOwnerAccountIx } = await resolveOrCreateATA(
          provider.connection,
          provider.wallet.publicKey,
          rewardInfo.mint
        );
        ataTxBuilder.addInstruction(rewardOwnerAccountIx);

        const rewardTx = client.collectRewardTx({
          whirlpool: position.whirlpool,
          positionAuthority: provider.wallet.publicKey,
          position: toPubKey(positionAddress),
          positionTokenAccount,
          rewardOwnerAccount,
          rewardVault: rewardInfo.vault,
          tickArrayLower,
          tickArrayUpper,
          rewardIndex: i,
        });
        mainTxBuilder.addInstruction(rewardTx.compressIx(false));
      }
    }

    if (ataTxBuilder.compressIx(false).instructions.length === 0) {
      return new MultiTransactionBuilder(provider, [mainTxBuilder]);
    }

    return new MultiTransactionBuilder(provider, [ataTxBuilder, mainTxBuilder]);
  }

  /**
   * Construct a transaction for collecting fees and rewards from a list of  existing pools
   */
  public async getCollectMultipleFeesAndRewardsTx(
    param: CollectMultipleFeesAndRewardsTxParam
  ): Promise<MultiTransactionBuilder | null> {
    return getMultipleCollectFeesAndRewardsTx(this.dal, param);
  }

  /*** Quotes ***/

  /**
   * Construct a quote for adding liquidity to an existing pool
   */
  public async getAddLiquidityQuote(
    param: AddLiquidityQuoteParam
  ): Promise<AddLiquidityQuote | null> {
    const { positionAddress, tokenMint, tokenAmount, refresh, slippageTolerance } = param;
    const position = await this.dal.getPosition(positionAddress, refresh);
    if (!position) {
      return null;
    }

    const whirlpool = await this.dal.getPool(position.whirlpool, refresh);
    if (!whirlpool) {
      return null;
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
  ): Promise<RemoveLiquidityQuote | null> {
    const { positionAddress, liquidity, refresh, slippageTolerance } = param;

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
      liquidity,
      slippageTolerance: slippageTolerance || defaultSlippagePercentage,
    });
  }
}
