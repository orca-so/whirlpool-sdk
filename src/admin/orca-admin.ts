import { getWhirlpoolPda, NUM_REWARDS, toX64 } from "@orca-so/whirlpool-client-sdk";
import WhirlpoolClient from "@orca-so/whirlpool-client-sdk/dist/client";
import WhirlpoolContext from "@orca-so/whirlpool-client-sdk/dist/context";
import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { Keypair } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  InitPoolTransactionParam,
  CollectProtocolFeesTransactionParam,
  SetFeeAuthorityParam,
  SetCollectProtocolFeesAuthorityParam,
  InitRewardTransactionParam,
  SetRewardAuthorityTransactionParam,
  SetRewardEmissionsTransactionParam,
  SetRewardAuthorityBySuperAuthorityTransactionParam,
  SetRewardEmissionsBySuperAuthorityTransactionParam,
} from "..";
import { OrcaDAL } from "../dal/orca-dal";

export class OrcaAdmin {
  constructor(private readonly dal: OrcaDAL) {}

  public getInitPoolTransaction(param: InitPoolTransactionParam): TransactionBuilder {
    const { provider, initialPrice, tokenMintA, tokenMintB, tickSpacing } = param;
    const { programId, whirlpoolsConfig: whirlpoolConfigKey } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpoolPda = getWhirlpoolPda(
      programId,
      whirlpoolConfigKey,
      tokenMintA,
      tokenMintB,
      tickSpacing
    );

    return client.initPoolTx({
      initSqrtPrice: toX64(initialPrice.sqrt()),
      whirlpoolConfigKey,
      tokenMintA,
      tokenMintB,
      whirlpoolPda,
      tokenVaultAKeypair: Keypair.generate(),
      tokenVaultBKeypair: Keypair.generate(),
      tickSpacing,
      funder: provider.wallet.publicKey,
    });
  }

  /*** Fee ***/

  public async getCollectProtocolFeesTransaction(
    param: CollectProtocolFeesTransactionParam
  ): Promise<TransactionBuilder> {
    const { provider, address, tokenDestinationA, tokenDestinationB } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.dal.getPool(address, true);
    invariant(!!whirlpool, "OrcaAdmin - whirlpool does not exist");

    return client.collectProtocolFeesTx({
      whirlpoolsConfig,
      whirlpool: address,
      collectProtocolFeesAuthority: provider.wallet.publicKey,
      tokenVaultA: whirlpool.tokenVaultA,
      tokenVaultB: whirlpool.tokenVaultB,
      tokenDestinationA,
      tokenDestinationB,
    });
  }

  public getSetFeeAuthority(param: SetFeeAuthorityParam): TransactionBuilder {
    const { provider, newFeeAuthority } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    return client.setFeeAuthorityTx({
      whirlpoolsConfig,
      feeAuthority: provider.wallet.publicKey,
      newFeeAuthority,
    });
  }

  public getSetCollectProtocolFeesAuthority(
    param: SetCollectProtocolFeesAuthorityParam
  ): TransactionBuilder {
    const { provider, newCollectProtocolFeesAuthority } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    return client.setCollectProtocolFeesAuthorityTx({
      whirlpoolsConfig,
      collectProtocolFeesAuthority: provider.wallet.publicKey,
      newCollectProtocolFeesAuthority,
    });
  }

  /*** Reward ***/

  public getInitRewardTransaction(param: InitRewardTransactionParam): TransactionBuilder {
    const { provider, rewardAuthority, whirlpool, rewardMint, rewardVaultKeypair, rewardIndex } =
      param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.initializeRewardTx({
      rewardAuthority,
      funder: provider.wallet.publicKey,
      whirlpool,
      rewardMint,
      rewardVaultKeypair,
      rewardIndex,
    });
  }

  public getSetRewardAuthorityTransaction(
    param: SetRewardAuthorityTransactionParam
  ): TransactionBuilder {
    const { provider, whirlpool, newRewardAuthority, rewardIndex } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardAuthorityTx({
      whirlpool,
      rewardAuthority: provider.wallet.publicKey,
      newRewardAuthority,
      rewardIndex,
    });
  }

  public getSetRewardEmissionsTransaction(
    param: SetRewardEmissionsTransactionParam
  ): TransactionBuilder {
    const { provider, whirlpool, rewardIndex, emissionsPerSecondX64, rewardVault } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardEmissionsTx({
      rewardAuthority: provider.wallet.publicKey,
      whirlpool,
      rewardIndex,
      emissionsPerSecondX64,
      rewardVault,
    });
  }

  public getSetRewardAuthorityBySuperAuthorityTransaction(
    param: SetRewardAuthorityBySuperAuthorityTransactionParam
  ): TransactionBuilder {
    const { provider, whirlpool, newRewardAuthority, rewardIndex } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardAuthorityBySuperAuthorityTx({
      whirlpoolsConfig,
      whirlpool,
      rewardEmissionsSuperAuthority: provider.wallet.publicKey,
      newRewardAuthority,
      rewardIndex,
    });
  }

  public getSetRewardEmissionsBySuperAuthorityTransaction(
    param: SetRewardEmissionsBySuperAuthorityTransactionParam
  ): TransactionBuilder {
    const { provider, rewardEmissionsSuperAuthority, newRewardEmissionsSuperAuthority } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    return client.setRewardEmissionsSuperAuthorityTx({
      whirlpoolsConfig,
      rewardEmissionsSuperAuthority,
      newRewardEmissionsSuperAuthority,
    });
  }
}
