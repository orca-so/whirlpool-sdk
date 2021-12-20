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
import { PositionEntity, TickArrayEntity, WhirlpoolEntity } from "../entities";
import { OrcaCache } from "../cache";
import { u64 } from "@solana/spl-token";
import BN from "bn.js";

// TODO restructure
// TODO add methods to expose account information
//      but do not expose the account itself since it will complicate caching
//      client shouldn't have direct access to account. rather call methods (i.e. orcaPosition.getLowerTick())
//      basically need to make it easy to implement react component
export class OrcaPositionImpl implements OrcaPosition {
  private readonly cache: OrcaCache;
  // private readonly tokenA: A;
  // private readonly tokenB: B;
  // private readonly whirlpoolAddress: PublicKey;
  private readonly address: PublicKey;

  constructor(cache: OrcaCache, { positionMint }: OrcaPositionArgs) {
    this.cache = cache;
    this.address = PositionEntity.deriveAddress(positionMint, this.cache.programId);
  }

  public async getAddLiquidityQuote<A extends Token, B extends Token>(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence = defaultSlippagePercentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const position = await this.getPosition();
    const whirlpool = await this.getWhirlpool();
    const positionStatus = PositionEntity.getPositionStatus(whirlpool, position);

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
    const position = await this.getPosition();
    const whirlpool = await this.getWhirlpool();
    const positionStatus = PositionEntity.getPositionStatus(whirlpool, position);

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
    const position = await this.getPosition();
    const whirlpool = await this.getWhirlpool();

    const { tickCurrentIndex, feeGrowthGlobalAX64, feeGrowthGlobalBX64 } = whirlpool;
    const {
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
      liquidityU64: liquidity,
      feeOwedAU64,
      feeOwedBU64,
      feeGrowthCheckpointAX64,
      feeGrowthCheckpointBX64,
    } = position;

    const { tickLower, tickUpper } = await this.getTicksLowerAndUpper(
      tickLowerIndex,
      tickUpperIndex
    );

    // Calculate the fee growths inside the position

    let feeGrowthBelowAX64: BN | null = null;
    let feeGrowthBelowBX64: BN | null = null;

    if (tickCurrentIndex < tickLowerIndex) {
      feeGrowthBelowAX64 = feeGrowthGlobalAX64.sub(tickLower.feeGrowthOutsideAX64);
      feeGrowthBelowBX64 = feeGrowthGlobalBX64.sub(tickLower.feeGrowthOutsideBX64);
    } else {
      feeGrowthBelowAX64 = tickLower.feeGrowthOutsideAX64;
      feeGrowthBelowBX64 = tickLower.feeGrowthOutsideBX64;
    }

    let feeGrowthAboveAX64: BN | null = null;
    let feeGrowthAboveBX64: BN | null = null;

    if (tickCurrentIndex < tickUpperIndex) {
      feeGrowthAboveAX64 = tickUpper.feeGrowthOutsideAX64;
      feeGrowthAboveBX64 = tickUpper.feeGrowthOutsideBX64;
    } else {
      feeGrowthAboveAX64 = feeGrowthGlobalAX64.sub(tickUpper.feeGrowthOutsideAX64);
      feeGrowthAboveBX64 = feeGrowthGlobalBX64.sub(tickUpper.feeGrowthOutsideBX64);
    }

    const feeGrowthInsideAX64 = feeGrowthGlobalAX64.sub(feeGrowthBelowAX64).sub(feeGrowthAboveAX64);
    const feeGrowthInsideBX64 = feeGrowthGlobalBX64.sub(feeGrowthBelowBX64).sub(feeGrowthAboveBX64);

    // Calculate the updated fees owed

    const liquidityX64 = BNUtils.u64ToX64(liquidity);
    const feeOwedADeltaX64 = BNUtils.mulX64(liquidityX64, feeGrowthInsideAX64).sub(
      feeGrowthCheckpointAX64
    );
    const feeOwedBDeltaX64 = BNUtils.mulX64(liquidityX64, feeGrowthInsideBX64).sub(
      feeGrowthCheckpointBX64
    );

    const updatedFeeOwedAU64 = feeOwedAU64.add(BNUtils.x64ToU64Floor(feeOwedADeltaX64));
    const updatedFeeOwedBU64 = feeOwedBU64.add(BNUtils.x64ToU64Floor(feeOwedBDeltaX64));

    return {
      feeOwedA: TokenAmount.from(this.tokenA, updatedFeeOwedAU64),
      feeOwedB: TokenAmount.from(this.tokenB, updatedFeeOwedBU64),
    };
  }

  // TODO A, B, C and different so change to R1, R2, R3
  public async getCollectRewardsQuote<
    R1 extends Token,
    R2 extends Token,
    R3 extends Token
  >(): Promise<CollectRewardsQuote<R1, R2, R3>> {
    const position = await this.getPosition();
    const whirlpool = await this.getWhirlpool();

    const { tickCurrentIndex, rewardInfos: whirlpoolRewardsInfos } = whirlpool;
    const {
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
      liquidityU64,
      rewardInfos,
    } = position;

    const { tickLower, tickUpper } = await this.getTicksLowerAndUpper(
      tickLowerIndex,
      tickUpperIndex
    );

    // Calculate the reward growths inside the position

    const range = [...Array(NUM_REWARDS).keys()];
    const rewardGrowthsBelowX64: [BN, BN, BN] = [new BN(0), new BN(0), new BN(0)];
    const rewardGrowthsAboveX64: [BN, BN, BN] = [new BN(0), new BN(0), new BN(0)];

    for (const i of range) {
      if (tickCurrentIndex < tickLowerIndex) {
        rewardGrowthsBelowX64[i] = whirlpoolRewardsInfos[i].growthGlobalX64.sub(
          tickLower.rewardGrowthsOutsideX64[i]
        );
      } else {
        rewardGrowthsBelowX64[i] = tickLower.rewardGrowthsOutsideX64[i];
      }

      if (tickCurrentIndex < tickUpperIndex) {
        rewardGrowthsAboveX64[i] = tickUpper.rewardGrowthsOutsideX64[i];
      } else {
        rewardGrowthsAboveX64[i] = whirlpoolRewardsInfos[i].growthGlobalX64.sub(
          tickUpper.rewardGrowthsOutsideX64[i]
        );
      }
    }

    const rewardGrowthsInsideX64: [[BN, boolean], [BN, boolean], [BN, boolean]] = [
      [new BN(0), false],
      [new BN(0), false],
      [new BN(0), false],
    ];
    for (const i of range) {
      if (WhirlpoolEntity.isRewardInitialized(whirlpoolRewardsInfos[i])) {
        rewardGrowthsInsideX64[i] = [
          whirlpoolRewardsInfos[i].growthGlobalX64
            .sub(rewardGrowthsBelowX64[i])
            .sub(rewardGrowthsAboveX64[i]),
          true,
        ];
      }
    }

    // Calculate the updated rewards owed

    const liquidityX64 = BNUtils.u64ToX64(liquidityU64);
    const updatedRewardInfosX64: [BN, BN, BN] = [new BN(0), new BN(0), new BN(0)];

    for (const i of range) {
      if (rewardGrowthsInsideX64[i][1]) {
        updatedRewardInfosX64[i] = rewardInfos[i].amountOwedU64.add(
          BNUtils.mulX64(
            liquidityX64,
            rewardGrowthsInsideX64[i][0].sub(rewardInfos[i].growthInsideCheckpointX64)
          )
        );
      }
    }

    const rewardExistsA = rewardGrowthsInsideX64[0][1];
    const rewardExistsB = rewardGrowthsInsideX64[1][1];
    const rewardExistsC = rewardGrowthsInsideX64[2][1];

    const rewardOwedAU64 = BNUtils.x64ToU64Floor(updatedRewardInfosX64[0]);
    const rewardOwedBU64 = BNUtils.x64ToU64Floor(updatedRewardInfosX64[1]);
    const rewardOwedCU64 = BNUtils.x64ToU64Floor(updatedRewardInfosX64[2]);

    // const rewardOwedA = rewardExistsA ? TokenAmount.from(this.tokenA, rewardOwedAU64) : undefined;
    // const rewardOwedB = rewardExistsB ? TokenAmount.from(this.tokenB, rewardOwedBU64) : undefined;
    // const rewardOwedC = rewardExistsC ? TokenAmount.from(this.tokenC, rewardOwedCU64) : undefined;

    // return {
    //   rewardOwedA,
    //   rewardOwedB,
    //   rewardOwedC,
    // };

    throw new Error("TODO - get token info, create token, return token amount");
  }

  public async getCollectFeesAndRewardsTransaction(owner: Owner): Promise<TransactionPayload> {
    throw new Error("Method not implemented.");
  }

  private async getAddLiquidityQuoteWhenPositionIsBelowRange(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const position = await this.getPosition();

    if (!this.isTokenAAmount(tokenAmount)) {
      // Cannot deposit Token B into position when price is below position's range
      return {
        maxTokenA: TokenAmount.zero(this.tokenA),
        maxTokenB: TokenAmount.zero(this.tokenB),
        liquidity: new u64(0),
      };
    }

    // TODO: Use slippage tolerance here

    const tokenAAmountX64 = BNUtils.u64ToX64(tokenAmount.toU64());
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);
    // Equation (5) from math paper
    const liquidityX64 = BNUtils.mulX64(
      tokenAAmountX64,
      BNUtils.mulX64(sqrtPriceLowerX64, sqrtPriceUpperX64)
    ).div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

    return {
      maxTokenA: tokenAmount,
      maxTokenB: TokenAmount.zero(this.tokenB),
      liquidity: BNUtils.x64ToU64Floor(liquidityX64),
    };
  }

  private async getAddLiquidityQuoteWhenPositionIsInRange(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const position = await this.getPosition();
    const whirlpool = await this.getWhirlpool();

    // TODO: Use slippage tolerance here

    const tokenAmountX64 = BNUtils.u64ToX64(tokenAmount.toU64());

    const sqrtPriceX64 = whirlpool.sqrtPriceX64;
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    let [tokenAAmountX64, tokenBAmountX64] = this.isTokenAAmount(tokenAmount)
      ? [tokenAmountX64, undefined]
      : [undefined, tokenAmountX64];

    let liquidityX64: BN | undefined = undefined;

    if (tokenAAmountX64) {
      // Derived from equation (11) from math paper
      liquidityX64 = BNUtils.mulX64(
        tokenAAmountX64,
        BNUtils.mulX64(sqrtPriceX64, sqrtPriceUpperX64)
      ).div(sqrtPriceUpperX64.sub(sqrtPriceX64));

      // Equation (12) from math paper
      tokenBAmountX64 = BNUtils.mulX64(liquidityX64, sqrtPriceX64.sub(sqrtPriceLowerX64));
    } else if (tokenBAmountX64) {
      // Derived from equation (12) from math paper
      liquidityX64 = tokenBAmountX64.div(sqrtPriceX64.sub(sqrtPriceLowerX64));

      // Equation (11) from math paper
      tokenAAmountX64 = BNUtils.mulX64(liquidityX64, sqrtPriceUpperX64.sub(sqrtPriceX64)).div(
        BNUtils.mulX64(sqrtPriceX64, sqrtPriceUpperX64)
      );
    }

    invariant(tokenAAmountX64 !== undefined, "Token A amount is undefined");
    invariant(tokenBAmountX64 !== undefined, "Token B amount is undefined");
    invariant(liquidityX64 !== undefined, "Liquidity is undefined");

    return {
      maxTokenA: TokenAmount.from(this.tokenA, BNUtils.x64ToU64Floor(tokenAAmountX64)),
      maxTokenB: TokenAmount.from(this.tokenB, BNUtils.x64ToU64Floor(tokenBAmountX64)),
      liquidity: BNUtils.x64ToU64Floor(liquidityX64),
    };
  }

  private async getAddLiquidityQuoteWhenPositionIsAboveRange(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const position = await this.getPosition();

    if (!this.isTokenBAmount(tokenAmount)) {
      // Cannot deposit Token A into position when price is above position's range
      return {
        maxTokenA: TokenAmount.zero(this.tokenA),
        maxTokenB: TokenAmount.zero(this.tokenB),
        liquidity: new u64(0),
      };
    }

    // TODO: Use slippage tolerance here

    const tokenBAmountX64 = BNUtils.u64ToX64(tokenAmount.toU64());
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);
    // Equation (9) from math paper
    const liquidityX64 = tokenBAmountX64.div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

    return {
      maxTokenA: TokenAmount.zero(this.tokenA),
      maxTokenB: tokenAmount,
      liquidity: BNUtils.x64ToU64Floor(liquidityX64),
    };
  }

  private async getRemoveLiquidityQuoteWhenPositionIsBelowRange(
    liquidity: u64,
    slippageTolerence: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    // TODO: Use slippage tolerance here

    const position = await this.getPosition();
    const liquidityX64 = BNUtils.u64ToX64(liquidity);
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenAAmountX64 = BNUtils.mulX64(
      liquidityX64,
      sqrtPriceUpperX64.sub(sqrtPriceLowerX64)
    ).div(BNUtils.mulX64(sqrtPriceLowerX64, sqrtPriceUpperX64));

    return {
      minTokenA: TokenAmount.from(this.tokenA, BNUtils.x64ToU64Floor(tokenAAmountX64)),
      minTokenB: TokenAmount.zero(this.tokenB),
      liquidity,
    };
  }

  private async getRemoveLiquidityQuoteWhenPositionIsInRange(
    liquidity: u64,
    slippageTolerence: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    // TODO: Use slippage tolerance here

    const position = await this.getPosition();
    const whirlpool = await this.getWhirlpool();

    const liquidityX64 = BNUtils.u64ToX64(liquidity);
    const sqrtPriceX64 = whirlpool.sqrtPriceX64;
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenAAmountX64 = BNUtils.mulX64(liquidityX64, sqrtPriceUpperX64.sub(sqrtPriceX64)).div(
      BNUtils.mulX64(sqrtPriceX64, sqrtPriceUpperX64)
    );
    const tokenBAmountX64 = BNUtils.mulX64(liquidityX64, sqrtPriceX64.sub(sqrtPriceLowerX64));

    return {
      minTokenA: TokenAmount.from(this.tokenA, BNUtils.x64ToU64Floor(tokenAAmountX64)),
      minTokenB: TokenAmount.from(this.tokenB, BNUtils.x64ToU64Floor(tokenBAmountX64)),
      liquidity,
    };
  }

  private async getRemoveLiquidityQuoteWhenPositionIsAboveRange(
    liquidity: u64,
    slippageTolerence: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>> {
    // TODO: Use slippage tolerance here

    const position = await this.getPosition();
    const liquidityX64 = BNUtils.u64ToX64(liquidity);
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.tickUpper);

    const tokenBAmountX64 = BNUtils.mulX64(liquidityX64, sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

    return {
      minTokenA: TokenAmount.zero(this.tokenA),
      minTokenB: TokenAmount.from(this.tokenB, BNUtils.x64ToU64Floor(tokenBAmountX64)),
      liquidity,
    };
  }

  public async getPositionMint(): Promise<PublicKey> {
    return (await this.getPosition()).positionMint;
  }

  public async getTickLower(): Promise<number> {
    return (await this.getPosition()).tickLower;
  }

  public async getTickUpper(): Promise<number> {
    return (await this.getPosition()).tickUpper;
  }

  public async getTokenA(): Promise<Token> {
    const whirlpool = await this.getWhirlpool();
    const tokenMintA = whirlpool.tokenMintA;
    throw new Error("TODO");
  }

  public async getTokenB(): Promise<Token> {
    const whirlpool = await this.getWhirlpool();
    const tokenMintB = whirlpool.tokenMintB;
    throw new Error("TODO");
  }

  public async getCurrentPrice(): Promise<any> {
    const whirlpool = await this.getWhirlpool();
    const sqrtPriceX64 = whirlpool.sqrtPriceX64;
    throw new Error("TODO");
  }

  private async getPosition(): Promise<PositionAccount> {
    const position = await this.cache.getPosition(this.address);
    invariant(!!position, "OrcaPosition - position does not exist");
    return position;
  }

  private async getWhirlpool(): Promise<WhirlpoolAccount> {
    const position = await this.getPosition();
    const whirlpool = await this.cache.getWhirlpool(position.whirlpool);
    invariant(!!whirlpool, "OrcaPosition - whirlpool does not exist");
    return whirlpool;
  }

  private async getTicksLowerAndUpper(
    tickLowerIndex: number,
    tickUpperIndex: number
  ): Promise<{
    tickLower: Tick;
    tickUpper: Tick;
  }> {
    const whirlpool = await this.getWhirlpool();

    if (tickLowerIndex === tickUpperIndex) {
      const tickAddress = TickArrayEntity.getAddressContainingTickIndex(
        tickLowerIndex,
        whirlpool,
        this.cache.programId
      );
      const tickArray = await this.cache.getTickArray(tickAddress);
      invariant(!!tickArray, "OrcaPostion - tickArray does not exist");
      return {
        tickLower: TickArrayEntity.getTick(tickArray, tickLowerIndex),
        tickUpper: TickArrayEntity.getTick(tickArray, tickUpperIndex),
      };
    }

    const tickLowerAddress = TickArrayEntity.getAddressContainingTickIndex(
      tickLowerIndex,
      whirlpool,
      this.cache.programId
    );
    const tickUpperAddress = TickArrayEntity.getAddressContainingTickIndex(
      tickUpperIndex,
      whirlpool,
      this.cache.programId
    );

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
