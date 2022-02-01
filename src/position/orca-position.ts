import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  AddLiquidityQuote,
  AddLiquidityQuoteParam,
  AddLiquidityTxParam,
  CollectFeesAndRewardsTxParam,
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

    const position = await this.getPosition(quote.positionAddress, false);
    const whirlpool = await this.getWhirlpool(position, false);
    const [tickArrayLower, tickArrayUpper] = this.getTickArrayAddresses(position, whirlpool);
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
  public async getRemoveLiquidityTx(param: RemoveLiquidityTxParam): Promise<TransactionBuilder> {
    const { provider, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.getPosition(quote.positionAddress, false);
    const whirlpool = await this.getWhirlpool(position, false);
    const [tickArrayLower, tickArrayUpper] = this.getTickArrayAddresses(position, whirlpool);
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
        tokenMaxA: quote.minTokenA,
        tokenMaxB: quote.minTokenB,
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
  ): Promise<MultiTransactionBuilder> {
    const { provider, positionAddress } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.getPosition(positionAddress, false);
    const whirlpool = await this.getWhirlpool(position, false);
    const [tickArrayLower, tickArrayUpper] = this.getTickArrayAddresses(position, whirlpool);
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

    return new MultiTransactionBuilder(provider, [ataTxBuilder, mainTxBuilder]);
  }

  /*** Quotes ***/

  /**
   * Construct a quote for adding liquidity to an existing pool
   */
  public async getAddLiquidityQuote(param: AddLiquidityQuoteParam): Promise<AddLiquidityQuote> {
    const { positionAddress, tokenMint, tokenAmount, refresh, slippageTolerence } = param;
    const shouldRefresh = refresh === undefined ? true : refresh; // default true

    const position = await this.getPosition(positionAddress, shouldRefresh);
    const whirlpool = await this.getWhirlpool(position, shouldRefresh);

    const internalParam: InternalAddLiquidityQuoteParam = {
      tokenMintA: whirlpool.tokenMintA,
      tokenMintB: whirlpool.tokenMintB,
      tickCurrentIndex: whirlpool.tickCurrentIndex,
      sqrtPrice: whirlpool.sqrtPrice,
      inputTokenMint: toPubKey(tokenMint),
      inputTokenAmount: tokenAmount,
      tickLowerIndex: position.tickLowerIndex,
      tickUpperIndex: position.tickUpperIndex,
      slippageTolerence: slippageTolerence || defaultSlippagePercentage,
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
    const { positionAddress, liquidity, refresh, slippageTolerence } = param;
    const shouldRefresh = refresh === undefined ? true : refresh; // default true

    const position = await this.getPosition(positionAddress, shouldRefresh);
    const whirlpool = await this.getWhirlpool(position, shouldRefresh);

    return getRemoveLiquidityQuote({
      positionAddress: toPubKey(positionAddress),
      tickCurrentIndex: whirlpool.tickCurrentIndex,
      sqrtPrice: whirlpool.sqrtPrice,
      tickLowerIndex: position.tickLowerIndex,
      tickUpperIndex: position.tickUpperIndex,
      liquidity,
      slippageTolerence: slippageTolerence || defaultSlippagePercentage,
    });
  }

  /*** Helpers ***/

  private async getPosition(address: Address, refresh: boolean): Promise<PositionData> {
    const position = await this.dal.getPosition(address, refresh);
    invariant(!!position, "OrcaPosition - position does not exist");
    return position;
  }

  private async getWhirlpool(position: PositionData, refresh: boolean): Promise<WhirlpoolData> {
    const whirlpool = await this.dal.getPool(position.whirlpool, refresh);
    invariant(!!whirlpool, "OrcaPosition - whirlpool does not exist");
    return whirlpool;
  }

  private getTickArrayAddresses(
    position: PositionData,
    whirlpool: WhirlpoolData
  ): [PublicKey, PublicKey] {
    const tickLowerAddress = TickUtil.getPdaWithTickIndex(
      position.tickLowerIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.dal.programId
    ).publicKey;
    const tickUpperAddress = TickUtil.getPdaWithTickIndex(
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.dal.programId
    ).publicKey;
    return [tickLowerAddress, tickUpperAddress];
  }
}
