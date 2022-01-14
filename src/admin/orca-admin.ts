import { getWhirlpoolPda, NUM_REWARDS } from "@orca-so/whirlpool-client-sdk";
import WhirlpoolClient from "@orca-so/whirlpool-client-sdk/dist/client";
import WhirlpoolContext from "@orca-so/whirlpool-client-sdk/dist/context";
import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
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

// TODO few keypairs sus
//      emissionsPerSecondX64 BN
//      initSqrtPrice
export class OrcaAdmin {
  private readonly dal: OrcaDAL;

  constructor(dal: OrcaDAL) {
    this.dal = dal;
  }

  public getInitPoolTransaction(param: InitPoolTransactionParam): TransactionBuilder {
    const {
      provider,
      initSqrtPrice,
      tokenMintA,
      tokenMintB,
      tokenVaultAKeypair,
      tokenVaultBKeypair,
      tickSpacing,
    } = param;
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
      initSqrtPrice,
      whirlpoolConfigKey,
      tokenMintA,
      tokenMintB,
      whirlpoolPda,
      tokenVaultAKeypair,
      tokenVaultBKeypair,
      tickSpacing,
    });
  }

  /*** Fee ***/

  public async getCollectProtocolFeesTransaction(
    param: CollectProtocolFeesTransactionParam
  ): Promise<TransactionBuilder> {
    const { provider, address, tokenDestinationA, tokenDestinationB, refresh } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.dal.getPool(address, refresh);
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

    return client.setFeeAuthorityIx({
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

    return client.setCollectProtocolFeesAuthorityIx({
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

    return client.setRewardAuthorityIx({
      whirlpool,
      rewardAuthority: provider.wallet.publicKey,
      newRewardAuthority,
      rewardIndex,
    });
  }

  public getSetRewardEmissionsTransaction(
    param: SetRewardEmissionsTransactionParam
  ): TransactionBuilder {
    const { provider, whirlpool, rewardIndex, emissionsPerSecondX64 } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardEmissionsTx({
      rewardAuthority: provider.wallet.publicKey,
      whirlpool,
      rewardIndex,
      emissionsPerSecondX64,
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

    return client.setRewardAuthorityBySuperAuthorityIx({
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
    const { provider, rewardEmissionsSuperAuthorityKeypair, newRewardEmissionsSuperAuthority } =
      param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    return client.setRewardEmissionsSuperAuthorityIx({
      whirlpoolsConfig,
      rewardEmissionsSuperAuthorityKeypair,
      newRewardEmissionsSuperAuthority,
    });
  }
}
