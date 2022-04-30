import { MultiTransactionBuilder } from "../../utils/public/multi-transaction-builder";
import {
  CollectFeesAndRewardsTxParam,
  CollectMultipleFeesAndRewardsTxParam,
} from "../public/types";
import { OrcaDAL } from "../../dal/orca-dal";
import {
  EMPTY_INSTRUCTION,
  Instruction,
  NUM_REWARDS,
  PositionData,
  TransactionBuilder,
  WhirlpoolClient,
  WhirlpoolContext,
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

export async function buildMultipleCollectFeesAndRewardsTx(
  dal: OrcaDAL,
  param: CollectMultipleFeesAndRewardsTxParam
): Promise<MultiTransactionBuilder> {
  const { provider, positionAddresses, resolvedAssociatedTokenAddresses } = param;

  const ctx = WhirlpoolContext.withProvider(provider, dal.programId);
  const client = new WhirlpoolClient(ctx);

  const collectPositionTransactions: TransactionBuilder[] = [];

  const ataMap = resolvedAssociatedTokenAddresses ?? {};
  for (const positionAddress of positionAddresses) {
    const txn = await buildSingleCollectFeeAndRewardsTx(
      positionAddress,
      dal,
      client,
      provider,
      ataMap
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

  const collectAllTransactionBuilder = new MultiTransactionBuilder(provider, []);

  collectPositionTransactions.forEach((collectTxn) =>
    collectAllTransactionBuilder.addTxBuilder(collectTxn)
  );

  return collectAllTransactionBuilder;
}

export async function buildCollectFeesAndRewardsTx(
  dal: OrcaDAL,
  param: CollectFeesAndRewardsTxParam
): Promise<TransactionBuilder> {
  const { provider, positionAddress, resolvedAssociatedTokenAddresses } = param;

  const ctx = WhirlpoolContext.withProvider(provider, dal.programId);
  const client = new WhirlpoolClient(ctx);

  return await buildSingleCollectFeeAndRewardsTx(
    positionAddress,
    dal,
    client,
    provider,
    resolvedAssociatedTokenAddresses
  );
}

async function buildSingleCollectFeeAndRewardsTx(
  positionAddress: Address,
  dal: OrcaDAL,
  client: WhirlpoolClient,
  provider: Provider,
  ataMap?: Record<string, PublicKey>
): Promise<TransactionBuilder> {
  const txn: TransactionBuilder = new TransactionBuilder(provider);
  const positionInfo = await derivePositionInfo(positionAddress, dal, provider.wallet.publicKey);
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

  const {
    tokenOwnerAccount: tokenOwnerAccountA,
    createTokenOwnerAccountIx: createTokenOwnerAccountAIx,
  } = await getTokenAtaAndPopulateATAMap(dal, provider, whirlpool.tokenMintA, ataMap);
  const {
    tokenOwnerAccount: tokenOwnerAccountB,
    createTokenOwnerAccountIx: createTokenOwnerAccountBIx,
  } = await getTokenAtaAndPopulateATAMap(dal, provider, whirlpool.tokenMintB, ataMap);
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
        positionAuthority: provider.wallet.publicKey,
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
    } = await getTokenAtaAndPopulateATAMap(dal, provider, rewardInfo.mint, ataMap);

    if (createRewardTokenOwnerAccountIx) {
      txn.addInstruction(createRewardTokenOwnerAccountIx);
    }

    txn.addInstruction(
      client
        .collectRewardTx({
          whirlpool: position.whirlpool,
          positionAuthority: provider.wallet.publicKey,
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
  dal: OrcaDAL,
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
      dal,
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

async function derivePositionInfo(positionAddress: Address, dal: OrcaDAL, walletKey: PublicKey) {
  const position = await dal.getPosition(positionAddress, false);
  if (!position) {
    return null;
  }

  const whirlpool = await dal.getPool(position.whirlpool, false);
  if (!whirlpool) {
    return null;
  }

  const [tickArrayLower, tickArrayUpper] = TickUtil.getLowerAndUpperTickArrayAddresses(
    position.tickLowerIndex,
    position.tickUpperIndex,
    whirlpool.tickSpacing,
    position.whirlpool,
    dal.programId
  );

  const positionTokenAccount = await deriveATA(walletKey, position.positionMint);

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
