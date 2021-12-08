import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaCache, OrcaCacheStrategy, OrcaU64, Percentage, q64 } from "../../../public";
import { Network, OrcaWhirlpool, OrcaWhirlpoolArgs } from "../../../public/whirlpools";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "../../../public/whirlpools/constants";
import { TickArray, Whirlpool } from "../../../public/whirlpools/entities";
import invariant from "tiny-invariant";
import { TickMath } from "../../../public/whirlpools/utils/tick-math";
import { u64 } from "@solana/spl-token";
import { Token } from "../../token";
import { TokenPrice } from "../../token/price";

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
  private readonly whirlpoolsConfig: PublicKey;
  private readonly programId: PublicKey;
  private readonly tokenA: A | B;
  private readonly tokenB: A | B;
  private readonly connection: Connection;
  private readonly cache: OrcaCache;
  private whirlpool?: Whirlpool;

  constructor({
    connection,
    cache,
    network,
    args: { tokenA, tokenB },
  }: OrcaWhirpoolImplConstructorArgs<A, B>) {
    invariant(!tokenA.equals(tokenB), "tokens must be different");

    this.cache = cache || new OrcaCache(network, connection, OrcaCacheStrategy.AlwaysFetch);
    this.connection = connection;
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    [this.tokenA, this.tokenB] = Token.sort(tokenA, tokenB);
  }

  async init(): Promise<void> {
    const pda = Whirlpool.getPDA(
      this.whirlpoolsConfig,
      this.tokenA.mint,
      this.tokenB.mint,
      this.programId
    );
    this.whirlpool = await Whirlpool.fetch(this.connection, pda.publicKey);
  }

  // create whirlpool and tickarray accounts
  async getInitPoolTransaction(initialPrice: TokenPrice<A, B> | TokenPrice<B, A>): Promise<any> {
    invariant(!!this.whirlpool, "whirlpool has not been initialized");
    // TODO(atamari): Confirm that token A is base and token B is quote always
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
    invariant(!!this.whirlpool, "whirlpool has not been initialized");
    invariant(
      token.mint.equals(this.tokenA.mint) || token.mint.equals(this.tokenB.mint),
      "invalid mint"
    );

    const sqrtPrice = this.whirlpool.account.sqrtPrice;
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
    invariant(!!this.whirlpool, "whirlpool has not been initialized");
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

  async getSwapQuote(
    tokenMint: PublicKey,
    amount: OrcaU64,
    slippageTolerence?: Percentage
  ): Promise<any> {}

  async loadTickArray(tickIndex: number): Promise<TickArray> {
    invariant(!!this.whirlpool, "whirlpool has not been initialized");

    const whirlpoolAddress = this.whirlpool.address;
    const startTick = TickArray.findStartTick(tickIndex, this.whirlpool.account.tickArrayStart);
    const address = await TickArray.getAddress(whirlpoolAddress, startTick, this.programId);

    return this.cache.getTickArray(address);
  }
}
