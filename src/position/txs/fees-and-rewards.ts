import { MultiTransactionBuilder } from "../../utils/public/multi-transaction-builder";
import { CollectMultipleFeesAndRewardsTxParam } from "../public/types";
import { OrcaDAL } from "../../dal/orca-dal";
import {
  TransactionBuilder,
  WhirlpoolClient,
  WhirlpoolContext,
} from "@orca-so/whirlpool-client-sdk";
import { TickUtil } from "../../utils/whirlpool/tick-util";
import { deriveATA } from "../../utils/web3/ata-utils";
import { toPubKey } from "../../utils/address";

export async function getMultipleCollectFeesAndRewardsTx(
  dal: OrcaDAL,
  param: CollectMultipleFeesAndRewardsTxParam
): Promise<MultiTransactionBuilder | null> {
  const { provider, positionAddresses } = param;

  const ctx = WhirlpoolContext.withProvider(provider, dal.programId);
  const client = new WhirlpoolClient(ctx);

  const txBuilders: TransactionBuilder[] = [];
  let mainTxBuilder: TransactionBuilder = new TransactionBuilder(provider);

  const ataMints: Set<string> = new Set();

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

    ataMints.add(whirlpool.tokenMintA.toBase58());
    ataMints.add(whirlpool.tokenMintB.toBase58());

    /* Update the states of owed fees and rewards */
    const updateIx = client
      .updateFeesAndRewards({
        whirlpool: position.whirlpool,
        position: toPubKey(positionAddress),
        tickArrayLower,
        tickArrayUpper,
      })
      .compressIx(false);
    mainTxBuilder.addInstruction(updateIx);
  }

  if (txBuilders.length === 0) {
    return null;
  }

  // WIP

  return new MultiTransactionBuilder(provider, txBuilders);
}
