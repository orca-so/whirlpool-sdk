import { Connection, PublicKey } from "@solana/web3.js";
import {
  AddLiquidityQuote,
  Network,
  OrcaPosition,
  OrcaPositionArgs,
  Position,
  PositionStatus,
  RemoveLiquidityQuote,
  TickMath,
  Whirlpool,
} from "../../../public/whirlpools";
import { Token } from "../../token";
import { TokenAmount } from "../../token/amount";
import { OrcaCache, OrcaCacheStrategy, Percentage, q64, TransactionPayload } from "../../../public";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import {
  defaultSlippagePercentage,
  getWhirlpoolProgramId,
  getWhirlpoolsConfig,
} from "../../../constants";
import { Owner } from "../../../public/utils/web3/key-utils";

interface OrcaPositionImplConstructorArgs<A extends Token, B extends Token> {
  connection: Connection;
  cache?: OrcaCache;
  network: Network;
  args: OrcaPositionArgs<A, B>;
}

export class OrcaPositionImpl<A extends Token, B extends Token> implements OrcaPosition<A, B> {
  private readonly cache: OrcaCache;
  private readonly tokenA: A;
  private readonly tokenB: B;
  private readonly whirlpoolAddress: PublicKey;
  private readonly positionAddress: PublicKey;

  constructor({
    connection,
    cache,
    network,
    args: { tokenA, tokenB, positionMint },
  }: OrcaPositionImplConstructorArgs<A, B>) {
    invariant(!tokenA.equals(tokenB), "tokens must be different");

    const whirlpoolProgramId = getWhirlpoolProgramId(network);
    const whirlpoolsConfig = getWhirlpoolsConfig(network);

    this.cache = cache || new OrcaCache(network, connection, OrcaCacheStrategy.AlwaysFetch);
    [this.tokenA, this.tokenB] = Token.sort(tokenA, tokenB);

    this.whirlpoolAddress = Whirlpool.getPDA(
      whirlpoolsConfig,
      this.tokenA.mint,
      this.tokenB.mint,
      whirlpoolProgramId
    ).publicKey;

    this.positionAddress = Position.getPDA(
      this.whirlpoolAddress,
      positionMint,
      whirlpoolProgramId
    ).publicKey;
  }

  public async getAddLiquidityQuote(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence = defaultSlippagePercentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { whirlpool, position } = await this.getAccounts();
    const positionStatus = whirlpool.getPositionStatus(position);

    let _getAddLiqudityQuote;

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        _getAddLiqudityQuote = this.getAddLiquidityQuoteWhenPositionIsBelowRange;
        break;
      case PositionStatus.InRange:
        _getAddLiqudityQuote = this.getAddLiquidityQuoteWhenPositionIsInRange;
        break;
      case PositionStatus.AboveRange:
        _getAddLiqudityQuote = this.getAddLiquidityQuoteWhenPositionIsAboveRange;
        break;
      default:
        throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
    }

    return _getAddLiqudityQuote(tokenAmount, slippageTolerence);
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
    const { whirlpool, position } = await this.getAccounts();
    const positionStatus = whirlpool.getPositionStatus(position);

    let _getRemoveLiqudityQuote;

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        _getRemoveLiqudityQuote = this.getRemoveLiquidityQuoteWhenPositionIsBelowRange;
        break;
      case PositionStatus.InRange:
        _getRemoveLiqudityQuote = this.getRemoveLiquidityQuoteWhenPositionIsInRange;
        break;
      case PositionStatus.AboveRange:
        _getRemoveLiqudityQuote = this.getRemoveLiquidityQuoteWhenPositionIsAboveRange;
        break;
      default:
        throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
    }

    return _getRemoveLiqudityQuote(liquidity, slippageTolerence);
  }

  public async getRemoveLiquidityTransaction(
    owner: Owner,
    quote: RemoveLiquidityQuote<A, B>
  ): Promise<TransactionPayload> {
    throw new Error("Method not implemented.");
  }

  public async getCollectFeesQuote(owner: Owner): Promise<u64> {
    throw new Error("Method not implemented.");
  }

  public async getCollectRewardsQuote(owner: Owner): Promise<u64> {
    throw new Error("Method not implemented.");
  }

  public async getCollectFeesAndRewardsQuote(owner: Owner): Promise<u64> {
    throw new Error("Method not implemented.");
  }

  public async getCollectFeesAndRewardsTransaction(owner: Owner): Promise<TransactionPayload> {
    throw new Error("Method not implemented.");
  }

  private async getAddLiquidityQuoteWhenPositionIsBelowRange(
    tokenAmount: TokenAmount<A | B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { position } = await this.getAccounts();

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
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.account.tickUpper);
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
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { whirlpool, position } = await this.getAccounts();

    // TODO: Use slippage tolerance here

    const tokenAmountX64 = q64.fromU64(tokenAmount.toU64());

    const sqrtPriceX64 = whirlpool.account.sqrtPrice;
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.account.tickUpper);

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
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    slippageTolerence: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const { position } = await this.getAccounts();

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
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.account.tickUpper);
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

    const { position } = await this.getAccounts();
    const liquidityX64 = q64.fromU64(liquidity);
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.account.tickUpper);

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

    const { whirlpool, position } = await this.getAccounts();
    const liquidityX64 = q64.fromU64(liquidity);
    const sqrtPriceX64 = whirlpool.account.sqrtPrice;
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.account.tickUpper);

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

    const { position } = await this.getAccounts();
    const liquidityX64 = q64.fromU64(liquidity);
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(position.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(position.account.tickUpper);

    const tokenBAmountX64 = liquidityX64.mul(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

    return {
      minTokenA: TokenAmount.zero(this.tokenA),
      minTokenB: TokenAmount.from(this.tokenB, q64.toU64(tokenBAmountX64)),
      liquidity,
    };
  }

  private async getAccounts(): Promise<{
    whirlpool: Whirlpool;
    position: Position;
  }> {
    const [whirlpool, position] = await Promise.all([
      this.cache.getWhirlpool(this.whirlpoolAddress),
      this.cache.getPosition(this.positionAddress),
    ]);

    return {
      whirlpool,
      position,
    };
  }

  private isTokenAAmount(tokenAmount: TokenAmount<A | B>): tokenAmount is TokenAmount<A> {
    return tokenAmount.token.equals(this.tokenA);
  }

  private isTokenBAmount(tokenAmount: TokenAmount<A | B>): tokenAmount is TokenAmount<B> {
    return tokenAmount.token.equals(this.tokenB);
  }
}
