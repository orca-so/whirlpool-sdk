import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Token } from "../../model/token";
import { TokenAmount } from "../../model/token/amount";
import { Percentage } from "../utils/models/percentage";
import { TickArray } from "./entities";

export enum Network {
  MAINNET = "mainnet",
  DEVNET = "devnet",
}

export enum FeeTier {
  LOW = 1,
  STANDARD = 2,
  HIGH = 3,
}

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

  getSwapQuote: (tokenMint: PublicKey, amount: any, slippageTolerence?: Percentage) => Promise<any>;

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

  // fetch whitelist from zp
  // getWhitelist: () => Promise<any | null>;
}

export interface OrcaPosition<A extends Token, B extends Token> {
  getAddLiquidityQuote: (
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    slippageTolerence?: Percentage
  ) => Promise<AddLiquidityQuote<A, B>>;
}
