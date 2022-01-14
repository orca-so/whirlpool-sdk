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
import { TransactionExecutable } from "../utils/public/transaction-executable";

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
      wallet,
      initSqrtPrice,
      tokenMintA,
      tokenMintB,
      tokenVaultAKeypair,
      tokenVaultBKeypair,
      tickSpacing,
    } = param;
    const { connection, commitment, programId, whirlpoolsConfig: whirlpoolConfigKey } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
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
    const { wallet, address, tokenDestinationA, tokenDestinationB, refresh } = param;
    const { connection, commitment, programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.dal.getPool(address, refresh);
    invariant(!!whirlpool, "OrcaAdmin - whirlpool does not exist");

    return client.collectProtocolFeesTx({
      whirlpoolsConfig,
      whirlpool: address,
      collectProtocolFeesAuthority: wallet.publicKey,
      tokenVaultA: whirlpool.tokenVaultA,
      tokenVaultB: whirlpool.tokenVaultB,
      tokenDestinationA,
      tokenDestinationB,
    });
  }

  public getSetFeeAuthority(param: SetFeeAuthorityParam): TransactionBuilder {
    const { wallet, newFeeAuthority } = param;
    const { connection, commitment, programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
    const client = new WhirlpoolClient(ctx);

    return client.setFeeAuthorityIx({
      whirlpoolsConfig,
      feeAuthority: wallet.publicKey,
      newFeeAuthority,
    });
  }

  public getSetCollectProtocolFeesAuthority(
    param: SetCollectProtocolFeesAuthorityParam
  ): TransactionBuilder {
    const { wallet, newCollectProtocolFeesAuthority } = param;
    const { connection, commitment, programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
    const client = new WhirlpoolClient(ctx);

    return client.setCollectProtocolFeesAuthorityIx({
      whirlpoolsConfig,
      collectProtocolFeesAuthority: wallet.publicKey,
      newCollectProtocolFeesAuthority,
    });
  }

  /*** Reward ***/

  public async getInitRewardTransaction(
    param: InitRewardTransactionParam
  ): Promise<TransactionBuilder> {
    const { wallet, rewardAuthority, whirlpool, rewardMint, rewardVaultKeypair, rewardIndex } =
      param;
    const { connection, commitment, programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.initializeRewardTx({
      rewardAuthority,
      funder: wallet.publicKey,
      whirlpool,
      rewardMint,
      rewardVaultKeypair,
      rewardIndex,
    });
  }

  public async getSetRewardAuthorityTransaction(
    param: SetRewardAuthorityTransactionParam
  ): Promise<TransactionBuilder> {
    const { wallet, whirlpool, newRewardAuthority, rewardIndex } = param;
    const { connection, commitment, programId } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardAuthorityIx({
      whirlpool,
      rewardAuthority: wallet.publicKey,
      newRewardAuthority,
      rewardIndex,
    });
  }

  public async getSetRewardEmissionsTransaction(
    param: SetRewardEmissionsTransactionParam
  ): Promise<TransactionExecutable> {
    const { wallet, whirlpool, rewardIndex, emissionsPerSecondX64 } = param;
    const { connection, commitment, programId } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    client.setRewardEmissionsTx({
      rewardAuthority: wallet.publicKey,
      whirlpool,
      rewardIndex,
      emissionsPerSecondX64,
    });

    throw new Error();
  }

  public async getSetRewardAuthorityBySuperAuthorityTransaction(
    param: SetRewardAuthorityBySuperAuthorityTransactionParam
  ): Promise<TransactionExecutable> {
    const { wallet, whirlpool, newRewardAuthority, rewardIndex } = param;
    const { connection, commitment, programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    client.setRewardAuthorityBySuperAuthorityIx({
      whirlpoolsConfig,
      whirlpool,
      rewardEmissionsSuperAuthority: wallet.publicKey,
      newRewardAuthority,
      rewardIndex,
    });

    throw new Error();
  }

  public async getSetRewardEmissionsBySuperAuthorityTransaction(
    param: SetRewardEmissionsBySuperAuthorityTransactionParam
  ): Promise<TransactionExecutable> {
    const { wallet, rewardEmissionsSuperAuthorityKeypair, newRewardEmissionsSuperAuthority } =
      param;
    const { connection, commitment, programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.from(connection, wallet, programId, {
      commitment,
    });
    const client = new WhirlpoolClient(ctx);

    client.setRewardEmissionsSuperAuthorityIx({
      whirlpoolsConfig,
      rewardEmissionsSuperAuthorityKeypair,
      newRewardEmissionsSuperAuthority,
    });

    throw new Error();
  }
}
