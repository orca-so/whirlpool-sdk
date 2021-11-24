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

interface OrcaWhirpoolImplConstructorArgs {
  network: Network;
  args: OrcaWhirlpoolArgs;
}

export class OrcaWhirpoolImpl implements OrcaWhirlpool {
  private whirlpool: Whirlpool;

  constructor({ network, args: { tokenMintA, tokenMintB } }: OrcaWhirpoolImplConstructorArgs) {
    invariant(!tokenMintA.equals(tokenMintB), "Whirlpool");

    // consistent ordering of tokenA and tokenB
    const inOrder = tokenMintA.toBase58() < tokenMintB.toBase58();
    const _tokenMintA = inOrder ? tokenMintA : tokenMintB;
    const _tokenMintB = inOrder ? tokenMintB : tokenMintA;

    this.whirlpool = new Whirlpool({
      whirlpoolsConfig: getWhirlpoolsConfig(network),
      tokenMintA: _tokenMintA,
      tokenMintB: _tokenMintB,
      programId: getWhirlpoolProgramId(network),
    });
  }

  async getOpenPositionQuote(
    tokenMint: PublicKey,
    tokenAmount: OrcaU64,
    tickLowerIndex: number,
    tickUpperIndex: number,
    slippageTolerence?: Percentage
  ): Promise<{ maxTokenA: number; maxTokenB: number; liquidity: number }> {
    // find tick_array account(s) with ticks
    const tickArrayLower = await this.loadTickArray(tickLowerIndex);
    const tickArrayUpper = await this.loadTickArray(tickUpperIndex);

    // find ticks within the tick_array account(s)
    const tickLower = tickArrayLower.getTick(tickLowerIndex);
    const tickUpper = tickArrayUpper.getTick(tickUpperIndex);

    // calculate open position quote

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
    const tickArrayStart = this.whirlpool.tickArrayStart;

    const delta = Math.floor(Math.abs(tickIndex - tickArrayStart) / NUM_TICKS_IN_ARRAY);
    const direction = tickIndex - tickArrayStart > 0 ? 1 : -1;
    const targetTickArrayStart = tickArrayStart + direction * delta * NUM_TICKS_IN_ARRAY;

    return TickArray.fetchTickArray(this.whirlpool, targetTickArrayStart);
  }

  async getInitPoolTransaction(initialSqrtPrice: OrcaU256): Promise<any> {
    throw new Error("TODO - implement");
  }
}
