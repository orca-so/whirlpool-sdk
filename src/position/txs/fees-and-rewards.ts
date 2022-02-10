import { MultiTransactionBuilder } from "../../utils/public/multi-transaction-builder";
import { CollectMultipleFeesAndRewardsTxParam } from "../public/types";
import { OrcaDAL } from "../../dal/orca-dal";
import {
  Instruction,
  NUM_REWARDS,
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

export async function getMultipleCollectFeesAndRewardsTx(
  dal: OrcaDAL,
  param: CollectMultipleFeesAndRewardsTxParam
): Promise<{ tx: MultiTransactionBuilder; ataMap: Record<string, { address: PublicKey }> } | null> {
  const { provider, positionAddresses } = param;

  const ctx = WhirlpoolContext.withProvider(provider, dal.programId);
  const client = new WhirlpoolClient(ctx);

  const collectInstructions: Instruction[] = [];
  const ataMap: Record<string, { address: PublicKey; ix: Instruction }> = {};

  for (const positionAddress of positionAddresses) {
    const position = await dal.getPosition(positionAddress, false);
    if (!position) {
      continue;
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
    const positionTokenAccount = await deriveATA(provider.wallet.publicKey, position.positionMint);

    /* Get user's associated token accounts. Create them if they don't exist.  */

    const tokenMintA = whirlpool.tokenMintA.toBase58();
    const tokenMintB = whirlpool.tokenMintB.toBase58();
    const { address: _tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintA
    );
    const { address: _tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      provider.connection,
      provider.wallet.publicKey,
      whirlpool.tokenMintB
    );
    const tokenOwnerAccountA = ataMap[tokenMintA]?.address || _tokenOwnerAccountA;
    const tokenOwnerAccountB = ataMap[tokenMintB]?.address || _tokenOwnerAccountB;
    if (!ataMap[tokenMintA]) {
      ataMap[tokenMintA] = { address: tokenOwnerAccountA, ix: tokenOwnerAccountAIx };
    }
    if (!ataMap[tokenMintB]) {
      ataMap[tokenMintB] = { address: tokenOwnerAccountB, ix: tokenOwnerAccountBIx };
    }

    /* Update the states of owed fees and rewards */
    const updateIx = client
      .updateFeesAndRewards({
        whirlpool: position.whirlpool,
        position: toPubKey(positionAddress),
        tickArrayLower,
        tickArrayUpper,
      })
      .compressIx(false);
    collectInstructions.push(updateIx);

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
    collectInstructions.push(feeIx);

    /* Collect rewards */
    for (const i of [...Array(NUM_REWARDS).keys()]) {
      const rewardInfo = whirlpool.rewardInfos[i];
      invariant(!!rewardInfo, "rewardInfo cannot be undefined");

      if (PoolUtil.isRewardInitialized(rewardInfo)) {
        const { address: _rewardOwnerAccount, ...rewardOwnerAccountIx } = await resolveOrCreateATA(
          provider.connection,
          provider.wallet.publicKey,
          rewardInfo.mint
        );
        const rewardMint = rewardInfo.mint.toBase58();
        const rewardOwnerAccount = ataMap[rewardMint]?.address || _rewardOwnerAccount;
        if (!ataMap[rewardMint]) {
          ataMap[rewardMint] = { address: rewardOwnerAccount, ix: rewardOwnerAccountIx };
        }

        const rewardTx = client
          .collectRewardTx({
            whirlpool: position.whirlpool,
            positionAuthority: provider.wallet.publicKey,
            position: toPubKey(positionAddress),
            positionTokenAccount,
            rewardOwnerAccount,
            rewardVault: rewardInfo.vault,
            tickArrayLower,
            tickArrayUpper,
            rewardIndex: i,
          })
          .compressIx(false);
        collectInstructions.push(rewardTx);
      }
    }
  }

  const tx = new MultiTransactionBuilder(provider, []);

  let ataTxBuilder = new TransactionBuilder(provider);
  let ataTxBuilderSize = 0;
  Object.values(ataMap).forEach(({ ix }) => {
    if (ix.instructions.length === 0) {
      return;
    }

    ataTxBuilder.addInstruction(ix);
    ataTxBuilderSize += 1;

    if (ataTxBuilderSize % 6 === 0) {
      // TODO: figure out the optimal transaction size
      tx.addTxBuilder(ataTxBuilder);
      ataTxBuilder = new TransactionBuilder(provider);
    }
  });

  let collectTxBuilder = new TransactionBuilder(provider);
  let collectTxBuilderSize = 0;
  collectInstructions.forEach((ix) => {
    if (ix.instructions.length === 0) {
      return;
    }

    collectTxBuilder.addInstruction(ix);
    collectTxBuilderSize += 1;
    if (collectTxBuilderSize % 6 === 0) {
      // TODO: figure out the optimal transaction size
      tx.addTxBuilder(collectTxBuilder);
      collectTxBuilder = new TransactionBuilder(provider);
    }
  });

  if (tx.txBuilders.length === 0) {
    return null;
  }

  return { tx, ataMap };
}
