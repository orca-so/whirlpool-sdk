import {
  fromX64,
  getPositionPda,
  sqrtPriceX64ToTickIndex,
  toX64,
} from "@orca-so/whirlpool-client-sdk";
import WhirlpoolClient from "@orca-so/whirlpool-client-sdk/dist/client";
import WhirlpoolContext from "@orca-so/whirlpool-client-sdk/dist/context";
import {
  PositionData,
  TICK_ARRAY_SIZE,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { MintInfo, u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import {
  AddLiquidityQuote,
  ClosePositionQuote,
  ClosePositionQuoteParam,
  ClosePositionTransaction,
  ClosePositionTransactionParam,
  OpenPositionQuote,
  OpenPositionQuoteParam,
  OpenPositionTransaction,
  OpenPositionTransactionParam,
  SwapQuote,
  SwapQuoteParam,
  SwapTransaction,
  SwapTransactionParam,
} from "..";
import { defaultSlippagePercentage } from "../constants/defaults";
import { OrcaDAL } from "../dal/orca-dal";
import { OrcaPosition } from "../position/orca-position";
import {
  getAddLiquidityQuoteWhenPositionIsAboveRange,
  getAddLiquidityQuoteWhenPositionIsBelowRange,
  getAddLiquidityQuoteWhenPositionIsInRange,
  InternalAddLiquidityQuoteParam,
} from "../position/quotes/add-liquidity";
import { DecimalUtil } from "../utils/decimal-utils";
import { TransactionExecutable } from "../utils/public/transaction-executable";
import { resolveOrCreateAssociatedTokenAddress } from "../utils/web3/ata-utils";
import { PoolUtil } from "../utils/whirlpool/pool-util";
import { PositionStatus, PositionUtil } from "../utils/whirlpool/position-util";
import { TickArrayOutOfBoundsError, TickUtil } from "../utils/whirlpool/tick-util";
import { AmountSpecified, SwapDirection, SwapSimulator } from "./quotes/swap-quoter";

export class OrcaWhirlpool {
  constructor(private readonly dal: OrcaDAL) {}

  /*** Transactions (public) ***/

  /** 1. Open position tx **/
  public async getOpenPositionTransaction(
    param: OpenPositionTransactionParam
  ): Promise<OpenPositionTransaction> {
    // TODO(atamari): Might have to split the transaction into 2 (if needed after testing)
    const {
      provider,
      whirlpool: address,
      quote: { maxTokenA, maxTokenB, liquidity, tickLowerIndex, tickUpperIndex },
    } = param;
    const { connection, commitment, programId } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.getWhirlpool(address, true);

    const txBuilder = new TransactionBuilder(ctx.provider);

    const positionMintKeypair = Keypair.generate();
    const positionPda = getPositionPda(programId, positionMintKeypair.publicKey);
    const positionTokenAccountKeypair = Keypair.generate();

    txBuilder.addInstruction(
      client
        .openPositionTx({
          ownerKey: provider.wallet.publicKey,
          positionPda,
          positionMintKeypair,
          positionTokenAccountKeypair,
          whirlpoolKey: address,
          tickLowerIndex,
          tickUpperIndex,
        })
        .compressIx(false)
    );

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } =
      await resolveOrCreateAssociatedTokenAddress(
        connection,
        commitment,
        provider.wallet.publicKey,
        whirlpool.tokenMintA
      );
    txBuilder.addInstruction(tokenOwnerAccountAIx);

    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } =
      await resolveOrCreateAssociatedTokenAddress(
        connection,
        commitment,
        provider.wallet.publicKey,
        whirlpool.tokenMintB
      );
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const tickArrayLowerPda = TickUtil.deriveTickArrayPDA(
      tickLowerIndex,
      whirlpool.tickSpacing,
      address,
      programId
    );
    const tickArrayUpperPda = TickUtil.deriveTickArrayPDA(
      tickUpperIndex,
      whirlpool.tickSpacing,
      address,
      programId
    );

    const [tickArrayLower, tickArrayUpper] = await Promise.all([
      this.dal.getTickArray(tickArrayLowerPda.publicKey, true),
      this.dal.getTickArray(tickArrayUpperPda.publicKey, true),
    ]);

    if (tickArrayLower === null) {
      txBuilder.addInstruction(
        client
          .initTickArrayTx({
            whirlpoolKey: address,
            tickArrayPda: tickArrayLowerPda,
            startTick: TickUtil.getStartTickIndex(tickLowerIndex, whirlpool.tickSpacing),
          })
          .compressIx(false)
      );
    }

    if (
      tickArrayUpper === null &&
      !tickArrayLowerPda.publicKey.equals(tickArrayUpperPda.publicKey)
    ) {
      txBuilder.addInstruction(
        client
          .initTickArrayTx({
            whirlpoolKey: address,
            tickArrayPda: tickArrayUpperPda,
            startTick: TickUtil.getStartTickIndex(tickUpperIndex, whirlpool.tickSpacing),
          })
          .compressIx(false)
      );
    }

    txBuilder.addInstruction(
      client
        .increaseLiquidityTx({
          liquidityAmount: DecimalUtil.fromU64(liquidity),
          tokenMaxA: DecimalUtil.fromU64(maxTokenA),
          tokenMaxB: DecimalUtil.fromU64(maxTokenB),
          whirlpool: address,
          positionAuthority: provider.wallet.publicKey,
          position: address,
          positionTokenAccount: positionTokenAccountKeypair.publicKey,
          tokenOwnerAccountA,
          tokenOwnerAccountB,
          tokenVaultA: whirlpool.tokenVaultA,
          tokenVaultB: whirlpool.tokenVaultB,
          tickArrayLower: tickArrayLowerPda.publicKey,
          tickArrayUpper: tickArrayLowerPda.publicKey,
        })
        .compressIx(false)
    );

    return new TransactionExecutable(provider, [txBuilder]);
  }

  /** 2. Close position tx **/
  public async getClosePositionTransaction(
    param: ClosePositionTransactionParam
  ): Promise<ClosePositionTransaction> {
    // 1. remove all liquidity
    // 2. close position
    const { provider, position: positionAddress, quote } = param;
    const { positionAuthority = provider.wallet.publicKey, receiver = provider.wallet.publicKey } =
      param;
    const { connection, commitment, programId } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const position = await this.getPosition(positionAddress, true);
    const whirlpool = await this.getWhirlpool(position.whirlpool, true);
    const [tickArrayLower, tickArrayUpper] = this.getTickArrayAddresses(
      position.whirlpool,
      whirlpool,
      position.tickLowerIndex,
      position.tickUpperIndex
    );

    const txBuilder = new TransactionBuilder(ctx.provider);

    const positionTokenAccount = await this.dal.getUserTokenAccount(
      provider.wallet.publicKey,
      position.positionMint
    );
    invariant(!!positionTokenAccount, "no position token account");

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } =
      await resolveOrCreateAssociatedTokenAddress(
        connection,
        commitment,
        provider.wallet.publicKey,
        whirlpool.tokenMintA
      );
    txBuilder.addInstruction(tokenOwnerAccountAIx);

    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } =
      await resolveOrCreateAssociatedTokenAddress(
        connection,
        commitment,
        provider.wallet.publicKey,
        whirlpool.tokenMintB
      );
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    txBuilder.addInstruction(
      client
        .decreaseLiquidityTx({
          liquidityAmount: DecimalUtil.fromU64(position.liquidity), // Decrease liquidity to 0
          tokenMaxA: DecimalUtil.fromU64(quote.minTokenA), // TODO update lower level sdk name change to tokenMinA
          tokenMaxB: DecimalUtil.fromU64(quote.minTokenB), // TODO update lower level sdk name change to tokenMinB
          whirlpool: position.whirlpool,
          positionAuthority: provider.wallet.publicKey,
          position: positionAddress,
          positionTokenAccount,
          tokenOwnerAccountA,
          tokenOwnerAccountB,
          tokenVaultA: whirlpool.tokenVaultA,
          tokenVaultB: whirlpool.tokenVaultB,
          tickArrayLower,
          tickArrayUpper,
        })
        .compressIx(false)
    );

    txBuilder.addInstruction(
      client
        .closePositionTx({
          positionAuthority,
          receiver,
          positionTokenAccount,
          position: positionAddress,
          positionMint: position.positionMint,
        })
        .compressIx(false)
    );

    return new TransactionExecutable(provider, [txBuilder]);
  }

  /** 3. Swap tx **/
  public async getSwapTransaction(param: SwapTransactionParam): Promise<SwapTransaction> {
    const {
      provider,
      whirlpool: whirlpoolAddress,
      quote: { sqrtPriceLimitX64, amountIn, amountOut, aToB, fixedOutput },
    } = param;
    const { connection, commitment, programId } = this.dal;
    const ctx = WhirlpoolContext.withProvider(provider, programId);
    const client = new WhirlpoolClient(ctx);

    const whirlpool = await this.getWhirlpool(whirlpoolAddress);
    const txBuilder = new TransactionBuilder(ctx.provider);

    const { address: tokenOwnerAccountA, ...tokenOwnerAccountAIx } =
      await resolveOrCreateAssociatedTokenAddress(
        connection,
        commitment,
        provider.wallet.publicKey,
        whirlpool.tokenMintA
      );
    txBuilder.addInstruction(tokenOwnerAccountAIx);

    const { address: tokenOwnerAccountB, ...tokenOwnerAccountBIx } =
      await resolveOrCreateAssociatedTokenAddress(
        connection,
        commitment,
        provider.wallet.publicKey,
        whirlpool.tokenMintB
      );
    txBuilder.addInstruction(tokenOwnerAccountBIx);

    const nextTickArrayJump = aToB ? -TICK_ARRAY_SIZE : TICK_ARRAY_SIZE;

    const [tickArray0, tickArray1, tickArray2] = this.getTickArrayAddresses(
      whirlpoolAddress,
      whirlpool,
      whirlpool.tickCurrentIndex,
      whirlpool.tickCurrentIndex + nextTickArrayJump,
      whirlpool.tickCurrentIndex + 2 * nextTickArrayJump
    );

    txBuilder.addInstruction(
      client
        .swapTx({
          amount: fixedOutput ? amountOut : amountIn,
          sqrtPriceLimit: fromX64(sqrtPriceLimitX64), // TODO(atamari): Make sure this is not expected to be X64
          amountSpecifiedIsInput: !fixedOutput,
          aToB,
          whirlpool: whirlpoolAddress,
          tokenOwnerAccountA,
          tokenOwnerAccountB,
          tokenVaultA: whirlpool.tokenVaultA,
          tokenVaultB: whirlpool.tokenVaultB,
          tickArray0,
          tickArray1,
          tickArray2,
        })
        .compressIx(false)
    );

    return new TransactionExecutable(provider, [txBuilder]);
  }

  /*** Quotes (public) ***/

  /** 1. Open position quote **/
  public async getOpenPositionQuote(param: OpenPositionQuoteParam): Promise<OpenPositionQuote> {
    const {
      whirlpoolAddress,
      tokenMint,
      tokenAmount,
      priceLower,
      priceUpper,
      slippageTolerence = defaultSlippagePercentage,
      refresh,
    } = param;

    const tickLowerIndex = sqrtPriceX64ToTickIndex(toX64(priceLower.sqrt())).toNumber();
    const tickUpperIndex = sqrtPriceX64ToTickIndex(toX64(priceUpper.sqrt())).toNumber();

    const dummyPosition = {
      whirlpool: whirlpoolAddress,
      positionMint: Keypair.generate().publicKey,
      liquidity: new u64(0),
      tickLowerIndex,
      tickUpperIndex,
      // TODO(atamari): Make sure these values make sense (or we just treat this is a dummy value and ignore)
      feeGrowthCheckpointA: new u64(0),
      feeOwedA: new u64(0),
      feeGrowthCheckpointB: new u64(0),
      feeOwedB: new u64(0),
      rewardInfos: [],
    };

    const whirlpool = await this.getWhirlpool(whirlpoolAddress, refresh);
    const [tokenAMintInfo, tokenBMintInfo] = await this.getTokenMintInfos(whirlpool, refresh);

    const addLiquidityParams: InternalAddLiquidityQuoteParam = {
      whirlpool,
      position: dummyPosition,
      tokenAMintInfo,
      tokenBMintInfo,
      tokenMint,
      tokenAmount,
      slippageTolerence,
    };

    let addLiquidityQuote: AddLiquidityQuote;

    switch (PositionUtil.getPositionStatus(whirlpool, dummyPosition)) {
      case PositionStatus.BelowRange:
        addLiquidityQuote = getAddLiquidityQuoteWhenPositionIsBelowRange(addLiquidityParams);
        break;
      case PositionStatus.InRange:
        addLiquidityQuote = getAddLiquidityQuoteWhenPositionIsInRange(addLiquidityParams);
        break;
      case PositionStatus.AboveRange:
        addLiquidityQuote = getAddLiquidityQuoteWhenPositionIsAboveRange(addLiquidityParams);
        break;
    }

    return {
      ...addLiquidityQuote,
      tickLowerIndex,
      tickUpperIndex,
    };
  }

  /** 2. Close position quote **/
  public async getClosePositionQuote(param: ClosePositionQuoteParam): Promise<ClosePositionQuote> {
    const {
      position: positionAddress,
      refresh,
      slippageTolerence = defaultSlippagePercentage,
    } = param;
    const position = await this.getPosition(positionAddress, refresh);

    // Get remove liquidity quote for all of this position's liquidity
    const { minTokenA, minTokenB } = await new OrcaPosition(this.dal).getRemoveLiquidityQuote({
      address: positionAddress,
      liquidity: position.liquidity,
      refresh,
      slippageTolerence,
    });

    return {
      minTokenA,
      minTokenB,
    };
  }

  /** 3. Swap quote **/
  public async getSwapQuote(param: SwapQuoteParam): Promise<SwapQuote> {
    const {
      whirlpool: whirlpoolAddress,
      tokenMint,
      tokenAmount,
      isOutput = false,
      slippageTolerance = defaultSlippagePercentage,
      refresh,
    } = param;

    const whirlpool = await this.getWhirlpool(whirlpoolAddress, refresh);

    const fetchTickArray = async (tickIndex: Decimal) => {
      const tickArray = await this.dal.getTickArray(
        TickUtil.getAddressContainingTickIndex(
          tickIndex.toNumber(),
          whirlpool.tickSpacing,
          whirlpoolAddress,
          this.dal.programId
        )
      );
      invariant(!!tickArray, "tickArray is null");
      return tickArray;
    };

    const fetchTick = async (tickIndex: Decimal) => {
      const tickArray = await fetchTickArray(tickIndex);
      return TickUtil.getTick(tickArray, tickIndex.toNumber(), whirlpool.tickSpacing);
    };

    const swapDirection =
      tokenMint === whirlpool.tokenMintA && isOutput ? SwapDirection.BtoA : SwapDirection.AtoB;
    const swapSimulator = new SwapSimulator({
      swapDirection,
      amountSpecified: isOutput ? AmountSpecified.Output : AmountSpecified.Input,
      feeRate: PoolUtil.getFeeRate(whirlpool),
      protocolFeeRate: PoolUtil.getProtocolFeeRate(whirlpool),
      slippageTolerance,
      fetchTickArray,
      fetchTick,
      getPrevInitializedTickIndex: async () => {
        let currentTickIndex = whirlpool.tickCurrentIndex;
        let prevInitializedTickIndex: number | undefined = undefined;

        while (!prevInitializedTickIndex) {
          const currentTickArray = await fetchTickArray(new Decimal(currentTickIndex));

          try {
            prevInitializedTickIndex = TickUtil.getPrevInitializedTickIndex(
              currentTickArray,
              currentTickIndex,
              whirlpool.tickSpacing
            );
          } catch (err) {
            if (err instanceof TickArrayOutOfBoundsError) {
              currentTickIndex = currentTickArray.startTickIndex - 1;
            } else {
              throw err;
            }
          }
        }

        return new Decimal(prevInitializedTickIndex);
      },
      getNextInitializedTickIndex: async () => {
        let currentTickIndex = whirlpool.tickCurrentIndex;
        let prevInitializedTickIndex: number | undefined = undefined;

        while (!prevInitializedTickIndex) {
          const currentTickArray = await fetchTickArray(new Decimal(currentTickIndex));

          try {
            prevInitializedTickIndex = TickUtil.getNextInitializedTickIndex(
              currentTickArray,
              currentTickIndex,
              whirlpool.tickSpacing
            );
          } catch (err) {
            if (err instanceof TickArrayOutOfBoundsError) {
              currentTickIndex = currentTickArray.startTickIndex + TICK_ARRAY_SIZE;
            } else {
              throw err;
            }
          }
        }

        return new Decimal(prevInitializedTickIndex);
      },
    });

    const { sqrtPriceLimitX64, amountIn, amountOut } = await swapSimulator.simulateSwap({
      amount: DecimalUtil.fromU64(tokenAmount),
      currentSqrtPriceX64: new Decimal(whirlpool.sqrtPrice.toString()),
      currentTickIndex: new Decimal(whirlpool.tickCurrentIndex),
      currentTickArray: await fetchTickArray(new Decimal(whirlpool.tickCurrentIndex)),
      currentLiquidity: DecimalUtil.fromU64(whirlpool.liquidity),
    });

    return {
      sqrtPriceLimitX64,
      amountIn,
      amountOut,
      aToB: swapDirection === SwapDirection.AtoB,
      fixedOutput: isOutput,
    };
  }

  /*** Helpers (private) ***/
  private async getWhirlpool(address: PublicKey, refresh = false): Promise<WhirlpoolData> {
    const whirlpool = await this.dal.getPool(address, refresh);
    invariant(!!whirlpool, "OrcaWhirlpool - whirlpool does not exist");
    return whirlpool;
  }

  private async getPosition(address: PublicKey, refresh = false): Promise<PositionData> {
    const position = await this.dal.getPosition(address, refresh);
    invariant(!!position, "OrcaWhirlpool - position does not exist");
    return position;
  }

  private async getTokenMintInfos(
    whirlpool: WhirlpoolData,
    refresh = false
  ): Promise<[MintInfo, MintInfo]> {
    const mintInfos = await this.dal.listMintInfos(
      [whirlpool.tokenMintA, whirlpool.tokenMintB],
      refresh
    );
    invariant(!!mintInfos && mintInfos.length === 2, "OrcaWhirlpool - mint infos do not exist");
    return [mintInfos[0], mintInfos[1]];
  }

  private getTickArrayAddresses(
    whirlpool: PublicKey,
    whirlpoolData: WhirlpoolData,
    ...tickIndexes: number[]
  ): PublicKey[] {
    return tickIndexes.map((tickIndex) =>
      TickUtil.getAddressContainingTickIndex(
        tickIndex,
        whirlpoolData.tickSpacing,
        whirlpool,
        this.dal.programId
      )
    );
  }
}
