import { NUM_REWARDS } from "@orca-so/whirlpool-client-sdk";
import WhirlpoolClient from "@orca-so/whirlpool-client-sdk/dist/client";
import WhirlpoolContext from "@orca-so/whirlpool-client-sdk/dist/context";
import {
  PositionData,
  TickData,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { MintInfo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  AddLiquidityQuote,
  AddLiquidityQuoteParam,
  AddLiquidityTransactionParam,
  CollectFeesAndRewardsTransactionParam,
  CollectFeesQuote,
  CollectFeesQuoteParam,
  CollectRewardsQuote,
  CollectRewardsQuoteParam,
  RemoveLiquidityQuote,
  RemoveLiquidityQuoteParam,
  RemoveLiquidityTransactionParam,
} from "..";
import { defaultSlippagePercentage } from "../constants/defaults";
import { OrcaDAL } from "../dal/orca-dal";
import { PoolUtil } from "../utils/whirlpool/pool-util";
import { TransactionExecutable } from "../utils/public/transaction-executable";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { resolveOrCreateATA } from "../utils/web3/ata-utils";
import {
  getAddLiquidityQuoteWhenPositionIsAboveRange,
  getAddLiquidityQuoteWhenPositionIsBelowRange,
  getAddLiquidityQuoteWhenPositionIsInRange,
  InternalAddLiquidityQuoteParam,
} from "./quotes/add-liquidity";
import { getCollectFeesQuoteInternal } from "./quotes/collect-fees";
import { getCollectRewardsQuoteInternal } from "./quotes/collect-rewards";
import {
  getRemoveLiquidityQuoteWhenPositionIsAboveRange,
  getRemoveLiquidityQuoteWhenPositionIsBelowRange,
  getRemoveLiquidityQuoteWhenPositionIsInRange,
  InternalRemoveLiquidityQuoteParam,
} from "./quotes/remove-liquidity";
import { PositionStatus, PositionUtil } from "../utils/whirlpool/position-util";

export class OrcaPosition {
  constructor(private readonly dal: OrcaDAL) {}

  /*** Transactions ***/

  public async getAddLiquidityTransaction(
    param: AddLiquidityTransactionParam
  ): Promise<TransactionExecutable> {
    const { provider, address, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.getPosition(address, true);
    const whirlpool = await this.getWhirlpool(position, true);
    const [tickArrayLower, tickArrayUpper] = this.getTickArrayAddress(position, whirlpool);

    // step 0. create transaction builders, and check if the wallet has the position mint
    const txBuilder = new TransactionBuilder(ctx.provider);

    const positionTokenAccount = await this.dal.getUserNFTAccount(
      provider.wallet.publicKey,
      position.positionMint
    );
    invariant(!!positionTokenAccount, "no position token account");

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

    const addLiquidityIx = client
      .increaseLiquidityTx({
        liquidityAmount: quote.liquidity,
        tokenMaxA: quote.maxTokenA,
        tokenMaxB: quote.maxTokenB,
        whirlpool: position.whirlpool,
        positionAuthority: provider.wallet.publicKey,
        position: address,
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

    return new TransactionExecutable(provider, [txBuilder]);
  }

  public async getRemoveLiquidityTransaction(
    param: RemoveLiquidityTransactionParam
  ): Promise<TransactionExecutable> {
    const { provider, address, quote } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.getPosition(address, true);
    const whirlpool = await this.getWhirlpool(position, true);
    const [tickArrayLower, tickArrayUpper] = this.getTickArrayAddress(position, whirlpool);

    // step 0. create transaction builders, and check if the wallet has the position mint
    const txBuilder = new TransactionBuilder(ctx.provider);

    const positionTokenAccount = await this.dal.getUserNFTAccount(
      provider.wallet.publicKey,
      position.positionMint
    );
    invariant(!!positionTokenAccount, "no position token account");

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

    const removeLiquidityIx = client
      .decreaseLiquidityTx({
        liquidityAmount: quote.liquidity,
        tokenMaxA: quote.minTokenA,
        tokenMaxB: quote.minTokenB,
        whirlpool: position.whirlpool,
        positionAuthority: provider.wallet.publicKey,
        position: address,
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

    return new TransactionExecutable(provider, [txBuilder]);
  }

  public async getCollectFeesAndRewardsTransaction(
    param: CollectFeesAndRewardsTransactionParam
  ): Promise<TransactionExecutable> {
    const { provider, address } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.getPosition(address, true);
    const whirlpool = await this.getWhirlpool(position, true);
    const [tickArrayLower, tickArrayUpper] = this.getTickArrayAddress(position, whirlpool);

    // step 0. create transaction builders, and check if the wallet has the position mint
    const ataTxBuilder = new TransactionBuilder(ctx.provider);
    const mainTxBuilder = new TransactionBuilder(ctx.provider);

    const positionTokenAccount = await this.dal.getUserNFTAccount(
      provider.wallet.publicKey,
      position.positionMint
    );
    invariant(!!positionTokenAccount, "no position token account");

    // step 1. update state of owed fees and rewards
    const updateIx = client
      .updateFeesAndRewards({
        whirlpool: position.whirlpool,
        position: address,
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
        position: address,
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
          position: address,
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

    return new TransactionExecutable(provider, [ataTxBuilder, mainTxBuilder]);
  }

  /*** Quotes ***/

  public async getAddLiquidityQuote(param: AddLiquidityQuoteParam): Promise<AddLiquidityQuote> {
    const { address, tokenMint, tokenAmount, refresh, slippageTolerence } = param;

    const position = await this.getPosition(address, refresh);
    const whirlpool = await this.getWhirlpool(position, refresh);
    const [tokenAMintInfo, tokenBMintInfo] = await this.getTokenMintInfos(whirlpool);
    const { tickLowerIndex, tickUpperIndex } = position;

    const quoteParam: InternalAddLiquidityQuoteParam = {
      whirlpool,
      tokenAMintInfo,
      tokenBMintInfo,
      tokenMint,
      tokenAmount,
      tickLowerIndex,
      tickUpperIndex,
      slippageTolerence: slippageTolerence || defaultSlippagePercentage,
    };

    const positionStatus = PositionUtil.getPositionStatus(
      whirlpool.tickCurrentIndex,
      tickLowerIndex,
      tickUpperIndex
    );

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        return getAddLiquidityQuoteWhenPositionIsBelowRange(quoteParam);
      case PositionStatus.InRange:
        return getAddLiquidityQuoteWhenPositionIsInRange(quoteParam);
      case PositionStatus.AboveRange:
        return getAddLiquidityQuoteWhenPositionIsAboveRange(quoteParam);
      default:
        throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
    }
  }

  public async getRemoveLiquidityQuote(
    param: RemoveLiquidityQuoteParam
  ): Promise<RemoveLiquidityQuote> {
    const { address, liquidity, refresh, slippageTolerence } = param;

    const position = await this.getPosition(address, refresh);
    const whirlpool = await this.getWhirlpool(position, refresh);
    const [tokenAMintInfo, tokenBMintInfo] = await this.getTokenMintInfos(whirlpool);

    const quoteParam: InternalRemoveLiquidityQuoteParam = {
      whirlpool,
      position,
      tokenAMintInfo,
      tokenBMintInfo,
      liquidity,
      slippageTolerence: slippageTolerence || defaultSlippagePercentage,
    };

    const positionStatus = PositionUtil.getPositionStatus(
      whirlpool.tickCurrentIndex,
      position.tickLowerIndex,
      position.tickUpperIndex
    );

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        return getRemoveLiquidityQuoteWhenPositionIsBelowRange(quoteParam);
      case PositionStatus.InRange:
        return getRemoveLiquidityQuoteWhenPositionIsInRange(quoteParam);
      case PositionStatus.AboveRange:
        return getRemoveLiquidityQuoteWhenPositionIsAboveRange(quoteParam);
      default:
        throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
    }
  }

  public async getCollectFeesQuote(param: CollectFeesQuoteParam): Promise<CollectFeesQuote> {
    const { address, refresh } = param;

    const position = await this.getPosition(address, refresh);
    const whirlpool = await this.getWhirlpool(position, refresh);
    const [tickLower, tickUpper] = await this.getTickData(position, whirlpool, refresh);

    return getCollectFeesQuoteInternal({ whirlpool, position, tickLower, tickUpper });
  }

  public async getCollectRewardsQuote(
    param: CollectRewardsQuoteParam
  ): Promise<CollectRewardsQuote> {
    const { address, refresh } = param;

    const position = await this.getPosition(address, refresh);
    const whirlpool = await this.getWhirlpool(position, refresh);
    const [tickLower, tickUpper] = await this.getTickData(position, whirlpool, refresh);

    return getCollectRewardsQuoteInternal({ whirlpool, position, tickLower, tickUpper });
  }

  /*** Helpers ***/

  private async getPosition(address: PublicKey, refresh = false): Promise<PositionData> {
    const position = await this.dal.getPosition(address, refresh);
    invariant(!!position, "OrcaPosition - position does not exist");
    return position;
  }

  private async getWhirlpool(position: PositionData, refresh = false): Promise<WhirlpoolData> {
    const whirlpool = await this.dal.getPool(position.whirlpool, refresh);
    invariant(!!whirlpool, "OrcaPosition - whirlpool does not exist");
    return whirlpool;
  }

  private async getTokenMintInfos(whirlpool: WhirlpoolData): Promise<[MintInfo, MintInfo]> {
    const mintInfos = await this.dal.listMintInfos([whirlpool.tokenMintA, whirlpool.tokenMintB]);
    invariant(!!mintInfos && mintInfos.length === 2, "OrcaPosition - unable to get mint infos");
    invariant(!!mintInfos[0] && !!mintInfos[1], "OrcaPosition - mint infos do not exist");
    return [mintInfos[0], mintInfos[1]];
  }

  private async getTickData(
    position: PositionData,
    whirlpool: WhirlpoolData,
    refresh = false
  ): Promise<[TickData, TickData]> {
    const { tickLowerIndex, tickUpperIndex } = position;
    const [tickLowerAddress, tickUpperAddress] = this.getTickArrayAddress(position, whirlpool);

    const [tickArrayLower, tickArrayUpper] = await this.dal.listTickArrays(
      [tickLowerAddress, tickUpperAddress],
      refresh
    );
    invariant(!!tickArrayLower, "OrcaPosition - tickArrayLower does not exist");
    invariant(!!tickArrayUpper, "OrcaPosition - tickArrayUpper does not exist");

    return [
      TickUtil.getTick(tickArrayLower, tickLowerIndex, whirlpool.tickSpacing),
      TickUtil.getTick(tickArrayUpper, tickUpperIndex, whirlpool.tickSpacing),
    ];
  }

  private getTickArrayAddress(
    position: PositionData,
    whirlpool: WhirlpoolData
  ): [PublicKey, PublicKey] {
    const { tickLowerIndex, tickUpperIndex, whirlpool: whirlpoolAddress } = position;

    const tickLowerAddress = TickUtil.getAddressContainingTickIndex(
      tickLowerIndex,
      whirlpool.tickSpacing,
      whirlpoolAddress,
      this.dal.programId
    );
    const tickUpperAddress = TickUtil.getAddressContainingTickIndex(
      tickUpperIndex,
      whirlpool.tickSpacing,
      whirlpoolAddress,
      this.dal.programId
    );

    return [tickLowerAddress, tickUpperAddress];
  }
}
