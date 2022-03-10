import { Keypair, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  InitPoolTxParam,
  CollectProtocolFeesTxParam,
  SetFeeAuthorityTxParam,
  SetCollectProtocolFeesAuthorityTxParam,
  InitRewardTxParam,
  SetRewardAuthorityTxParam,
  SetRewardEmissionsTxParam,
  SetRewardAuthorityBySuperAuthorityTxParam,
  SetRewardEmissionsBySuperAuthorityTxParam,
  SetFeeRateTxParam,
  SetProtocolFeeRateTxParam,
} from "./public/types";
import { OrcaDAL } from "../dal/orca-dal";
import { toPubKey } from "../utils/address";
import {
  TransactionBuilder,
  WhirlpoolContext,
  WhirlpoolClient,
  getWhirlpoolPda,
  NUM_REWARDS,
  TickSpacing,
  getFeeTierPda,
  Instruction,
} from "@orca-so/whirlpool-client-sdk";
import { resolveOrCreateATA } from "../utils/web3/ata-utils";

export class OrcaAdmin {
  constructor(private readonly dal: OrcaDAL) {}

  public getInitPoolTx(param: InitPoolTxParam): { tx: TransactionBuilder; address: PublicKey } {
    const { provider, initSqrtPrice, tokenMintA, tokenMintB, stable } = param;
    const { programId, whirlpoolsConfig: whirlpoolConfigKey } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const tickSpacing = stable ? TickSpacing.Stable : TickSpacing.Standard;
    const whirlpoolPda = getWhirlpoolPda(
      programId,
      whirlpoolConfigKey,
      toPubKey(tokenMintA),
      toPubKey(tokenMintB),
      tickSpacing
    );

    const feeTierPda = getFeeTierPda(programId, whirlpoolConfigKey, tickSpacing);

    const tx = client.initPoolTx({
      initSqrtPrice,
      whirlpoolConfigKey,
      tokenMintA: toPubKey(tokenMintA),
      tokenMintB: toPubKey(tokenMintB),
      whirlpoolPda,
      tokenVaultAKeypair: Keypair.generate(),
      tokenVaultBKeypair: Keypair.generate(),
      tickSpacing,
      feeTierKey: feeTierPda.publicKey,
      funder: provider.wallet.publicKey,
    });

    return { tx, address: whirlpoolPda.publicKey };
  }

  /*** Fee ***/

  public async getCollectProtocolFeesTx(
    param: CollectProtocolFeesTxParam
  ): Promise<TransactionBuilder> {
    const {
      provider,
      poolAddress,
      tokenDestinationSystemAccount,
      tokenDestinationTokenAAccount,
      tokenDestinationTokenBAccount,
    } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.dal.getPool(poolAddress, true);
    invariant(!!whirlpool, "OrcaAdmin - whirlpool does not exist");

    let createTokenAAtaIx: Instruction | undefined = undefined;
    let createTokenBAtaIx: Instruction | undefined = undefined;

    let tokenDestinationA = tokenDestinationTokenAAccount;
    let tokenDestinationB = tokenDestinationTokenBAccount;

    if (!tokenDestinationSystemAccount || !tokenDestinationTokenBAccount) {
      invariant(!!tokenDestinationSystemAccount, "Token destination system account not specified");

      const { address: tokenAAta, ...tokenAAtaIx } = await resolveOrCreateATA(
        provider.connection,
        toPubKey(tokenDestinationSystemAccount),
        whirlpool.tokenMintA
      );
      tokenDestinationA = tokenAAta;
      createTokenAAtaIx = tokenAAtaIx;

      const { address: tokenBAta, ...tokenBAtaIx } = await resolveOrCreateATA(
        provider.connection,
        toPubKey(tokenDestinationSystemAccount),
        whirlpool.tokenMintB
      );
      tokenDestinationB = tokenBAta;
      createTokenBAtaIx = tokenBAtaIx;
    }

    invariant(!!tokenDestinationA, "Token A destination not specified");
    invariant(!!tokenDestinationB, "Token B destination not specified");

    const collectFeesIx = client
      .collectProtocolFeesTx({
        whirlpoolsConfig,
        whirlpool: toPubKey(poolAddress),
        collectProtocolFeesAuthority: provider.wallet.publicKey,
        tokenVaultA: whirlpool.tokenVaultA,
        tokenVaultB: whirlpool.tokenVaultB,
        tokenDestinationA: toPubKey(tokenDestinationA),
        tokenDestinationB: toPubKey(tokenDestinationB),
      })
      .compressIx(false);

    let txBuilder = new TransactionBuilder(provider);

    if (createTokenAAtaIx) {
      txBuilder = txBuilder.addInstruction(createTokenAAtaIx);
    }

    if (createTokenBAtaIx) {
      txBuilder = txBuilder.addInstruction(createTokenBAtaIx);
    }

    txBuilder = txBuilder.addInstruction(collectFeesIx);

    return txBuilder;
  }

  public getSetFeeAuthorityTx(param: SetFeeAuthorityTxParam): TransactionBuilder {
    const { provider, newFeeAuthority } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    return client.setFeeAuthorityTx({
      whirlpoolsConfig,
      feeAuthority: provider.wallet.publicKey,
      newFeeAuthority: toPubKey(newFeeAuthority),
    });
  }

  public async getSetFeeRateTx(param: SetFeeRateTxParam): Promise<TransactionBuilder> {
    const { provider, feeRate, poolAddress } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpoolsConfigAccount = await this.dal.getConfig(whirlpoolsConfig, true);
    invariant(
      !!whirlpoolsConfigAccount,
      `OrcaAdmin - Whirlpool config doesn't exist ${whirlpoolsConfig.toBase58()}`
    );

    return client.setFeeRateIx({
      whirlpool: toPubKey(poolAddress),
      whirlpoolsConfig,
      feeAuthority: whirlpoolsConfigAccount.feeAuthority,
      feeRate,
    });
  }

  public async getSetProtocolFeeRateTx(
    param: SetProtocolFeeRateTxParam
  ): Promise<TransactionBuilder> {
    const { provider, protocolFeeRate, poolAddress } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpoolsConfigAccount = await this.dal.getConfig(whirlpoolsConfig, true);
    invariant(
      !!whirlpoolsConfigAccount,
      `OrcaAdmin - Whirlpool config doesn't exist ${whirlpoolsConfig.toBase58()}`
    );

    return client.setProtocolFeeRateIx({
      whirlpool: toPubKey(poolAddress),
      whirlpoolsConfig,
      feeAuthority: whirlpoolsConfigAccount.feeAuthority,
      protocolFeeRate,
    });
  }

  public getSetCollectProtocolFeesAuthorityTx(
    param: SetCollectProtocolFeesAuthorityTxParam
  ): TransactionBuilder {
    const { provider, newCollectProtocolFeesAuthority } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    return client.setCollectProtocolFeesAuthorityTx({
      whirlpoolsConfig,
      collectProtocolFeesAuthority: provider.wallet.publicKey,
      newCollectProtocolFeesAuthority: toPubKey(newCollectProtocolFeesAuthority),
    });
  }

  /*** Reward ***/

  public getInitRewardTx(param: InitRewardTxParam): {
    tx: TransactionBuilder;
    rewardVault: PublicKey;
  } {
    const { provider, rewardAuthority, poolAddress, rewardMint, rewardIndex } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    const rewardVaultKeypair = Keypair.generate();
    const tx = client.initializeRewardTx({
      rewardAuthority: toPubKey(rewardAuthority),
      funder: provider.wallet.publicKey,
      whirlpool: toPubKey(poolAddress),
      rewardMint: toPubKey(rewardMint),
      rewardVaultKeypair,
      rewardIndex,
    });

    return { tx, rewardVault: rewardVaultKeypair.publicKey };
  }

  public getSetRewardAuthorityTx(param: SetRewardAuthorityTxParam): TransactionBuilder {
    const { provider, poolAddress, newRewardAuthority, rewardIndex } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardAuthorityTx({
      whirlpool: toPubKey(poolAddress),
      rewardAuthority: provider.wallet.publicKey,
      newRewardAuthority: toPubKey(newRewardAuthority),
      rewardIndex,
    });
  }

  public async getSetRewardEmissionsTx(
    param: SetRewardEmissionsTxParam
  ): Promise<TransactionBuilder> {
    const { provider, poolAddress, rewardIndex, emissionsPerSecondX64 } = param;
    const ctx = WhirlpoolContext.withProvider(provider, this.dal.programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    const whirlpool = await this.dal.getPool(poolAddress, true);
    const rewardVault = whirlpool?.rewardInfos[rewardIndex]?.vault;

    invariant(!!rewardVault, "reward vault doeos not exist");

    return client.setRewardEmissionsTx({
      rewardAuthority: provider.wallet.publicKey,
      whirlpool: toPubKey(poolAddress),
      rewardIndex,
      emissionsPerSecondX64,
      rewardVault,
    });
  }

  public getSetRewardAuthorityBySuperAuthorityTx(
    param: SetRewardAuthorityBySuperAuthorityTxParam
  ): TransactionBuilder {
    const { provider, poolAddress, newRewardAuthority, rewardIndex } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardAuthorityBySuperAuthorityTx({
      whirlpoolsConfig,
      whirlpool: toPubKey(poolAddress),
      rewardEmissionsSuperAuthority: provider.wallet.publicKey,
      newRewardAuthority: toPubKey(newRewardAuthority),
      rewardIndex,
    });
  }

  public getSetRewardEmissionsBySuperAuthorityTx(
    param: SetRewardEmissionsBySuperAuthorityTxParam
  ): TransactionBuilder {
    const { provider, rewardEmissionsSuperAuthority, newRewardEmissionsSuperAuthority } = param;
    const { programId, whirlpoolsConfig } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    return client.setRewardEmissionsSuperAuthorityTx({
      whirlpoolsConfig,
      rewardEmissionsSuperAuthority: toPubKey(rewardEmissionsSuperAuthority),
      newRewardEmissionsSuperAuthority: toPubKey(newRewardEmissionsSuperAuthority),
    });
  }
}
