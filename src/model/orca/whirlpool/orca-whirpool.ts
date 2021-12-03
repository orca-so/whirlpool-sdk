import { Account, PublicKey } from "@solana/web3.js";
import { OrcaToken, OrcaU64, Percentage } from "../../../public";
import { OrcaU256 } from "../../../public/utils/numbers/orca-u256";
import { Network, OrcaWhirlpool, OrcaWhirlpoolArgs } from "../../../public/whirlpools";
import {
  getWhirlpoolProgramId,
  getWhirlpoolsConfig,
  NUM_TICKS_IN_ARRAY,
} from "../../../public/whirlpools/constants";
import { TickArray, Whirlpool } from "../../../public/whirlpools/entities";
import invariant from "tiny-invariant";
import { TickMath } from "../../../public/whirlpools/utils/tick-math";
import { u64 } from "@solana/spl-token";
import { Q } from "../../../public/utils/numbers/fixed-point";

interface OrcaWhirpoolImplConstructorArgs<A extends OrcaToken, B extends OrcaToken> {
  network: Network;
  args: OrcaWhirlpoolArgs<A, B>;
}

/**
 * Random notes: nft represents the authority to a specific position
 */
export class OrcaWhirpoolImpl<A extends OrcaToken, B extends OrcaToken>
  implements OrcaWhirlpool<A, B>
{
  private whirlpoolsConfig: PublicKey;
  private programId: PublicKey;
  private tokenA: A | B;
  private tokenB: A | B;
  private whirlpool?: Whirlpool;

  constructor({ network, args: { tokenA, tokenB } }: OrcaWhirpoolImplConstructorArgs<A, B>) {
    invariant(!tokenA.mint.equals(tokenB.mint), "tokens must be different");

    const inOrder = tokenA.mint.toBase58() < tokenB.mint.toBase58();
    const _tokenA = inOrder ? tokenA : tokenB;
    const _tokenB = inOrder ? tokenB : tokenA;

    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this.tokenA = _tokenA;
    this.tokenB = _tokenB;
  }

  async init(): Promise<void> {
    const address = await Whirlpool.getAddress(
      this.whirlpoolsConfig,
      this.tokenA.mint,
      this.tokenB.mint,
      this.programId
    );
    this._whirlpool = await Whirlpool.fetch(address);
    this._tokenA = await Token.fromMintAccount(this.tokenMintA, this.connection);
    this._tokenB = await Token.fromMintAccount(this.tokenMintB, this.connection);
  }

  // create whirlpool and tickarray accounts
  async getInitPoolTransaction(initialPrice: TokenPrice): Promise<any> {
    // TODO(atamari): Confirm that token A is base and token B is quote always
    const normalizedInitialPrice = initialPrice.match(this.tokenA, this.tokenB);

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
    const sqrtPriceLower = TickMath.getSqrtPriceAtTick(tickLowerIndex);
    const sqrtPriceUpper = TickMath.getSqrtPriceAtTick(tickUpperIndex);

    const qTokenAmount = Q.fromU64(tokenAmount);
    const qSqrtPrice = new Q(sqrtPrice, 64);
    const qSqrtPriceLower = new Q(sqrtPriceLower, 64);
    const qSqrtPriceUpper = new Q(sqrtPriceUpper, 64);

    // 3.2.1 Example 1: Amount of assets from a range
    const Lx = qTokenAmount
      .mul(qSqrtPrice)
      .mul(qSqrtPriceUpper)
      .div(qSqrtPriceUpper.sub(qSqrtPrice));
    const y = Lx.mul(qSqrtPrice.sub(qSqrtPriceLower));

    throw new Error("TODO - implement");
  }

  async getOpenPositionQuoteByPrice(
    token: A | B,
    tokenAmount: OrcaU64,
    priceLower: OrcaU256,
    priceUpper: OrcaU256,
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

    const whirlpoolAddress = await this.whirlpool.getAddress();
    const startTick = TickArray.findStartTick(tickIndex, this.whirlpool.account.tickArrayStart);
    const address = await TickArray.getAddress(whirlpoolAddress, startTick, this.programId);

    return TickArray.fetch(address);
  }
}
