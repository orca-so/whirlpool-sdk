import { MultiTransactionBuilder } from "../../utils/public/multi-transaction-builder";
import {
  CollectFeesAndRewardsTxParam,
  CollectMultipleFeesAndRewardsTxParam,
} from "../public/types";
import { AccountFetcher } from "../../accounts/account-fetcher";
import {
  EMPTY_INSTRUCTION,
  Instruction,
  NUM_REWARDS,
  PositionData,
  TransactionBuilder,
  WhirlpoolClient,
} from "@orca-so/whirlpool-client-sdk";
import { TickUtil } from "../../utils/whirlpool/tick-util";
import { deriveATA, resolveOrCreateATA } from "../../utils/web3/ata-utils";
import { toPubKey } from "../../utils/address";
import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { PoolUtil } from "../../utils/whirlpool/pool-util";
import { Address } from "@project-serum/anchor/dist/cjs/program/common";
import { Provider } from "@project-serum/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import { WhirlpoolContext } from "../../context";

export async function buildMultipleCollectFeesAndRewardsTx(
  ctx: WhirlpoolContext,
  param: CollectMultipleFeesAndRewardsTxParam
): Promise<MultiTransactionBuilder> {
  const { positionAddresses, resolvedAssociatedTokenAddresses } = param;
  const collectPositionTransactions: TransactionBuilder[] = [];

  for (const positionAddress of positionAddresses) {
    const txn = await buildSingleCollectFeeAndRewardsTx(
      ctx,
      positionAddress,
      resolvedAssociatedTokenAddresses
    );
    if (!txn.isEmpty()) {
      collectPositionTransactions.push(txn);
    }
  }

  /**
   * TODO: Find the maximum number of collect position calls we can fit in a transaction.
   * Note that the calls may not be the same size. The maximum size is a collect ix where
   * 1. TokenMintA requires a create ATA ix
   * 2. TokenMintB is a SOL account. Requires the create & clean up WSOL ATA ix
   * 3. Position liquidity is not null. updateFee Ix is required
   * 4. Need to collect fees
   * 5. Need to collect all 3 rewards
   *  */

  const collectAllTransactionBuilder = new MultiTransactionBuilder(ctx.provider, []);

  collectPositionTransactions.forEach((collectTxn) =>
    collectAllTransactionBuilder.addTxBuilder(collectTxn)
  );

  return collectAllTransactionBuilder;
}

export async function buildCollectFeesAndRewardsTx(
  ctx: WhirlpoolContext,
  param: CollectFeesAndRewardsTxParam
): Promise<TransactionBuilder> {
  const { positionAddress, resolvedAssociatedTokenAddresses } = param;

  return await buildSingleCollectFeeAndRewardsTx(
    ctx,
    positionAddress,
    resolvedAssociatedTokenAddresses
  );
}

async function buildSingleCollectFeeAndRewardsTx(
  ctx: WhirlpoolContext,
  positionAddress: Address,
  ataMap?: Record<string, PublicKey>
): Promise<TransactionBuilder> {
  const txn: TransactionBuilder = new TransactionBuilder(ctx.provider);
  const client: WhirlpoolClient = new WhirlpoolClient(ctx);
  const positionInfo = await derivePositionInfo(ctx, positionAddress);
  if (positionInfo == null) {
    return txn;
  }

  const {
    position,
    whirlpool,
    tickArrayLower,
    tickArrayUpper,
    positionTokenAccount,
    nothingToCollect,
  } = positionInfo;

  if (nothingToCollect) {
    return txn;
  }

  if (!ataMap) {
    ataMap = {};
  }

  // Derive and add the createATA instructions for each token mint. Note that
  // if the user already has the token ATAs, the instructions will be empty.
  const {
    tokenOwnerAccount: tokenOwnerAccountA,
    createTokenOwnerAccountIx: createTokenOwnerAccountAIx,
  } = await getTokenAtaAndPopulateATAMap(ctx.provider, whirlpool.tokenMintA, ataMap);
  const {
    tokenOwnerAccount: tokenOwnerAccountB,
    createTokenOwnerAccountIx: createTokenOwnerAccountBIx,
  } = await getTokenAtaAndPopulateATAMap(ctx.provider, whirlpool.tokenMintB, ataMap);
  txn.addInstruction(createTokenOwnerAccountAIx).addInstruction(createTokenOwnerAccountBIx);

  // If the position has zero liquidity, then the fees are already the most up to date.
  // No need to make an update call here.
  if (!position.liquidity.isZero()) {
    txn.addInstruction(
      client
        .updateFeesAndRewards({
          whirlpool: position.whirlpool,
          position: toPubKey(positionAddress),
          tickArrayLower,
          tickArrayUpper,
        })
        .compressIx(false)
    );
  }

  // Add a collectFee ix for this position
  txn.addInstruction(
    client
      .collectFeesTx({
        whirlpool: position.whirlpool,
        positionAuthority: ctx.provider.wallet.publicKey,
        position: toPubKey(positionAddress),
        positionTokenAccount,
        tokenOwnerAccountA,
        tokenOwnerAccountB,
        tokenVaultA: whirlpool.tokenVaultA,
        tokenVaultB: whirlpool.tokenVaultB,
      })
      .compressIx(false)
  );

  // Add a collectReward ix for a reward mint if the particular reward is initialized.
  for (const i of [...Array(NUM_REWARDS).keys()]) {
    const rewardInfo = whirlpool.rewardInfos[i];
    invariant(!!rewardInfo, "rewardInfo cannot be undefined");

    if (!PoolUtil.isRewardInitialized(rewardInfo)) {
      continue;
    }

    const {
      tokenOwnerAccount: rewardOwnerAccount,
      createTokenOwnerAccountIx: createRewardTokenOwnerAccountIx,
    } = await getTokenAtaAndPopulateATAMap(ctx.provider, rewardInfo.mint, ataMap);

    if (createRewardTokenOwnerAccountIx) {
      txn.addInstruction(createRewardTokenOwnerAccountIx);
    }

    txn.addInstruction(
      client
        .collectRewardTx({
          whirlpool: position.whirlpool,
          positionAuthority: ctx.provider.wallet.publicKey,
          position: toPubKey(positionAddress),
          positionTokenAccount,
          rewardOwnerAccount,
          rewardVault: rewardInfo.vault,
          rewardIndex: i,
        })
        .compressIx(false)
    );
  }

  return txn;
}

async function getTokenAtaAndPopulateATAMap(
  provider: Provider,
  tokenMint: PublicKey,
  ataMap: Record<string, PublicKey>
) {
  let _tokenMintA = tokenMint.toBase58();

  let tokenOwnerAccount: PublicKey;
  let createTokenOwnerAccountIx: Instruction = EMPTY_INSTRUCTION;
  const mappedTokenAAddress = ataMap[_tokenMintA];

  if (!mappedTokenAAddress) {
    const { address: _tokenOwnerAccount, ..._tokenOwnerAccountAIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      tokenMint
    );
    tokenOwnerAccount = _tokenOwnerAccount;
    createTokenOwnerAccountIx = _tokenOwnerAccountAIx;

    if (!tokenMint.equals(NATIVE_MINT)) {
      ataMap[_tokenMintA] = _tokenOwnerAccount;
    }
  } else {
    tokenOwnerAccount = mappedTokenAAddress;
  }

  return { tokenOwnerAccount, createTokenOwnerAccountIx };
}

async function derivePositionInfo(ctx: WhirlpoolContext, positionAddress: Address) {
  const position = await ctx.accountFetcher.getPosition(positionAddress, false);
  if (!position) {
    return null;
  }

  const whirlpool = await ctx.accountFetcher.getPool(position.whirlpool, false);
  if (!whirlpool) {
    return null;
  }

  const [tickArrayLower, tickArrayUpper] = TickUtil.getLowerAndUpperTickArrayAddresses(
    position.tickLowerIndex,
    position.tickUpperIndex,
    whirlpool.tickSpacing,
    position.whirlpool,
    ctx.program.programId
  );

  const positionTokenAccount = await deriveATA(ctx.wallet.publicKey, position.positionMint);

  const nothingToCollect =
    position.liquidity.isZero() && !hasOwedFees(position) && !hasOwedRewards(position);
  return {
    position,
    whirlpool,
    tickArrayLower,
    tickArrayUpper,
    positionTokenAccount,
    nothingToCollect,
  };
}

function hasOwedFees(position: PositionData) {
  return !(position.feeOwedA.isZero() && position.feeOwedB.isZero());
}

function hasOwedRewards(position: PositionData) {
  return position.rewardInfos.some((rewardInfo) => !rewardInfo.amountOwed.isZero());
}
