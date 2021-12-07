import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import { q64 } from "../..";
import { PDA } from "../../../model/pda";
import { Token } from "../../../model/token";
import { AddLiquidityQuote, OrcaWhirlpoolPosition, PositionStatus, TickMath } from "..";
import { TokenAmount } from "../../../model/token/amount";
import { Percentage } from "../../utils";
import { Whirlpool, WhirlpoolAccount } from ".";
import { assert } from "console";

export interface PositionAccount {
  whirlpool: PublicKey;

  positionMint: PublicKey;
  liquidity: u64;
  tickLower: number;
  tickUpper: number;

  feeGrowthCheckpointA: q64;
  feeOwedA: u64;

  feeGrowthCheckpointB: q64;
  feeOwedB: u64;

  rewardGrowthCheckpoint0: q64;
  rewardOwed0: u64;

  rewardGrowthCheckpoint1: q64;
  rewardOwed1: u64;

  rewardGrowthCheckpoint2: q64;
  rewardOwed2: u64;

  programId: PublicKey;
}

/**
 * SCUBA-ATAMARI
 *
 * Position shouldn't implement any api facing methods because it's an entity.
 * Entity is a thin wrapper around accounts.
 * I think getAddLiquidityQuote should live in either OrcaWhirlpoolImpl, or have a new api class
 *   called OrcaPositionImpl
 */
export class Position<A extends Token, B extends Token> implements OrcaWhirlpoolPosition<A, B> {
  public readonly account: PositionAccount;

  private readonly tokenA: A;
  private readonly tokenB: B;
  private static SEED_HEADER = "position";
  private pda?: PDA;

  // This entity can only be created by calling Position.fetch(...)
  private constructor(account: PositionAccount, tokenA: A, tokenB: B) {
    invariant(account.tickLower < account.tickUpper, "tick boundaries are not in order");
    this.account = account;
    this.tokenA = tokenA;
    this.tokenB = tokenB;
  }

  public getAddress(): PublicKey {
    if (!this.pda) {
      const { whirlpool, positionMint, programId } = this.account;
      this.pda = Position.getPDA(whirlpool, positionMint, programId);
    }

    return this.pda.publicKey;
  }

  public async equals(position: Position<A, B>): Promise<boolean> {
    const { positionMint, programId } = this.account;
    const { positionMint: otherMint, programId: otherProgramId } = position.account;
    return positionMint.equals(otherMint) && programId.equals(otherProgramId);
  }

  public static async fetch<A extends Token, B extends Token>(
    connection: Connection,
    address: PublicKey
  ): Promise<Position<A, B>> {
    // TODO: Also fetch whirlpool account here to get token A and B objects
    throw new Error("TODO - fetch, then deserialize the account data into Position object");
  }

  /**
   * SCUBA-ATAMARI
   *
   * Hmm, not sure if PDA class is useful. I think we should rely on address being a PublicKey and
   * standarize it that way.
   *
   * Thanks for fixing the derive logic to include the seed header
   */
  public static getPDA(
    whirlpool: PublicKey,
    positionMint: PublicKey,
    whirlpoolProgram: PublicKey
  ): PDA {
    return PDA.derive(whirlpoolProgram, [Position.SEED_HEADER, whirlpool, positionMint]);
  }

  /**
   * SCUBA-ATAMARI
   *
   * Replied on discord but adding it here as well so we don't forget. We need to handle
   * cases where we are adding liquidity to a position that is out of bounds.
   */

  /**
   * SCUBA-ATAMARI
   *
   * One reason for not including this method in entities is because these public api's need to
   * make fetch calls. Here we are making a Whirlpool.fetch() call. But we need to wrap that with
   * a cache. We can't pass cache to entities because entities are part of the cache. That would create
   * a circular dependency.
   *
   * Another reason is separation of concern like mentioned above. Entities are thin wrappers around
   * an account.
   */
  public async getAddLiquidityQuote(
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    slippageTolerence?: Percentage
  ): Promise<AddLiquidityQuote<A, B>> {
    const whirlpool = await Whirlpool.fetch(this.account.whirlpool);
    const positionStatus = await whirlpool.getPositionStatus(this);

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        return this.getAddLiquidityQuoteWhenPositionIsBelowRange(tokenAmount, slippageTolerence);
      case PositionStatus.InRange:
        return this.getAddLiquidityQuoteWhenPositionIsInRange(
          tokenAmount,
          whirlpool.account,
          slippageTolerence
        );
      case PositionStatus.AboveRange:
        return this.getAddLiquidityQuoteWhenPositionIsAboveRange(tokenAmount, slippageTolerence);
    }
  }

  private getAddLiquidityQuoteWhenPositionIsBelowRange(
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    slippageTolerence?: Percentage
  ): AddLiquidityQuote<A, B> {
    invariant(
      this.isTokenAAmount(tokenAmount),
      "Position is below price range, only token A can be deposited to this position"
    );

    // TODO: Use slippage tolerance here

    const tokenAAmountX64 = q64.fromU64(tokenAmount.toU64());
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(this.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(this.account.tickUpper);
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

  private getAddLiquidityQuoteWhenPositionIsInRange(
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    whirlpool: WhirlpoolAccount,
    slippageTolerence?: Percentage
  ): AddLiquidityQuote<A, B> {
    // TODO: Use slippage tolerance here

    const tokenAmountX64 = q64.fromU64(tokenAmount.toU64());

    const sqrtPriceX64 = whirlpool.sqrtPrice;
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(this.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(this.account.tickUpper);

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

  private getAddLiquidityQuoteWhenPositionIsAboveRange(
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    slippageTolerence?: Percentage
  ): AddLiquidityQuote<A, B> {
    invariant(
      this.isTokenBAmount(tokenAmount),
      "Position is above price range, only token B can be deposited to this position"
    );

    // TODO: Use slippage tolerance here

    const tokenBAmountX64 = q64.fromU64(tokenAmount.toU64());
    const sqrtPriceLowerX64 = TickMath.sqrtPriceAtTick(this.account.tickLower);
    const sqrtPriceUpperX64 = TickMath.sqrtPriceAtTick(this.account.tickUpper);
    // Equation (9) from math paper
    const liquidityX64 = tokenBAmountX64.div(sqrtPriceUpperX64.sub(sqrtPriceLowerX64));

    return {
      maxTokenA: TokenAmount.zero(this.tokenA),
      maxTokenB: tokenAmount,
      liquidity: q64.toU64(liquidityX64),
    };
  }

  private isTokenAAmount(
    tokenAmount: TokenAmount<A> | TokenAmount<B>
  ): tokenAmount is TokenAmount<A> {
    return tokenAmount.token.equals(this.tokenA);
  }

  private isTokenBAmount(
    tokenAmount: TokenAmount<A> | TokenAmount<B>
  ): tokenAmount is TokenAmount<B> {
    return tokenAmount.token.equals(this.tokenB);
  }
}
