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
  public getInitPoolTx(
    ctx: WhirlpoolContext,
    param: InitPoolTxParam
  ): { tx: TransactionBuilder; address: PublicKey } {
    const { initSqrtPrice, tokenMintA, tokenMintB, stable } = param;
    const programId = ctx.program.programId;
    const client = new WhirlpoolClient(ctx);
    const tickSpacing = stable ? TickSpacing.Stable : TickSpacing.Standard;
    const whirlpoolPda = getWhirlpoolPda(
      programId,
      ctx.configAddress,
      toPubKey(tokenMintA),
      toPubKey(tokenMintB),
      tickSpacing
    );

    const feeTierPda = getFeeTierPda(programId, ctx.configAddress, tickSpacing);

    const tx = client.initPoolTx({
      initSqrtPrice,
      whirlpoolConfigKey: ctx.configAddress,
      tokenMintA: toPubKey(tokenMintA),
      tokenMintB: toPubKey(tokenMintB),
      whirlpoolPda,
      tokenVaultAKeypair: Keypair.generate(),
      tokenVaultBKeypair: Keypair.generate(),
      tickSpacing,
      feeTierKey: feeTierPda.publicKey,
      funder: ctx.provider.wallet.publicKey,
    });

    return { tx, address: whirlpoolPda.publicKey };
  }

  /*** Fee ***/

  public async getCollectProtocolFeesTx(
    ctx: WhirlpoolContext,
    param: CollectProtocolFeesTxParam
  ): Promise<TransactionBuilder> {
    const { poolAddress } = param;
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await ctx.accountFetcher.getPool(poolAddress, true);
    invariant(!!whirlpool, "OrcaAdmin - whirlpool does not exist");

    const { address: tokenDestinationA, ...createTokenAAtaIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA
    );

    const { address: tokenDestinationB, ...createTokenBAtaIx } = await resolveOrCreateATA(
      ctx.provider.connection,
      ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB
    );

    const collectFeesIx = client
      .collectProtocolFeesTx({
        whirlpoolsConfig: ctx.configAddress,
        whirlpool: toPubKey(poolAddress),
        collectProtocolFeesAuthority: ctx.provider.wallet.publicKey,
        tokenVaultA: whirlpool.tokenVaultA,
        tokenVaultB: whirlpool.tokenVaultB,
        tokenDestinationA: toPubKey(tokenDestinationA),
        tokenDestinationB: toPubKey(tokenDestinationB),
      })
      .compressIx(false);

    return new TransactionBuilder(ctx.provider)
      .addInstruction(createTokenAAtaIx)
      .addInstruction(createTokenBAtaIx)
      .addInstruction(collectFeesIx);
  }

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

  public async getSetFeeRateTx(
    ctx: WhirlpoolContext,
    param: SetFeeRateTxParam
  ): Promise<TransactionBuilder> {
    const { feeRate, poolAddress } = param;
    const client = new WhirlpoolClient(ctx);

    const whirlpoolsConfigAccount = await ctx.accountFetcher.getConfig(ctx.configAddress, true);
    invariant(
      !!whirlpoolsConfigAccount,
      `OrcaAdmin - Whirlpool config doesn't exist ${ctx.configAddress.toBase58()}`
    );

    return client.setFeeRateIx({
      whirlpool: toPubKey(poolAddress),
      whirlpoolsConfig: ctx.configAddress,
      feeAuthority: whirlpoolsConfigAccount.feeAuthority,
      feeRate,
    });
  }

  public async getSetProtocolFeeRateTx(
    ctx: WhirlpoolContext,
    param: SetProtocolFeeRateTxParam
  ): Promise<TransactionBuilder> {
    const { protocolFeeRate, poolAddress } = param;
    const client = new WhirlpoolClient(ctx);

    const whirlpoolsConfigAccount = await ctx.accountFetcher.getConfig(ctx.configAddress, true);
    invariant(
      !!whirlpoolsConfigAccount,
      `OrcaAdmin - Whirlpool config doesn't exist ${ctx.configAddress.toBase58()}`
    );

    return client.setProtocolFeeRateIx({
      whirlpool: toPubKey(poolAddress),
      whirlpoolsConfig: ctx.configAddress,
      feeAuthority: whirlpoolsConfigAccount.feeAuthority,
      protocolFeeRate,
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

  public getInitRewardTx(
    ctx: WhirlpoolContext,
    param: InitRewardTxParam
  ): {
    tx: TransactionBuilder;
    rewardVault: PublicKey;
  } {
    const { rewardAuthority, poolAddress, rewardMint, rewardIndex } = param;
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    const rewardVaultKeypair = Keypair.generate();
    const tx = client.initializeRewardTx({
      rewardAuthority: toPubKey(rewardAuthority),
      funder: ctx.provider.wallet.publicKey,
      whirlpool: toPubKey(poolAddress),
      rewardMint: toPubKey(rewardMint),
      rewardVaultKeypair,
      rewardIndex,
    });

    return { tx, rewardVault: rewardVaultKeypair.publicKey };
  }

  public getSetRewardAuthorityTx(
    ctx: WhirlpoolContext,
    param: SetRewardAuthorityTxParam
  ): TransactionBuilder {
    const { poolAddress, newRewardAuthority, rewardIndex } = param;
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardAuthorityTx({
      whirlpool: toPubKey(poolAddress),
      rewardAuthority: ctx.provider.wallet.publicKey,
      newRewardAuthority: toPubKey(newRewardAuthority),
      rewardIndex,
    });
  }

  public async getSetRewardEmissionsTx(
    ctx: WhirlpoolContext,
    param: SetRewardEmissionsTxParam
  ): Promise<TransactionBuilder> {
    const { poolAddress, rewardIndex, emissionsPerSecondX64 } = param;
    const client = new WhirlpoolClient(ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    const whirlpool = await ctx.accountFetcher.getPool(poolAddress, true);
    const rewardVault = whirlpool?.rewardInfos[rewardIndex]?.vault;

    invariant(!!rewardVault, "reward vault doeos not exist");

    return client.setRewardEmissionsTx({
      rewardAuthority: ctx.provider.wallet.publicKey,
      whirlpool: toPubKey(poolAddress),
      rewardIndex,
      emissionsPerSecondX64,
      rewardVault,
    });
  }

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
