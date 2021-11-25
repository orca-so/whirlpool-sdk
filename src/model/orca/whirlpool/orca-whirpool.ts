import JSBI from "jsbi";
import { PublicKey } from "@solana/web3.js";
import { OrcaU64, Percentage } from "../../../public";
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

interface OrcaWhirpoolImplConstructorArgs {
  network: Network;
  args: OrcaWhirlpoolArgs;
}

export class OrcaWhirpoolImpl implements OrcaWhirlpool {
  private whirlpoolsConfig: PublicKey;
  private programId: PublicKey;
  private tokenMintA: PublicKey;
  private tokenMintB: PublicKey;
  private whirlpool?: Whirlpool;

  constructor({ network, args: { tokenMintA, tokenMintB } }: OrcaWhirpoolImplConstructorArgs) {
    invariant(!tokenMintA.equals(tokenMintB), "tokens must be different");

    const inOrder = tokenMintA.toBase58() < tokenMintB.toBase58();
    const _tokenMintA = inOrder ? tokenMintA : tokenMintB;
    const _tokenMintB = inOrder ? tokenMintB : tokenMintA;

    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this.tokenMintA = _tokenMintA;
    this.tokenMintB = _tokenMintB;
  }

  async init(): Promise<void> {
    const address = await Whirlpool.getAddress(
      this.whirlpoolsConfig,
      this.tokenMintA,
      this.tokenMintB,
      this.programId
    );
    this.whirlpool = await Whirlpool.fetch(address);
  }

  async getOpenPositionQuote(
    tokenMint: PublicKey, // TODO - create type constraint for tokenMint
    tokenAmount: OrcaU64,
    tickLowerIndex: number,
    tickUpperIndex: number,
    slippageTolerence?: Percentage
  ): Promise<{ maxTokenA: number; maxTokenB: number; liquidity: number }> {
    invariant(!!this.whirlpool, "whirlpool has not been initialized");

    // find tick_array account(s) with ticks
    const tickArrayLower = await this.loadTickArray(tickLowerIndex);
    const tickArrayUpper = await this.loadTickArray(tickUpperIndex);

    // find ticks within the tick_array account(s)
    const tickLower = tickArrayLower.getTick(tickLowerIndex);
    const tickUpper = tickArrayUpper.getTick(tickUpperIndex);

    const sqrtPrice = this.whirlpool.account.sqrtPrice;
    const sqrtPriceLower = TickMath.getSqrtPriceAtTick(tickLowerIndex);
    const sqrtPriceUpper = TickMath.getSqrtPriceAtTick(tickUpperIndex);

    // 3.2.1 Example 1: Amount of assets from a range
    // Lx = tokenAmount * sqrtPrice * sqrtPriceUpper / (sqrtPriceUpper - sqrtPrice)
    // y = Lx * (sqrtPrice - sqrtPriceLower)
    // return y

    throw new Error("TODO - implement");
  }

  async getOpenPositionQuoteByPrice(
    tokenMint: PublicKey,
    tokenAmount: OrcaU64,
    priceLower: OrcaU256,
    priceUpper: OrcaU256,
    slippageTolerence?: Percentage
  ): Promise<{ maxTokenA: number; maxTokenB: number; liquidity: number }> {
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

  async getInitPoolTransaction(initialSqrtPrice: OrcaU256): Promise<any> {
    throw new Error("TODO - implement");
  }
}
