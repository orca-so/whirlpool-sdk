import { ZERO } from "@orca-so/sdk";
import {
  getFeeTierPda,
  getOraclePda,
  getPositionMetadataPda,
  getPositionPda,
  getTickArrayPda,
  getWhirlpoolPda,
  MAX_SQRT_PRICE,
  MAX_TICK_INDEX,
  MIN_SQRT_PRICE,
  MIN_TICK_INDEX,
  NUM_REWARDS,
  sqrtPriceX64ToTickIndex,
  TransactionBuilder,
  WhirlpoolClient,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk";
import { Address, translateAddress } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import invariant from "tiny-invariant";
import {
  InitPoolTxParam,
  InitRewardTxParam,
  SetRewardAuthorityTxParam,
  SetRewardEmissionsTxParam,
} from "../admin/public";
import { WhirlpoolContext } from "../context";
import { buildCollectFeesAndRewardsTx } from "../position/txs/fees-and-rewards";
import { toPubKey } from "../utils/address";
import { MultiTransactionBuilder } from "../utils/public";
import { deriveATA, resolveOrCreateATA } from "../utils/web3/ata-utils";
import { PoolUtil } from "../utils/whirlpool/pool-util";
import { TickUtil } from "../utils/whirlpool/tick-util";
import { Whirlpool } from "../whirlpool";
import { OpenPositionQuote, ClosePositionQuote, SwapQuote } from "./public";
import { LiquidityDistribution, getLiquidityDistribution } from "./ux/liquidity-distribution";

export class WhirlpoolImpl implements Whirlpool {
  private readonly ctx: WhirlpoolContext;
  private readonly address: PublicKey;

  constructor(ctx: WhirlpoolContext, address: PublicKey) {
    this.ctx = ctx;
    this.address = address;
  }

  getAddress(): PublicKey {
    return this.address;
  }

  getAccount(refresh: boolean): Promise<WhirlpoolData | null> {
    return this.ctx.accountFetcher.getPool(this.address, refresh);
  }

  init(param: InitPoolTxParam): { tx: TransactionBuilder; address: PublicKey } {
    const { initSqrtPrice, tokenMintA, tokenMintB, tickSpacing } = param;
    const programId = this.ctx.program.programId;
    const client = new WhirlpoolClient(this.ctx);

    // TODO: Ordering should be done by client-sdk
    const [_tokenMintA, _tokenMintB] = PoolUtil.orderMints(tokenMintA, tokenMintB);
    const whirlpoolPda = getWhirlpoolPda(
      programId,
      this.ctx.configAddress,
      toPubKey(tokenMintA),
      toPubKey(tokenMintB),
      tickSpacing
    );

    // TODO: Handle missing feeTier PDA
    const feeTierPda = getFeeTierPda(programId, this.ctx.configAddress, tickSpacing);

    const tx = client.initPoolTx({
      initSqrtPrice,
      whirlpoolConfigKey: this.ctx.configAddress,
      tokenMintA: toPubKey(tokenMintA),
      tokenMintB: toPubKey(tokenMintB),
      whirlpoolPda,
      tokenVaultAKeypair: Keypair.generate(),
      tokenVaultBKeypair: Keypair.generate(),
      tickSpacing,
      feeTierKey: feeTierPda.publicKey,
      funder: this.ctx.provider.wallet.publicKey,
    });

    return { tx, address: whirlpoolPda.publicKey };
  }

  async setFeeRate(feeRate: number): Promise<TransactionBuilder> {
    const client = new WhirlpoolClient(this.ctx);

    const whirlpoolsConfigAccount = await this.ctx.accountFetcher.getConfig(
      this.ctx.configAddress,
      true
    );
    invariant(
      !!whirlpoolsConfigAccount,
      `Whirlpool config doesn't exist ${this.ctx.configAddress.toBase58()}`
    );

    return client.setFeeRateIx({
      whirlpool: this.address,
      whirlpoolsConfig: this.ctx.configAddress,
      feeAuthority: whirlpoolsConfigAccount.feeAuthority,
      feeRate,
    });
  }

  async setProtocolFeeRate(protocolFeeRate: number): Promise<TransactionBuilder> {
    const client = new WhirlpoolClient(this.ctx);

    const whirlpoolsConfigAccount = await this.ctx.accountFetcher.getConfig(
      this.ctx.configAddress,
      true
    );
    invariant(
      !!whirlpoolsConfigAccount,
      `Whirlpool config doesn't exist ${this.ctx.configAddress.toBase58()}`
    );

    return client.setProtocolFeeRateIx({
      whirlpool: this.address,
      whirlpoolsConfig: this.ctx.configAddress,
      feeAuthority: whirlpoolsConfigAccount.feeAuthority,
      protocolFeeRate,
    });
  }

  async collectProtocolFee(): Promise<TransactionBuilder> {
    const client = new WhirlpoolClient(this.ctx);

    const whirlpool = await this.ctx.accountFetcher.getPool(this.address, true);
    invariant(!!whirlpool, "Whirlpool does not exist");

    const { address: tokenDestinationA, ...createTokenAAtaIx } = await resolveOrCreateATA(
      this.ctx.provider.connection,
      this.ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA
    );

    const { address: tokenDestinationB, ...createTokenBAtaIx } = await resolveOrCreateATA(
      this.ctx.provider.connection,
      this.ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB
    );

    const collectFeesIx = client
      .collectProtocolFeesTx({
        whirlpoolsConfig: this.ctx.configAddress,
        whirlpool: this.address,
        collectProtocolFeesAuthority: this.ctx.provider.wallet.publicKey,
        tokenVaultA: whirlpool.tokenVaultA,
        tokenVaultB: whirlpool.tokenVaultB,
        tokenDestinationA: toPubKey(tokenDestinationA),
        tokenDestinationB: toPubKey(tokenDestinationB),
      })
      .compressIx(false);

    return new TransactionBuilder(this.ctx.provider)
      .addInstruction(createTokenAAtaIx)
      .addInstruction(createTokenBAtaIx)
      .addInstruction(collectFeesIx);
  }

  initReward(param: InitRewardTxParam): { tx: TransactionBuilder; rewardVault: PublicKey } {
    const { rewardAuthority, rewardMint, rewardIndex } = param;
    const client = new WhirlpoolClient(this.ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    const rewardVaultKeypair = Keypair.generate();
    const tx = client.initializeRewardTx({
      rewardAuthority: toPubKey(rewardAuthority),
      funder: this.ctx.provider.wallet.publicKey,
      whirlpool: this.address,
      rewardMint: toPubKey(rewardMint),
      rewardVaultKeypair,
      rewardIndex,
    });

    return { tx, rewardVault: rewardVaultKeypair.publicKey };
  }

  setRewardAuthority(param: SetRewardAuthorityTxParam): TransactionBuilder {
    const { newRewardAuthority, rewardIndex } = param;
    const client = new WhirlpoolClient(this.ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    return client.setRewardAuthorityTx({
      whirlpool: this.address,
      rewardAuthority: this.ctx.provider.wallet.publicKey,
      newRewardAuthority: toPubKey(newRewardAuthority),
      rewardIndex,
    });
  }

  async setRewardEmissions(param: SetRewardEmissionsTxParam): Promise<TransactionBuilder> {
    const { rewardIndex, emissionsPerSecondX64 } = param;
    const client = new WhirlpoolClient(this.ctx);

    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");

    const whirlpool = await this.ctx.accountFetcher.getPool(this.address, true);
    const rewardVault = whirlpool?.rewardInfos[rewardIndex]?.vault;

    invariant(!!rewardVault, "reward vault doeos not exist");

    return client.setRewardEmissionsTx({
      rewardAuthority: this.ctx.provider.wallet.publicKey,
      whirlpool: this.address,
      rewardIndex,
      emissionsPerSecondX64,
      rewardVault,
    });
  }

  public async getLiquidityDistribution(
    tickLower: number,
    tickUpper: number,
    refresh = true
  ): Promise<LiquidityDistribution> {
    return getLiquidityDistribution(this.ctx, this.address, tickLower, tickUpper, refresh);
  }

  /**
   * Construct a transaction for opening an new position
   */
  public async openPosition(
    quote: OpenPositionQuote
  ): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey }> {
    return this.getOpenPositionWithOptMetadataTx(quote);
  }

  public async getOpenPositionWithMetadataTx(
    quote: OpenPositionQuote
  ): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey }> {
    return this.getOpenPositionWithOptMetadataTx(quote, true);
  }

  async getOpenPositionWithOptMetadataTx(
    quote: OpenPositionQuote,
    withMetadata: boolean = false
  ): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey }> {
    const { maxTokenA, maxTokenB, liquidity, tickLowerIndex, tickUpperIndex, poolAddress } = quote;
    invariant(liquidity.gt(new u64(0)), "liquidity must be greater than zero");

    const client = new WhirlpoolClient(this.ctx);

    const whirlpool = await this.ctx.accountFetcher.getPool(poolAddress, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
    }

    const positionMintKeypair = Keypair.generate();
    const positionPda = getPositionPda(this.ctx.program.programId, positionMintKeypair.publicKey);
    const metadataPda = getPositionMetadataPda(positionMintKeypair.publicKey);
    const positionTokenAccountAddress = await deriveATA(
      this.ctx.provider.wallet.publicKey,
      positionMintKeypair.publicKey
    );

    const txBuilder = new TransactionBuilder(this.ctx.provider);
    const preTxBuilder = new TransactionBuilder(this.ctx.provider);

    const positionIx = (withMetadata ? client.openPositionWithMetadataTx : client.openPositionTx)
      .bind(client)({
        funder: this.ctx.provider.wallet.publicKey,
        ownerKey: this.ctx.provider.wallet.publicKey,
        positionPda,
        metadataPda,
        positionMintAddress: positionMintKeypair.publicKey,
        positionTokenAccountAddress,
        whirlpoolKey: toPubKey(poolAddress),
        tickLowerIndex,
        tickUpperIndex,
      })
      .compressIx(false);
    txBuilder.addInstruction(positionIx).addSigner(positionMintKeypair);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      this.ctx.provider.connection,
      this.ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA,
      maxTokenA
    );
    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      this.ctx.provider.connection,
      this.ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB,
      maxTokenB
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const tickArrayLowerPda = TickUtil.getPdaWithTickIndex(
      tickLowerIndex,
      whirlpool.tickSpacing,
      poolAddress,
      this.ctx.program.programId
    );
    const tickArrayUpperPda = TickUtil.getPdaWithTickIndex(
      tickUpperIndex,
      whirlpool.tickSpacing,
      poolAddress,
      this.ctx.program.programId
    );

    const [tickArrayLower, tickArrayUpper] = await this.ctx.accountFetcher.listTickArrays(
      [tickArrayLowerPda.publicKey, tickArrayUpperPda.publicKey],
      true
    );

    let requirePreTx = false;
    if (tickArrayLower === null) {
      const tickArrayIx = client
        .initTickArrayTx({
          whirlpool: toPubKey(poolAddress),
          tickArrayPda: tickArrayLowerPda,
          startTick: TickUtil.getStartTickIndex(tickLowerIndex, whirlpool.tickSpacing),
          funder: this.ctx.provider.wallet.publicKey,
        })
        .compressIx(false);
      preTxBuilder.addInstruction(tickArrayIx);
      requirePreTx = true;
    }

    if (
      tickArrayUpper === null &&
      !tickArrayLowerPda.publicKey.equals(tickArrayUpperPda.publicKey)
    ) {
      const tickArrayIx = client
        .initTickArrayTx({
          whirlpool: toPubKey(poolAddress),
          tickArrayPda: tickArrayUpperPda,
          startTick: TickUtil.getStartTickIndex(tickUpperIndex, whirlpool.tickSpacing),
          funder: this.ctx.provider.wallet.publicKey,
        })
        .compressIx(false);
      preTxBuilder.addInstruction(tickArrayIx);
      requirePreTx = true;
    }

    const liquidityIx = client
      .increaseLiquidityTx({
        liquidityAmount: liquidity,
        tokenMaxA: maxTokenA,
        tokenMaxB: maxTokenB,
        whirlpool: toPubKey(poolAddress),
        positionAuthority: this.ctx.provider.wallet.publicKey,
        position: positionPda.publicKey,
        positionTokenAccount: positionTokenAccountAddress,
        tokenOwnerAccountA,
        tokenOwnerAccountB,
        tokenVaultA: whirlpool.tokenVaultA,
        tokenVaultB: whirlpool.tokenVaultB,
        tickArrayLower: tickArrayLowerPda.publicKey,
        tickArrayUpper: tickArrayUpperPda.publicKey,
      })
      .compressIx(false);
    txBuilder.addInstruction(liquidityIx);

    const tx = new MultiTransactionBuilder(this.ctx.provider, []);
    if (requirePreTx) {
      tx.addTxBuilder(preTxBuilder);
    }
    tx.addTxBuilder(txBuilder);

    return {
      mint: positionMintKeypair.publicKey,
      tx,
    };
  }

  public async initTickArray(startTick: number): Promise<TransactionBuilder> {
    const client = new WhirlpoolClient(this.ctx);
    const whirlpoolAddress = translateAddress(this.address);
    const tickArrayPda = getTickArrayPda(this.ctx.program.programId, whirlpoolAddress, startTick);
    // TODO: Where can we allow the user to pass in funder?
    return client.initTickArrayTx({
      startTick,
      tickArrayPda,
      whirlpool: whirlpoolAddress,
      funder: this.ctx.provider.wallet.publicKey,
    });
  }

  public async closePosition(quote: ClosePositionQuote): Promise<TransactionBuilder> {
    const client = new WhirlpoolClient(this.ctx);

    const position = await this.ctx.accountFetcher.getPosition(quote.positionAddress, true);
    if (!position) {
      throw new Error(`Position not found: ${translateAddress(quote.positionAddress).toBase58()}`);
    }

    const whirlpool = await this.ctx.accountFetcher.getPool(position.whirlpool, false);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(position.whirlpool).toBase58()}`);
    }

    const tickArrayLower = TickUtil.getPdaWithTickIndex(
      position.tickLowerIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.ctx.program.programId
    ).publicKey;
    const tickArrayUpper = TickUtil.getPdaWithTickIndex(
      position.tickUpperIndex,
      whirlpool.tickSpacing,
      position.whirlpool,
      this.ctx.program.programId
    ).publicKey;

    const positionTokenAccount = await deriveATA(
      this.ctx.provider.wallet.publicKey,
      position.positionMint
    );

    const txBuilder = new TransactionBuilder(this.ctx.provider);

    const resolvedAssociatedTokenAddresses: Record<string, PublicKey> = {};
    const { address: tokenOwnerAccountA, ...createTokenOwnerAccountAIx } = await resolveOrCreateATA(
      this.ctx.provider.connection,
      this.ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA
    );
    const { address: tokenOwnerAccountB, ...createTokenOwnerAccountBIx } = await resolveOrCreateATA(
      this.ctx.provider.connection,
      this.ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB
    );
    txBuilder.addInstruction(createTokenOwnerAccountAIx).addInstruction(createTokenOwnerAccountBIx);
    resolvedAssociatedTokenAddresses[whirlpool.tokenMintA.toBase58()] = tokenOwnerAccountA;
    resolvedAssociatedTokenAddresses[whirlpool.tokenMintB.toBase58()] = tokenOwnerAccountB;

    const collectTx = await buildCollectFeesAndRewardsTx(this.ctx, {
      positionAddress: quote.positionAddress,
      resolvedAssociatedTokenAddresses,
    });
    txBuilder.addInstruction(collectTx.compressIx(false));

    /* Remove all liquidity remaining in the position */

    if (position.liquidity.gt(new u64(0))) {
      const liquidityIx = client
        .decreaseLiquidityTx({
          liquidityAmount: position.liquidity,
          tokenMinA: quote.minTokenA,
          tokenMinB: quote.minTokenB,
          whirlpool: position.whirlpool,
          positionAuthority: this.ctx.provider.wallet.publicKey,
          position: toPubKey(quote.positionAddress),
          positionTokenAccount,
          tokenOwnerAccountA,
          tokenOwnerAccountB,
          tokenVaultA: whirlpool.tokenVaultA,
          tokenVaultB: whirlpool.tokenVaultB,
          tickArrayLower,
          tickArrayUpper,
        })
        .compressIx(false);
      txBuilder.addInstruction(liquidityIx);
    }

    /* Close position */

    const positionIx = client
      .closePositionTx({
        positionAuthority: this.ctx.provider.wallet.publicKey,
        receiver: this.ctx.provider.wallet.publicKey,
        positionTokenAccount,
        position: toPubKey(quote.positionAddress),
        positionMint: position.positionMint,
      })
      .compressIx(false);
    txBuilder.addInstruction(positionIx);

    return txBuilder;
  }

  async getLowestInitializedTickArrayTickIndex(
    ctx: WhirlpoolContext,
    poolAddress: Address,
    tickSpacing: number
  ): Promise<number> {
    let offset = 1;
    while (true) {
      const tickArrayPda = TickUtil.getPdaWithTickIndex(
        MIN_TICK_INDEX,
        tickSpacing,
        poolAddress,
        ctx.program.programId,
        offset
      );

      // Throttle to prevent being rate-limited
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const tickArray = await ctx.accountFetcher.getTickArray(tickArrayPda.publicKey, false);
      if (!tickArray) {
        offset++;
        continue;
      }

      return TickUtil.getStartTickIndex(MIN_TICK_INDEX, tickSpacing, offset);
    }
  }

  async getHighestInitializedTickArrayTickIndex(
    ctx: WhirlpoolContext,
    poolAddress: Address,
    tickSpacing: number
  ): Promise<number> {
    let offset = -1;
    while (true) {
      const tickArrayPda = TickUtil.getPdaWithTickIndex(
        MAX_TICK_INDEX,
        tickSpacing,
        poolAddress,
        ctx.program.programId,
        offset
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const tickArray = await ctx.accountFetcher.getTickArray(tickArrayPda.publicKey, false);
      if (!tickArray) {
        offset--;
        continue;
      }

      return TickUtil.getStartTickIndex(MAX_TICK_INDEX, tickSpacing, offset);
    }
  }

  public async initTickArrayGap(): Promise<MultiTransactionBuilder> {
    const client = new WhirlpoolClient(this.ctx);

    const whirlpool = await this.ctx.accountFetcher.getPool(this.address, true);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(this.address).toBase58()}`);
    }

    const firstTickIndex = await this.getLowestInitializedTickArrayTickIndex(
      this.ctx,
      this.address,
      whirlpool.tickSpacing
    );
    const lastTickIndex = await this.getHighestInitializedTickArrayTickIndex(
      this.ctx,
      this.address,
      whirlpool.tickSpacing
    );

    // get all lowest and highest tick array
    let numIxs = 0;
    let txBuilder = new TransactionBuilder(this.ctx.provider);
    const multiTxBuilder = new MultiTransactionBuilder(this.ctx.provider, []);
    let offset = 1;
    while (true) {
      const tickArrayPda = TickUtil.getPdaWithTickIndex(
        firstTickIndex,
        whirlpool.tickSpacing,
        this.address,
        this.ctx.program.programId,
        offset
      );

      const startTick = TickUtil.getStartTickIndex(firstTickIndex, whirlpool.tickSpacing, offset);
      if (startTick === lastTickIndex) {
        break;
      }

      // Throttle to prevent being rate-limited
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const tickArray = await this.ctx.accountFetcher.getTickArray(tickArrayPda.publicKey, false);
      if (!tickArray) {
        txBuilder.addInstruction(
          client
            .initTickArrayTx({
              whirlpool: toPubKey(this.address),
              tickArrayPda,
              startTick,
              funder: this.ctx.provider.wallet.publicKey,
            })
            .compressIx(false)
        );

        numIxs++;

        if (!(numIxs % 7)) {
          multiTxBuilder.addTxBuilder(txBuilder);
          txBuilder = new TransactionBuilder(this.ctx.provider);
        }
      }

      offset++;
    }

    if (numIxs % 7) {
      multiTxBuilder.addTxBuilder(txBuilder);
    }

    return multiTxBuilder;
  }

  /**
   * Construct a transaction for a swap
   */
  public async swap(quote: SwapQuote): Promise<MultiTransactionBuilder> {
    const {
      sqrtPriceLimitX64,
      otherAmountThreshold,
      amountIn,
      amountOut,
      aToB,
      fixedInput,
      poolAddress,
    } = quote;
    const client = new WhirlpoolClient(this.ctx);

    const whirlpool = await this.ctx.accountFetcher.getPool(poolAddress, true);
    if (!whirlpool) {
      throw new Error(`Whirlpool not found: ${translateAddress(poolAddress).toBase58()}`);
    }

    const txBuilder = new TransactionBuilder(this.ctx.provider);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } = await resolveOrCreateATA(
      this.ctx.provider.connection,
      this.ctx.provider.wallet.publicKey,
      whirlpool.tokenMintA,
      aToB ? amountIn : ZERO
    );
    txBuilder.addInstruction(tokenOwnerAccountAIx);

    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } = await resolveOrCreateATA(
      this.ctx.provider.connection,
      this.ctx.provider.wallet.publicKey,
      whirlpool.tokenMintB,
      !aToB ? amountIn : ZERO
    );
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const targetSqrtPriceLimitX64 = sqrtPriceLimitX64 || this.getDefaultSqrtPriceLimit(aToB);

    const tickArrayAddresses = await this.getTickArrayPublicKeysForSwap(
      this.ctx,
      whirlpool.sqrtPrice,
      targetSqrtPriceLimitX64,
      whirlpool.tickSpacing,
      toPubKey(poolAddress),
      this.ctx.program.programId
    );

    const oraclePda = getOraclePda(this.ctx.program.programId, translateAddress(poolAddress));

    txBuilder.addInstruction(
      client
        .swapTx({
          amount: fixedInput ? amountIn : amountOut,
          otherAmountThreshold,
          sqrtPriceLimit: targetSqrtPriceLimitX64,
          amountSpecifiedIsInput: fixedInput,
          aToB,
          whirlpool: toPubKey(poolAddress),
          tokenAuthority: this.ctx.provider.wallet.publicKey,
          tokenOwnerAccountA,
          tokenVaultA: whirlpool.tokenVaultA,
          tokenOwnerAccountB,
          tokenVaultB: whirlpool.tokenVaultB,
          tickArray0: tickArrayAddresses[0],
          tickArray1: tickArrayAddresses[1],
          tickArray2: tickArrayAddresses[2],
          oracle: oraclePda.publicKey,
        })
        .compressIx(false)
    );

    return new MultiTransactionBuilder(this.ctx.provider, [txBuilder]);
  }

  private getDefaultSqrtPriceLimit(aToB: boolean): BN {
    return new BN(aToB ? MIN_SQRT_PRICE : MAX_SQRT_PRICE);
  }

  private async getTickArrayPublicKeysForSwap(
    ctx: WhirlpoolContext,
    currentSqrtPriceX64: BN,
    targetSqrtPriceX64: BN,
    tickSpacing: number,
    poolAddress: PublicKey,
    programId: PublicKey
  ): Promise<[PublicKey, PublicKey, PublicKey]> {
    const currentTickIndex = sqrtPriceX64ToTickIndex(currentSqrtPriceX64);
    const targetTickIndex = sqrtPriceX64ToTickIndex(targetSqrtPriceX64);

    let currentStartTickIndex = TickUtil.getStartTickIndex(currentTickIndex, tickSpacing);
    const targetStartTickIndex = TickUtil.getStartTickIndex(targetTickIndex, tickSpacing);

    const offset = currentTickIndex < targetTickIndex ? 1 : -1;

    let count = 1;
    const tickArrayAddresses: [PublicKey, PublicKey, PublicKey] = [
      getTickArrayPda(programId, poolAddress, currentStartTickIndex).publicKey,
      PublicKey.default,
      PublicKey.default,
    ];

    while (currentStartTickIndex != targetStartTickIndex && count < 3) {
      const nextStartTickIndex = TickUtil.getStartTickIndex(
        currentTickIndex,
        tickSpacing,
        offset * count
      );
      const nextTickArrayAddress = getTickArrayPda(
        programId,
        poolAddress,
        nextStartTickIndex
      ).publicKey;

      const nextTickArray = await ctx.accountFetcher.getTickArray(nextTickArrayAddress, false);
      if (!nextTickArray) {
        break;
      }

      tickArrayAddresses[count] = nextTickArrayAddress;
      count++;
      currentStartTickIndex = nextStartTickIndex;
    }

    while (count < 3) {
      tickArrayAddresses[count] = getTickArrayPda(
        programId,
        poolAddress,
        currentStartTickIndex
      ).publicKey;
      count++;
    }

    return tickArrayAddresses;
  }

  setRewardAuthorityBySuperAuthority(
    newRewardAuthority: Address,
    rewardIndex: number
  ): TransactionBuilder {
    invariant(rewardIndex < NUM_REWARDS, "invalid rewardIndex");
    const client = new WhirlpoolClient(this.ctx);
    return client.setRewardAuthorityBySuperAuthorityTx({
      whirlpoolsConfig: this.ctx.configAddress,
      whirlpool: this.address,
      rewardEmissionsSuperAuthority: this.ctx.provider.wallet.publicKey,
      newRewardAuthority: toPubKey(newRewardAuthority),
      rewardIndex,
    });
  }
}
