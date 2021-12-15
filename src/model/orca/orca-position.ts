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
  TransactionPayload,
  Owner,
} from "../../public";
import { Token, TokenAmount, TickMath, BNUtils } from "../utils";
import invariant from "tiny-invariant";
import { defaultSlippagePercentage, NUM_REWARDS } from "../../constants";
import {
  PositionAccount,
  Position,
  Tick,
  TickArray,
  WhirlpoolAccount,
  Whirlpool,
} from "../entities";
import { OrcaCache } from "../cache";
import { u64 } from "@solana/spl-token";
import BN from "bn.js";

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

    this.whirlpoolAddress = Whirlpool.deriveAddress(
      this.cache.whirlpoolsConfig,
      this.tokenA.mint,
      this.tokenB.mint,
      this.cache.programId
    );

    this.positionAddress = Position.deriveAddress(
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
    const positionStatus = Position.getPositionStatus(whirlpool, position);

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
    const positionStatus = Position.getPositionStatus(whirlpool, position);

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

    const { tickCurrentIndex, feeGrowthGlobalA_Q64x64, feeGrowthGlobalB_Q64x64 } = whirlpool;
    const {
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
      liquidity_U64: liquidity,
      feeOwedA_U64,
      feeOwedB_U64,
      feeGrowthCheckpointA_Q64x64,
      feeGrowthCheckpointB_Q64x64,
    } = position;

    const { tickLower, tickUpper } = await this.getTicksLowerAndUpper(
      tickLowerIndex,
      tickUpperIndex
    );

    // Calculate the fee growths inside the position

    let feeGrowthBelowA_Q64x64: BN | null = null;
    let feeGrowthBelowB_Q64x64: BN | null = null;

    if (tickCurrentIndex < tickLowerIndex) {
      feeGrowthBelowA_Q64x64 = feeGrowthGlobalA_Q64x64.sub(tickLower.feeGrowthOutsideA_Q64x64);
      feeGrowthBelowB_Q64x64 = feeGrowthGlobalB_Q64x64.sub(tickLower.feeGrowthOutsideB_Q64x64);
    } else {
      feeGrowthBelowA_Q64x64 = tickLower.feeGrowthOutsideA_Q64x64;
      feeGrowthBelowB_Q64x64 = tickLower.feeGrowthOutsideB_Q64x64;
    }

    let feeGrowthAboveA_Q64x64: BN | null = null;
    let feeGrowthAboveB_Q64x64: BN | null = null;

    if (tickCurrentIndex < tickUpperIndex) {
      feeGrowthAboveA_Q64x64 = tickUpper.feeGrowthOutsideA_Q64x64;
      feeGrowthAboveB_Q64x64 = tickUpper.feeGrowthOutsideB_Q64x64;
    } else {
      feeGrowthAboveA_Q64x64 = feeGrowthGlobalA_Q64x64.sub(tickUpper.feeGrowthOutsideA_Q64x64);
      feeGrowthAboveB_Q64x64 = feeGrowthGlobalB_Q64x64.sub(tickUpper.feeGrowthOutsideB_Q64x64);
    }

    const feeGrowthInsideA_Q64x64 = feeGrowthGlobalA_Q64x64
      .sub(feeGrowthBelowA_Q64x64)
      .sub(feeGrowthAboveA_Q64x64);
    const feeGrowthInsideB_Q64x64 = feeGrowthGlobalB_Q64x64
      .sub(feeGrowthBelowB_Q64x64)
      .sub(feeGrowthAboveB_Q64x64);

    // Calculate the updated fees owed

    const liquidity_Q64x64 = BNUtils.u64ToQ64x64(liquidity);
    const feeOwedADelta_Q64x64 = liquidity_Q64x64.mul(
      feeGrowthInsideA_Q64x64.sub(feeGrowthCheckpointA_Q64x64)
    );
    const feeOwedBDelta_Q64x64 = liquidity_Q64x64.mul(
      feeGrowthInsideB_Q64x64.sub(feeGrowthCheckpointB_Q64x64)
    );

    // TODO should this be floor or ceil?
    const updatedFeeOwedA_U64 = feeOwedA_U64.add(BNUtils.ceilQ64x64(feeOwedADelta_Q64x64));
    const updatedFeeOwedB_U64 = feeOwedB_U64.add(BNUtils.ceilQ64x64(feeOwedBDelta_Q64x64));

    return {
      feeOwedA: TokenAmount.from(this.tokenA, updatedFeeOwedA_U64),
      feeOwedB: TokenAmount.from(this.tokenB, updatedFeeOwedB_U64),
    };
  }

  public async getCollectRewardsQuote(): Promise<CollectRewardsQuote<A, B>> {
    const { position, whirlpool } = await this.getWhirlpoolAndPosition();

    const { tickCurrentIndex, rewardInfos: whirlpoolRewardsInfos } = whirlpool;
    const {
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
      liquidity_U64,
      rewardInfos,
    } = position;

    const { tickLower, tickUpper } = await this.getTicksLowerAndUpper(
      tickLowerIndex,
      tickUpperIndex
    );

    // Calculate the reward growths inside the position

    const range = [...Array(NUM_REWARDS).keys()];
    const rewardGrowthsBelow_Q64x64: [BN, BN, BN] = [new BN(0), new BN(0), new BN(0)];
    const rewardGrowthsAbove_Q64x64: [BN, BN, BN] = [new BN(0), new BN(0), new BN(0)];

    for (const i of range) {
      if (tickCurrentIndex < tickLowerIndex) {
        rewardGrowthsBelow_Q64x64[i] = whirlpoolRewardsInfos[i].growthGlobal_Q64x64.sub(
          tickLower.rewardGrowthsOutside_Q64x64[i]
        );
      } else {
        rewardGrowthsBelow_Q64x64[i] = tickLower.rewardGrowthsOutside_Q64x64[i];
      }

      if (tickCurrentIndex < tickUpperIndex) {
        rewardGrowthsAbove_Q64x64[i] = tickUpper.rewardGrowthsOutside_Q64x64[i];
      } else {
        rewardGrowthsAbove_Q64x64[i] = whirlpoolRewardsInfos[i].growthGlobal_Q64x64.sub(
          tickUpper.rewardGrowthsOutside_Q64x64[i]
        );
      }
    }

    const rewardGrowthsInside_Q64x64: [[BN, boolean], [BN, boolean], [BN, boolean]] = [
      [new BN(0), false],
      [new BN(0), false],
      [new BN(0), false],
    ];
    for (const i of range) {
      if (Whirlpool.isRewardInitialized(whirlpoolRewardsInfos[i])) {
        rewardGrowthsInside_Q64x64[i] = [
          whirlpoolRewardsInfos[i].growthGlobal_Q64x64
            .sub(rewardGrowthsBelow_Q64x64[i])
            .sub(rewardGrowthsAbove_Q64x64[i]),
          true,
        ];
      }
    }

    // Calculate the updated rewards owed

    const liquidity_Q64x64 = BNUtils.u64ToQ64x64(liquidity_U64);
    const updatedRewardInfos_Q64x64: [BN, BN, BN] = [new BN(0), new BN(0), new BN(0)];

    for (const i of range) {
      if (rewardGrowthsInside_Q64x64[i][1]) {
        updatedRewardInfos_Q64x64[i] = rewardInfos[i].amountOwed_U64.add(
          liquidity_Q64x64.mul(
            rewardGrowthsInside_Q64x64[i][0].sub(rewardInfos[i].growthInsideCheckpoint_Q64x64)
          )
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

    const tokenAAmount_Q64x64 = BNUtils.u64ToQ64x64(tokenAmount.to_U64());
    const sqrtPriceLower_Q64x64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpper_Q64x64 = TickMath.sqrtPriceAtTick(position.tickUpper);
    // Equation (5) from math paper
    const liquidity_Q64x64 = tokenAAmount_Q64x64
      .mul(sqrtPriceLower_Q64x64.mul(sqrtPriceUpper_Q64x64))
      .div(sqrtPriceUpper_Q64x64.sub(sqrtPriceLower_Q64x64));

    return {
      maxTokenA: tokenAmount,
      maxTokenB: TokenAmount.zero(this.tokenB),
      liquidity: BNUtils.ceilQ64x64(liquidity_Q64x64),
    };
  }

  private async getAddLiquidityQuoteWhenPositionIsInRange(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { whirlpool, position } = await this.getWhirlpoolAndPosition();

    // TODO: Use slippage tolerance here

    const tokenAmount_Q64x64 = BNUtils.u64ToQ64x64(tokenAmount.to_U64());

    const sqrtPrice_Q64x64 = whirlpool.sqrtPrice_Q64x64;
    const sqrtPriceLower_Q64x64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpper_Q64x64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    let [tokenAAmount_Q64x64, tokenBAmount_Q64x64] = this.isTokenAAmount(tokenAmount)
      ? [tokenAmount_Q64x64, undefined]
      : [undefined, tokenAmount_Q64x64];

    let liquidity_Q64x64: BN | undefined = undefined;

    if (tokenAAmount_Q64x64) {
      // Derived from equation (11) from math paper
      liquidity_Q64x64 = tokenAAmount_Q64x64
        .mul(sqrtPrice_Q64x64.mul(sqrtPriceUpper_Q64x64))
        .div(sqrtPriceUpper_Q64x64.sub(sqrtPrice_Q64x64));

      // Equation (12) from math paper
      tokenBAmount_Q64x64 = liquidity_Q64x64.mul(sqrtPrice_Q64x64.sub(sqrtPriceLower_Q64x64));
    } else if (tokenBAmount_Q64x64) {
      // Derived from equation (12) from math paper
      liquidity_Q64x64 = tokenBAmount_Q64x64.div(sqrtPrice_Q64x64.sub(sqrtPriceLower_Q64x64));

      // Equation (11) from math paper
      tokenAAmount_Q64x64 = liquidity_Q64x64
        .mul(sqrtPriceUpper_Q64x64.sub(sqrtPrice_Q64x64))
        .div(sqrtPrice_Q64x64.mul(sqrtPriceUpper_Q64x64));
    }

    invariant(tokenAAmount_Q64x64 !== undefined, "Token A amount is undefined");
    invariant(tokenBAmount_Q64x64 !== undefined, "Token B amount is undefined");
    invariant(liquidity_Q64x64 !== undefined, "Liquidity is undefined");

    return {
      maxTokenA: TokenAmount.from(this.tokenA, BNUtils.ceilQ64x64(tokenAAmount_Q64x64)),
      maxTokenB: TokenAmount.from(this.tokenB, BNUtils.ceilQ64x64(tokenBAmount_Q64x64)),
      liquidity: BNUtils.ceilQ64x64(liquidity_Q64x64),
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

    const tokenBAmount_Q64x64 = BNUtils.u64ToQ64x64(tokenAmount.to_U64());
    const sqrtPriceLower_Q64x64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpper_Q64x64 = TickMath.sqrtPriceAtTick(position.tickUpper);
    // Equation (9) from math paper
    const liquidity_Q64x64 = tokenBAmount_Q64x64.div(
      sqrtPriceUpper_Q64x64.sub(sqrtPriceLower_Q64x64)
    );

    return {
      maxTokenA: TokenAmount.zero(this.tokenA),
      maxTokenB: tokenAmount,
      liquidity: BNUtils.ceilQ64x64(liquidity_Q64x64),
    };
  }

  private async getRemoveLiquidityQuoteWhenPositionIsBelowRange(
    liquidity: u64,
    slippageTolerence: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    // TODO: Use slippage tolerance here

    const { position } = await this.getWhirlpoolAndPosition();
    const liquidity_Q64x64 = BNUtils.u64ToQ64x64(liquidity);
    const sqrtPriceLower_Q64x64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpper_Q64x64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenAAmount_Q64x64 = liquidity_Q64x64
      .mul(sqrtPriceUpper_Q64x64.sub(sqrtPriceLower_Q64x64))
      .div(sqrtPriceLower_Q64x64.mul(sqrtPriceUpper_Q64x64));

    return {
      minTokenA: TokenAmount.from(this.tokenA, BNUtils.ceilQ64x64(tokenAAmount_Q64x64)),
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
    const liquidity_Q64x64 = BNUtils.u64ToQ64x64(liquidity);
    const sqrtPrice_Q64x64 = whirlpool.sqrtPrice_Q64x64;
    const sqrtPriceLower_Q64x64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpper_Q64x64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenAAmount_Q64x64 = liquidity_Q64x64
      .mul(sqrtPriceUpper_Q64x64.sub(sqrtPrice_Q64x64))
      .div(sqrtPrice_Q64x64.mul(sqrtPriceUpper_Q64x64));
    const tokenBAmount_Q64x64 = liquidity_Q64x64.mul(sqrtPrice_Q64x64.sub(sqrtPriceLower_Q64x64));

    return {
      minTokenA: TokenAmount.from(this.tokenA, BNUtils.ceilQ64x64(tokenAAmount_Q64x64)),
      minTokenB: TokenAmount.from(this.tokenB, BNUtils.ceilQ64x64(tokenBAmount_Q64x64)),
      liquidity,
    };
  }

  private async getRemoveLiquidityQuoteWhenPositionIsAboveRange(
    liquidity: u64,
    slippageTolerence: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    // TODO: Use slippage tolerance here

    const { position } = await this.getWhirlpoolAndPosition();
    const liquidity_Q64x64 = BNUtils.u64ToQ64x64(liquidity);
    const sqrtPriceLower_Q64x64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpper_Q64x64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenBAmount_Q64x64 = liquidity_Q64x64.mul(
      sqrtPriceUpper_Q64x64.sub(sqrtPriceLower_Q64x64)
    );

    return {
      minTokenA: TokenAmount.zero(this.tokenA),
      minTokenB: TokenAmount.from(this.tokenB, BNUtils.ceilQ64x64(tokenBAmount_Q64x64)),
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
    if (tickLowerIndex === tickUpperIndex) {
      const tickAddress = TickArray.getAddressContainingTickIndex(tickLowerIndex);
      const tickArray = await this.cache.getTickArray(tickAddress);
      invariant(!!tickArray, "OrcaPostion - tickArray does not exist");
      return {
        tickLower: TickArray.getTick(tickArray, tickLowerIndex),
        tickUpper: TickArray.getTick(tickArray, tickUpperIndex),
      };
    }

    const tickLowerAddress = TickArray.getAddressContainingTickIndex(tickLowerIndex);
    const tickUpperAddress = TickArray.getAddressContainingTickIndex(tickUpperIndex);

    const [tickArrayLower, tickArrayUpper] = await Promise.all([
      await this.cache.getTickArray(tickLowerAddress),
      await this.cache.getTickArray(tickUpperAddress),
    ]);

    invariant(!!tickArrayLower, "OrcaPosition - tickArrayLower does not exist");
    invariant(!!tickArrayUpper, "OrcaPosition - tickArrayUpper does not exist");

    return {
      tickLower: TickArray.getTick(tickArrayLower, tickLowerIndex),
      tickUpper: TickArray.getTick(tickArrayUpper, tickUpperIndex),
    };
  }

  private isTokenAAmount(tokenAmount: TokenAmount<A | B>): tokenAmount is TokenAmount<A> {
    return tokenAmount.token.equals(this.tokenA);
  }

  private isTokenBAmount(tokenAmount: TokenAmount<A | B>): tokenAmount is TokenAmount<B> {
    return tokenAmount.token.equals(this.tokenB);
  }
}
