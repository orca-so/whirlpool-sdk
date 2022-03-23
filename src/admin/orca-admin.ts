import { Keypair, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  SetFeeAuthorityTxParam,
  SetCollectProtocolFeesAuthorityTxParam,
  InitRewardTxParam,
  SetRewardAuthorityTxParam,
  SetRewardEmissionsTxParam,
  SetRewardAuthorityBySuperAuthorityTxParam,
  SetRewardEmissionsBySuperAuthorityTxParam,
} from "./public/types";
import { toPubKey } from "../utils/address";
import {
  TransactionBuilder,
  WhirlpoolClient,
  getWhirlpoolPda,
  NUM_REWARDS,
  TickSpacing,
  getFeeTierPda,
} from "@orca-so/whirlpool-client-sdk";
import { resolveOrCreateATA } from "../utils/web3/ata-utils";
import { WhirlpoolContext } from "../context";

export class OrcaAdmin {
  public getSetFeeAuthorityTx(
    ctx: WhirlpoolContext,
    param: SetFeeAuthorityTxParam
  ): TransactionBuilder {
    const { newFeeAuthority } = param;
    const client = new WhirlpoolClient(ctx);
    return client.setFeeAuthorityTx({
      whirlpoolsConfig: ctx.configAddress,
      feeAuthority: ctx.provider.wallet.publicKey,
      newFeeAuthority: toPubKey(newFeeAuthority),
    });
  }

  public getSetCollectProtocolFeesAuthorityTx(
    ctx: WhirlpoolContext,
    param: SetCollectProtocolFeesAuthorityTxParam
  ): TransactionBuilder {
    const { newCollectProtocolFeesAuthority } = param;
    const client = new WhirlpoolClient(ctx);

    return client.setCollectProtocolFeesAuthorityTx({
      whirlpoolsConfig: ctx.configAddress,
      collectProtocolFeesAuthority: ctx.provider.wallet.publicKey,
      newCollectProtocolFeesAuthority: toPubKey(newCollectProtocolFeesAuthority),
    });
  }

  /*** Reward ***/

  public getSetRewardAuthorityBySuperAuthorityTx(
    ctx: WhirlpoolContext,
    param: SetRewardAuthorityBySuperAuthorityTxParam
  ): TransactionBuilder {
    const { poolAddress, newRewardAuthority, rewardIndex } = param;
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardAuthorityBySuperAuthorityTx({
      whirlpoolsConfig: ctx.configAddress,
      whirlpool: toPubKey(poolAddress),
      rewardEmissionsSuperAuthority: ctx.provider.wallet.publicKey,
      newRewardAuthority: toPubKey(newRewardAuthority),
      rewardIndex,
    });
  }

  public getSetRewardEmissionsBySuperAuthorityTx(
    ctx: WhirlpoolContext,
    param: SetRewardEmissionsBySuperAuthorityTxParam
  ): TransactionBuilder {
    const { rewardEmissionsSuperAuthority, newRewardEmissionsSuperAuthority } = param;
    const client = new WhirlpoolClient(ctx);

    return client.setRewardEmissionsSuperAuthorityTx({
      whirlpoolsConfig: ctx.configAddress,
      rewardEmissionsSuperAuthority: toPubKey(rewardEmissionsSuperAuthority),
      newRewardEmissionsSuperAuthority: toPubKey(newRewardEmissionsSuperAuthority),
    });
  }
}
