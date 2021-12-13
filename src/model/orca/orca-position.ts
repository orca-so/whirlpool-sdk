import { PublicKey } from "@solana/web3.js";
import {
  AddLiquidityQuote,
  CollectFeesQuote,
  CollectRewardsQuote,
  OrcaPosition,
  OrcaPositionArgs,
  PositionStatus,
  RemoveLiquidityQuote,
  Percentage,
  q64,
  TransactionPayload,
} from "../../public";
import { Token, TokenAmount } from "../utils";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import { defaultSlippagePercentage, NUM_REWARDS } from "../../constants";
import { Owner } from "../../public/utils/web3/key-utils";
import {
  PositionAccount,
  PositionEntity,
  Tick,
  TickArrayEntity,
  WhirlpoolAccount,
  WhirlpoolEntity,
} from "../entities";
import { TickMath } from "../utils";
import { OrcaCache } from "../cache";

export class OrcaPositionImpl<A extends Token, B extends Token> implements OrcaPosition<A, B> {
  private readonly cache: OrcaCache;
  private readonly tokenA: A;
  private readonly tokenB: B;
  private readonly whirlpoolAddress: PublicKey;
  private readonly positionAddress: PublicKey;

  constructor(cache: OrcaCache, { tokenA, tokenB, positionMint }: OrcaPositionArgs<A, B>) {
    invariant(!tokenA.equals(tokenB), "tokens must be different");

    [this.tokenA, this.tokenB] = Token.sort(tokenA, tokenB);
    this.cache = cache;

    this.whirlpoolAddress = WhirlpoolEntity.deriveAddress(
      this.cache.whirlpoolsConfig,
      this.tokenA.mint,
      this.tokenB.mint,
      this.cache.programId
    );

    this.positionAddress = PositionEntity.deriveAddress(
      this.whirlpoolAddress,
      positionMint,
      this.cache.programId
    );
  }

  public async getAddLiquidityQuote(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence = defaultSlippagePercentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { whirlpool, position } = await this.getWhirlpoolAndPosition();
    const positionStatus = WhirlpoolEntity.getPositionStatus(whirlpool, position);

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        return this.getAddLiquidityQuoteWhenPositionIsBelowRange(tokenAmount, slippageTolerence);
      case PositionStatus.InRange:
        return this.getAddLiquidityQuoteWhenPositionIsInRange(tokenAmount, slippageTolerence);
      case PositionStatus.AboveRange:
        return this.getAddLiquidityQuoteWhenPositionIsAboveRange(tokenAmount, slippageTolerence);
      default:
        throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
    }
  }

  public async getAddLiquidityTransaction(
    owner: Owner,
    quote: AddLiquidityQuote<A, B>
  ): Promise<TransactionPayload> {
    throw new Error("Method not implemented.");
  }

  public async getRemoveLiquidityQuote(
    liquidity: u64,
    slippageTolerence = defaultSlippagePercentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    const { whirlpool, position } = await this.getWhirlpoolAndPosition();
    const positionStatus = WhirlpoolEntity.getPositionStatus(whirlpool, position);

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        return this.getRemoveLiquidityQuoteWhenPositionIsBelowRange(liquidity, slippageTolerence);
      case PositionStatus.InRange:
        return this.getRemoveLiquidityQuoteWhenPositionIsInRange(liquidity, slippageTolerence);
      case PositionStatus.AboveRange:
        return this.getRemoveLiquidityQuoteWhenPositionIsAboveRange(liquidity, slippageTolerence);
      default:
        throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
    }
  }

  public async getRemoveLiquidityTransaction(
    owner: Owner,
    quote: RemoveLiquidityQuote<A, B>
  ): Promise<TransactionPayload> {
    throw new Error("Method not implemented.");
  }

  public async getCollectFeesQuote(): Promise<CollectFeesQuote<A, B>> {
    const { position, whirlpool } = await this.getWhirlpoolAndPosition();

    const { tickCurrentIndex, feeGrowthGlobalA, feeGrowthGlobalB } = whirlpool;
    const {
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
      liquidity,
      feeOwedA,
      feeOwedB,
      feeGrowthCheckpointA,
      feeGrowthCheckpointB,
    } = position;

    const { tickLower, tickUpper } = await this.getTicksLowerAndUpper(
      tickLowerIndex,
      tickUpperIndex
    );

    // Calculate the fee growths inside the position

    let feeGrowthBelowA: q64 | null = null;
    let feeGrowthBelowB: q64 | null = null;

    if (tickCurrentIndex < tickLowerIndex) {
      feeGrowthBelowA = feeGrowthGlobalA.sub(tickLower.feeGrowthOutsideA);
      feeGrowthBelowB = feeGrowthGlobalB.sub(tickLower.feeGrowthOutsideB);
    } else {
      feeGrowthBelowA = tickLower.feeGrowthOutsideA;
      feeGrowthBelowB = tickLower.feeGrowthOutsideB;
    }

    let feeGrowthAboveA: q64 | null = null;
    let feeGrowthAboveB: q64 | null = null;

    if (tickCurrentIndex < tickUpperIndex) {
      feeGrowthAboveA = tickUpper.feeGrowthOutsideA;
      feeGrowthAboveB = tickUpper.feeGrowthOutsideB;
    } else {
      feeGrowthAboveA = feeGrowthGlobalA.sub(tickUpper.feeGrowthOutsideA);
      feeGrowthAboveB = feeGrowthGlobalB.sub(tickUpper.feeGrowthOutsideB);
    }

    const feeGrowthInsideA: q64 = feeGrowthGlobalA.sub(feeGrowthBelowA).sub(feeGrowthAboveA);
    const feeGrowthInsideB: q64 = feeGrowthGlobalB.sub(feeGrowthBelowB).sub(feeGrowthAboveB);

    // Calculate the updated fees owed

    const liquidityX64: q64 = new q64(liquidity);
    const feeOwedADeltaX64: q64 = liquidityX64.mul(feeGrowthInsideA.sub(feeGrowthCheckpointA));
    const feeOwedBDeltaX64: q64 = liquidityX64.mul(feeGrowthInsideB.sub(feeGrowthCheckpointB));

    const updatedFeeOwedA: u64 = feeOwedA.add(q64.toU64(feeOwedADeltaX64));
    const updatedFeeOwedB: u64 = feeOwedB.add(q64.toU64(feeOwedBDeltaX64));

    return {
      feeOwedA: TokenAmount.from(this.tokenA, updatedFeeOwedA),
      feeOwedB: TokenAmount.from(this.tokenB, updatedFeeOwedB),
    };
  }

  public async getCollectRewardsQuote(): Promise<CollectRewardsQuote<A, B>> {
    const { position, whirlpool } = await this.getWhirlpoolAndPosition();

    const { tickCurrentIndex, rewardInfos: whirlpoolRewardsInfos } = whirlpool;
    const {
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
      liquidity,
      rewardInfos,
    } = position;

    const { tickLower, tickUpper } = await this.getTicksLowerAndUpper(
      tickLowerIndex,
      tickUpperIndex
    );

    // Calculate the reward growths inside the position

    const range = [...Array(NUM_REWARDS).keys()];
    const rewardGrowthsBelow: [q64, q64, q64] = [new q64(0), new q64(0), new q64(0)];
    const rewardGrowthsAbove: [q64, q64, q64] = [new q64(0), new q64(0), new q64(0)];

    for (const i of range) {
      if (tickCurrentIndex < tickLowerIndex) {
        rewardGrowthsBelow[i] = whirlpoolRewardsInfos[i].growthGlobalX64.sub(
          tickLower.rewardGrowthsOutside[i]
        );
      } else {
        rewardGrowthsBelow[i] = tickLower.rewardGrowthsOutside[i];
      }

      if (tickCurrentIndex < tickUpperIndex) {
        rewardGrowthsAbove[i] = tickUpper.rewardGrowthsOutside[i];
      } else {
        rewardGrowthsAbove[i] = whirlpoolRewardsInfos[i].growthGlobalX64.sub(
          tickUpper.rewardGrowthsOutside[i]
        );
      }
    }

    const rewardGrowthsInside: [[q64, boolean], [q64, boolean], [q64, boolean]] = [
      [new q64(0), false],
      [new q64(0), false],
      [new q64(0), false],
    ];
    for (const i of range) {
      if (WhirlpoolEntity.isRewardInitialized(whirlpoolRewardsInfos[i])) {
        rewardGrowthsInside[i] = whirlpoolRewardsInfos[i].growthGlobalX64
          .sub(rewardGrowthsBelow[i])
          .sub(rewardGrowthsAbove[i]);
      }
    }

    // Calculate the updated rewards owed

    const liquidityX64: q64 = new q64(liquidity);
    const updatedRewardInfos: [q64, q64, q64] = [new q64(0), new q64(0), new q64(0)];

    for (const i of range) {
      if (rewardGrowthsInside[i][1]) {
        updatedRewardInfos[i] = rewardInfos[i].amountOwed.add(
          liquidityX64.mul(rewardGrowthsInside[i][0].sub(rewardInfos[i].growthInsideCheckpoint))
        );
      }
    }

    throw new Error("Method not implemented.");
  }

  public async getCollectFeesAndRewardsTransaction(owner: Owner): Promise<TransactionPayload> {
    throw new Error("Method not implemented.");
  }

  private async getAddLiquidityQuoteWhenPositionIsBelowRange(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { position } = await this.getWhirlpoolAndPosition();

    if (!this.isTokenAAmount(tokenAmount)) {
      // Cannot deposit Token B into position when price is below position's range
      return {
        maxTokenA: TokenAmount.zero(this.tokenA),
        maxTokenB: TokenAmount.zero(this.tokenB),
        liquidity: new u64(0),
      };
    }

    // TODO: Use slippage tolerance here

    const tokenAAmountX64 = q64.fromU64(tokenAmount.toU64());
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);
    // Equation (5) from math paper
    const liquidityX64 = tokenAAmountX64
      .mul(sqrtPriceLowerX64.mul(sqrtPriceUpperX64))
      .div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

    return {
      maxTokenA: tokenAmount,
      maxTokenB: TokenAmount.zero(this.tokenB),
      liquidity: q64.toU64(liquidityX64),
    };
  }

  private async getAddLiquidityQuoteWhenPositionIsInRange(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { whirlpool, position } = await this.getWhirlpoolAndPosition();

    // TODO: Use slippage tolerance here

    const tokenAmountX64 = q64.fromU64(tokenAmount.toU64());

    const sqrtPriceX64 = whirlpool.sqrtPrice;
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    let [tokenAAmountX64, tokenBAmountX64] = this.isTokenAAmount(tokenAmount)
      ? [tokenAmountX64, undefined]
      : [undefined, tokenAmountX64];

    let liquidityX64: q64 | undefined = undefined;

    if (tokenAAmountX64) {
      // Derived from equation (11) from math paper
      liquidityX64 = tokenAAmountX64
        .mul(sqrtPriceX64.mul(sqrtPriceUpperX64))
        .div(sqrtPriceUpperX64.sub(sqrtPriceX64));

      // Equation (12) from math paper
      tokenBAmountX64 = liquidityX64.mul(sqrtPriceX64.sub(sqrtPriceLowerX64));
    } else if (tokenBAmountX64) {
      // Derived from equation (12) from math paper
      liquidityX64 = tokenBAmountX64.div(sqrtPriceX64.sub(sqrtPriceLowerX64));

      // Equation (11) from math paper
      tokenAAmountX64 = liquidityX64
        .mul(sqrtPriceUpperX64.sub(sqrtPriceX64))
        .div(sqrtPriceX64.mul(sqrtPriceUpperX64));
    }

    invariant(tokenAAmountX64 !== undefined, "Token A amount is undefined");
    invariant(tokenBAmountX64 !== undefined, "Token B amount is undefined");
    invariant(liquidityX64 !== undefined, "Liquidity is undefined");

    return {
      maxTokenA: TokenAmount.from(this.tokenA, q64.toU64(tokenAAmountX64)),
      maxTokenB: TokenAmount.from(this.tokenB, q64.toU64(tokenBAmountX64)),
      liquidity: q64.toU64(liquidityX64),
    };
  }

  private async getAddLiquidityQuoteWhenPositionIsAboveRange(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { position } = await this.getWhirlpoolAndPosition();

    if (!this.isTokenBAmount(tokenAmount)) {
      // Cannot deposit Token A into position when price is above position's range
      return {
        maxTokenA: TokenAmount.zero(this.tokenA),
        maxTokenB: TokenAmount.zero(this.tokenB),
        liquidity: new u64(0),
      };
    }

    // TODO: Use slippage tolerance here

    const tokenBAmountX64 = q64.fromU64(tokenAmount.toU64());
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);
    // Equation (9) from math paper
    const liquidityX64 = tokenBAmountX64.div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

    return {
      maxTokenA: TokenAmount.zero(this.tokenA),
      maxTokenB: tokenAmount,
      liquidity: q64.toU64(liquidityX64),
    };
  }

  private async getRemoveLiquidityQuoteWhenPositionIsBelowRange(
    liquidity: u64,
    slippageTolerence: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    // TODO: Use slippage tolerance here

    const { position } = await this.getWhirlpoolAndPosition();
    const liquidityX64 = q64.fromU64(liquidity);
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenAAmountX64 = liquidityX64
      .mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64))
      .div(sqrtPriceLowerX64.mul(sqrtPriceUpperX64));

    return {
      minTokenA: TokenAmount.from(this.tokenA, q64.toU64(tokenAAmountX64)),
      minTokenB: TokenAmount.zero(this.tokenB),
      liquidity,
    };
  }

  private async getRemoveLiquidityQuoteWhenPositionIsInRange(
    liquidity: u64,
    slippageTolerence: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    // TODO: Use slippage tolerance here

    const { whirlpool, position } = await this.getWhirlpoolAndPosition();
    const liquidityX64 = q64.fromU64(liquidity);
    const sqrtPriceX64 = whirlpool.sqrtPrice;
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenAAmountX64 = liquidityX64
      .mul(sqrtPriceUpperX64.sub(sqrtPriceX64))
      .div(sqrtPriceX64.mul(sqrtPriceUpperX64));
    const tokenBAmountX64 = liquidityX64.mul(sqrtPriceX64.sub(sqrtPriceLowerX64));

    return {
      minTokenA: TokenAmount.from(this.tokenA, q64.toU64(tokenAAmountX64)),
      minTokenB: TokenAmount.from(this.tokenB, q64.toU64(tokenBAmountX64)),
      liquidity,
    };
  }

  private async getRemoveLiquidityQuoteWhenPositionIsAboveRange(
    liquidity: u64,
    slippageTolerence: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    // TODO: Use slippage tolerance here

    const { position } = await this.getWhirlpoolAndPosition();
    const liquidityX64 = q64.fromU64(liquidity);
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenBAmountX64 = liquidityX64.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

    return {
      minTokenA: TokenAmount.zero(this.tokenA),
      minTokenB: TokenAmount.from(this.tokenB, q64.toU64(tokenBAmountX64)),
      liquidity,
    };
  }

  private async getWhirlpoolAndPosition(): Promise<{
    whirlpool: WhirlpoolAccount;
    position: PositionAccount;
  }> {
    const [whirlpool, position] = await Promise.all([
      this.cache.getWhirlpool(this.whirlpoolAddress),
      this.cache.getPosition(this.positionAddress),
    ]);

    invariant(!!whirlpool, "OrcaPosition - whirlpool does not exist");
    invariant(!!position, "OrcaPosition - position does not exist");

    return {
      whirlpool,
      position,
    };
  }

  private async getTicksLowerAndUpper(
    tickLowerIndex: number,
    tickUpperIndex: number
  ): Promise<{
    tickLower: Tick;
    tickUpper: Tick;
  }> {
    const tickLowerAddress = TickArrayEntity.getAddressContainingTickIndex(tickLowerIndex);
    const tickUpperAddress = TickArrayEntity.getAddressContainingTickIndex(tickUpperIndex);

    const [tickArrayLower, tickArrayUpper] = await Promise.all([
      await this.cache.getTickArray(tickLowerAddress),
      await this.cache.getTickArray(tickUpperAddress),
    ]);

    invariant(!!tickArrayLower, "OrcaPosition - tickArrayLower does not exist");
    invariant(!!tickArrayUpper, "OrcaPosition - tickArrayUpper does not exist");

    return {
      tickLower: TickArrayEntity.getTick(tickArrayLower, tickLowerIndex),
      tickUpper: TickArrayEntity.getTick(tickArrayUpper, tickUpperIndex),
    };
  }

  private isTokenAAmount(tokenAmount: TokenAmount<A | B>): tokenAmount is TokenAmount<A> {
    return tokenAmount.token.equals(this.tokenA);
  }

  private isTokenBAmount(tokenAmount: TokenAmount<A | B>): tokenAmount is TokenAmount<B> {
    return tokenAmount.token.equals(this.tokenB);
  }
}
