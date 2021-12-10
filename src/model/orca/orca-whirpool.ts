import { Connection } from "@solana/web3.js";
import { Network, OrcaU64, Percentage, q64 } from "../../public";
import { OrcaWhirlpool, OrcaWhirlpoolArgs } from "../../public/whirlpool";
import { TickArray, Whirlpool } from "../entities";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import { Token } from "../utils/token";
import { TokenPrice } from "../utils/token/price";
import { getSwapQuote, SwapAmount, SwapQuote } from "./swap-quoter";
import { PDA } from "../utils/pda";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "../../constants";
import { TickMath } from "../math";

interface OrcaWhirpoolImplConstructorArgs<A extends Token, B extends Token> {
  connection: Connection;
  network: Network;
  cache?: OrcaCache;
  args: OrcaWhirlpoolArgs<A, B>;
}

// TODO: Integrate OrcaCache into OrcaWhirlpoolImpl

/**
 * Random notes: nft represents the authority to a specific position
 */
export class OrcaWhirpoolImpl<A extends Token, B extends Token> implements OrcaWhirlpool<A, B> {
  private readonly tokenA: A;
  private readonly tokenB: B;
  private readonly cache: OrcaCache;
  private readonly whirlpoolPDA: PDA;

  constructor({
    connection,
    cache,
    network,
    args: { tokenA, tokenB },
  }: OrcaWhirpoolImplConstructorArgs<A, B>) {
    invariant(!tokenA.equals(tokenB), "tokens must be different");

    this.cache = cache || new OrcaCache(network, connection, OrcaCacheStrategy.AlwaysFetch);
    const whirlpoolsConfig = getWhirlpoolsConfig(network);
    const programId = getWhirlpoolProgramId(network);
    [this.tokenA, this.tokenB] = Token.sort(tokenA, tokenB);
    this.whirlpoolPDA = Whirlpool.getPDA(
      whirlpoolsConfig,
      this.tokenA.mint,
      this.tokenB.mint,
      programId
    );
  }

  // create whirlpool and tickarray accounts
  async getInitPoolTransaction(initialPrice: TokenPrice<A, B> | TokenPrice<B, A>): Promise<any> {
    // TODO(atamari): Confirm that token A is base and token B is quote always

    // from yutaro feedback:
    // 1. Token A should always be the base and token B should always be the quote.
    // 2. Token A should always be the base and token B should always be the quote.
    // SCUBA-ATAMARI: we should add the token sort logic here as well

    const normalizedInitialPrice = initialPrice.matchBaseAndQuote(this.tokenA, this.tokenB);

    // TODO: compute the initial sqrt price from initial price
    // TODO: get all accounts (pubkeys) needed to init this pool
    // TODO: build the init pool ix

    // TODO: compute initial tick array params
    // TODO: get all accounts (pubkeys) needed to init the tick array
    // TODO: build the init tick array ix

    // TODO: Return one tx to init pool + init tick array

    throw new Error("TODO - implement");
  }

  async getOpenPositionQuote(
    token: A | B,
    tokenAmount: u64,
    tickLowerIndex: number,
    tickUpperIndex: number,
    slippageTolerence?: Percentage
  ): Promise<{ maxTokenA: u64; maxTokenB: u64; liquidity: u64 }> {
    invariant(
      token.mint.equals(this.tokenA.mint) || token.mint.equals(this.tokenB.mint),
      "invalid mint"
    );

    const whirlpool = await this.cache.getWhirlpool(this.whirlpoolPDA.publicKey);
    const sqrtPrice = whirlpool.account.sqrtPrice;
    const sqrtPriceLower = TickMath.sqrtPriceAtTick(tickLowerIndex);
    const sqrtPriceUpper = TickMath.sqrtPriceAtTick(tickUpperIndex);

    const qTokenAmount = q64.fromU64(tokenAmount);

    // 3.2.1 Example 1: Amount of assets from a range
    const Lx: q64 = qTokenAmount
      .mul(sqrtPrice)
      .mul(sqrtPriceUpper)
      .div(sqrtPriceUpper.sub(sqrtPrice));
    const y: q64 = Lx.mul(sqrtPrice.sub(sqrtPriceLower));
    const u64Y = q64.toU64(y);

    throw new Error("TODO - implement");
  }

  async getOpenPositionQuoteByPrice(
    token: A | B,
    tokenAmount: OrcaU64,
    // priceLower: OrcaU256,
    // priceUpper: OrcaU256,
    slippageTolerence?: Percentage
  ): Promise<{ maxTokenA: number; maxTokenB: number; liquidity: number }> {
    invariant(
      token.mint.equals(this.tokenA.mint) || token.mint.equals(this.tokenB.mint),
      "invalid mint"
    );
    throw new Error("TODO - implement");
    // const lowerTickIndex = this._nearestTickIndexAbove(priceLower);
    // const upperTickIndex = this._nearestTickIndexBelow(priceUpper);

    // return this.getOpenPositionQuote(
    //   tokenMint,
    //   tokenAmount,
    //   lowerTickIndex,
    //   upperTickIndex,
    //   slippageTolerence
    // );
  }

  public async getSwapQuote(
    swapAmount: SwapAmount<A, B>,
    slippageTolerance?: Percentage
  ): Promise<SwapQuote<A, B>> {
    const whirlpool = await this.cache.getWhirlpool(this.whirlpoolPDA.publicKey);
    const { publicKey: tickArrayAddress } = TickArray.getPDA(
      this.whirlpoolPDA.publicKey,
      whirlpool.account.tickArrayStart,
      whirlpool.account.programId
    );
    const currentTickArray = await this.cache.getTickArray(tickArrayAddress);

    return getSwapQuote({
      whirlpool,
      currentTickArray,
      tokenA: this.tokenA,
      tokenB: this.tokenB,
      amount: swapAmount,
      slippageTolerance,
    });
  }

  async loadTickArray(tickIndex: number): Promise<TickArray> {
    const whirlpool = await this.cache.getWhirlpool(this.whirlpoolPDA.publicKey);
    const startTick = TickArray.findStartTick(tickIndex, whirlpool.account.tickArrayStart);
    const { publicKey: tickArrayAddress } = TickArray.getPDA(
      this.whirlpoolPDA.publicKey,
      startTick,
      whirlpool.account.programId
    );

    return this.cache.getTickArray(tickArrayAddress);
  }
}
