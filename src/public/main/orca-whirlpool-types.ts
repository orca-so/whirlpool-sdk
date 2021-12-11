import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { TransactionPayload } from "..";
import { Token } from "../../model/utils/token";
import { Percentage } from "../utils/models/percentage";
import { TickArray } from "../../model/entities";
import { SwapAmount, SwapQuote } from "../../model/orca/swap-quoter";

export type OrcaWhirlpoolArgs<A extends Token, B extends Token> = {
  tokenA: A;
  tokenB: B;
};

export interface OrcaWhirlpool<A extends Token, B extends Token> {
  getOpenPositionQuote: (
    token: A | B,
    tokenAmount: u64,
    tickLowerIndex: number,
    tickUpperIndex: number,
    slippageTolerence?: Percentage
  ) => Promise<{ maxTokenA: u64; maxTokenB: u64; liquidity: u64 }>;

  // getOpenPositionQuoteByPrice: (
  //   tokenMint: PublicKey,
  //   tokenAmount: OrcaU64,
  //   priceLower: OrcaU256,
  //   priceUpper: OrcaU256,
  //   slippageTolerence?: Percentage
  // ) => Promise<{ maxTokenA: number; maxTokenB: number; liquidity: number }>;

  // // create lp position
  // getOpenPositionTransaction: (
  //   owner: Owner,
  //   tokenAccountA: AccountInfo,
  //   tokenAccountB: AccountInfo,
  //   token: any,
  //   tokenAmount: OrcaU64,
  //   tickLowerIndex: number,
  //   tickUpperIndex: number,
  //   slippageTolerence?: Percentage
  // ) => Promise<any>;

  getSwapQuote: (
    swapAmount: SwapAmount<A, B>,
    slippageTolerence?: Percentage
  ) => Promise<SwapQuote<A, B>>;

  // getSwapTransaction: (
  //   owner: Owner,
  //   tokenAccountA: AccountInfo,
  //   tokenAccountB: AccountInfo,
  //   amount: OrcaU64,
  //   slippageTolerence?: Percentage
  // ) => Promise<any>;

  loadTickArray: (tickIndex: number) => Promise<TickArray>;

  // // return distribution of liquidity
  // // required to visualize liquidity in UI
  // getLiquidityDistribution: () => Promise<any>;

  // // return the suggested price range
  // getSuggestedPriceRange: (conservative: boolean) => Promise<any>;

  getInitPoolTransaction: (initialSqrtPrice: any) => Promise<any>;
}
