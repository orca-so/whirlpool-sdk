import { OrcaWhirlpool, OrcaWhirlpoolArgs, Percentage, q64 } from "../../public";
import { TickArrayAccount, TickArray, WhirlpoolAccount, Whirlpool } from "../entities";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import { Token, TokenPrice } from "../utils";
import { getSwapQuote, SwapAmount, SwapQuote } from "./swap-quoter";
import { TickMath } from "../utils";
import { OrcaCache } from "../cache";
import { PublicKey } from "@solana/web3.js";
import { defaultSlippagePercentage } from "../../constants";

/**
 * Random notes: nft represents the authority to a specific position
 */
export class OrcaWhirpoolImpl<A extends Token, B extends Token> implements OrcaWhirlpool<A, B> {
  private readonly tokenA: A;
  private readonly tokenB: B;
  private readonly cache: OrcaCache;
  private readonly address: PublicKey;

  constructor(cache: OrcaCache, { tokenA, tokenB }: OrcaWhirlpoolArgs<A, B>) {
    invariant(!tokenA.equals(tokenB), "tokens must be different");

    [this.tokenA, this.tokenB] = Token.sort(tokenA, tokenB);
    this.cache = cache;

    this.address = Whirlpool.deriveAddress(
      this.cache.whirlpoolsConfig,
      this.tokenA.mint,
      this.tokenB.mint,
      this.cache.programId
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
    slippageTolerence = defaultSlippagePercentage
  ): Promise<{ maxTokenA: u64; maxTokenB: u64; liquidity: u64 }> {
    const { sqrtPrice } = await this.getWhirlpool();

    const sqrtPriceLower = TickMath.sqrtPriceAtTick(tickLowerIndex);
    const sqrtPriceUpper = TickMath.sqrtPriceAtTick(tickUpperIndex);

    const qTokenAmount = q64.fromU64(tokenAmount);

    // 3.2.1 Example 1: Amount of assets from a range
    const Lx = qTokenAmount.mul(sqrtPrice).mul(sqrtPriceUpper).div(sqrtPriceUpper.sub(sqrtPrice));
    const y = Lx.mul(sqrtPrice.sub(sqrtPriceLower));
    const u64Y = q64.toU64(y as q64); // TODO fix forced type

    throw new Error("TODO - implement");
  }

  async getOpenPositionQuoteByPrice(
    token: A | B,
    tokenAmount: any,
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
    slippageTolerance = defaultSlippagePercentage
  ): Promise<SwapQuote<A, B>> {
    const whirlpool = await this.getWhirlpool();
    const currentTickArray = await this.getCurrentTickArray();

    return getSwapQuote({
      whirlpool,
      currentTickArray,
      tokenA: this.tokenA,
      tokenB: this.tokenB,
      amount: swapAmount,
      slippageTolerance,
    });
  }

  async loadTickArray(tickIndex: number): Promise<TickArrayAccount> {
    const whirlpool = await this.getWhirlpool();
    const startTick = TickArray.findStartTick(tickIndex, whirlpool.tickArrayStart);
    // invariant(!!startTick, "loadTickArray - tick_array does not exist");

    const tickArrayAddress = TickArray.deriveAddress(this.address, startTick, this.cache.programId);

    const tickArray = await this.cache.getTickArray(tickArrayAddress);
    invariant(!!tickArray, "loadTickArray - tick_array does not exist");

    return tickArray;
  }

  private async getWhirlpool(): Promise<WhirlpoolAccount> {
    const whirlpool = await this.cache.getWhirlpool(this.address);
    invariant(!!whirlpool, "OrcaWhirlpool - whirlpool does not exist");
    return whirlpool;
  }

  private async getCurrentTickArray(): Promise<TickArrayAccount> {
    const { tickArrayStart } = await this.getWhirlpool();
    const tickArrayAddress = TickArray.deriveAddress(
      this.address,
      tickArrayStart,
      this.cache.programId
    );

    const tickArray = await this.cache.getTickArray(tickArrayAddress);
    invariant(!!tickArray, "OrcaWhirlpool - tickArray does not exist");
    return tickArray;
  }
}
