import { PublicKey } from "@solana/web3.js";
import { OrcaU64 } from "..";
import { Percentage } from "../utils/models/percentage";
import { OrcaU256 } from "../utils/numbers/orca-u256";
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

export type OrcaWhirlpoolArgs = {
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  feeTier: FeeTier;
};

export interface OrcaWhirlpool {
  getOpenPositionQuote: (
    tokenMint: PublicKey,
    tokenAmount: OrcaU64,
    tickLowerIndex: number,
    tickUpperIndex: number,
    slippageTolerence?: Percentage
  ) => Promise<{ maxTokenA: number; maxTokenB: number; liquidity: number }>;

  getOpenPositionQuoteByPrice: (
    tokenMint: PublicKey,
    tokenAmount: OrcaU64,
    priceLower: OrcaU256,
    priceUpper: OrcaU256,
    slippageTolerence?: Percentage
  ) => Promise<{ maxTokenA: number; maxTokenB: number; liquidity: number }>;

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
    tokenMint: PublicKey,
    amount: OrcaU64,
    slippageTolerence?: Percentage
  ) => Promise<any>;

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
}
