import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { TransactionPayload } from "..";
import { Token } from "../../model/utils/token";
import { TokenAmount } from "../../model/utils/token/amount";
import { Percentage } from "../utils/models/percentage";
import { Owner } from "../utils/web3/key-utils";
import { TickArray } from "../../model/entities";
import { SwapAmount, SwapQuote } from "../../model/orca";

export type OrcaWhirlpoolArgs<A extends Token, B extends Token> = {
  tokenA: A;
  tokenB: B;
};

export type OrcaPositionArgs<A extends Token, B extends Token> = {
  tokenA: A;
  tokenB: B;
  positionMint: PublicKey;
};

export type AddLiquidityQuote<A extends Token, B extends Token> = {
  maxTokenA: TokenAmount<A>;
  maxTokenB: TokenAmount<B>;
  liquidity: u64;
};

export type RemoveLiquidityQuote<A extends Token, B extends Token> = {
  minTokenA: TokenAmount<A>;
  minTokenB: TokenAmount<B>;
  liquidity: u64;
};

export type CollectFeesQuote<A extends Token, B extends Token> = {
  feeOwedA: TokenAmount<A>;
  feeOwedB: TokenAmount<B>;
};

export type CollectRewardsQuote<A extends Token, B extends Token> = {
  rewardsOwedA: TokenAmount<A>;
  rewardsOwedB: TokenAmount<B>;
};

export enum PositionStatus {
  BelowRange,
  InRange,
  AboveRange,
}

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

export interface OrcaPosition<A extends Token, B extends Token> {
  getAddLiquidityQuote: (
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    slippageTolerence?: Percentage
  ) => Promise<AddLiquidityQuote<A, B>>;

  getAddLiquidityTransaction(
    owner: Owner,
    quote: AddLiquidityQuote<A, B>
  ): Promise<TransactionPayload>;

  getRemoveLiquidityQuote: (
    liquidity: u64,
    slippageTolerence?: Percentage
  ) => Promise<RemoveLiquidityQuote<A, B>>;

  getRemoveLiquidityTransaction(
    owner: Owner,
    quote: RemoveLiquidityQuote<A, B>
  ): Promise<TransactionPayload>;

  getCollectFeesQuote: () => Promise<CollectFeesQuote<A, B>>;

  getCollectRewardsQuote: () => Promise<CollectRewardsQuote<A, B>>;

  getCollectFeesAndRewardsTransaction: (owner: Owner) => Promise<TransactionPayload>;
}
