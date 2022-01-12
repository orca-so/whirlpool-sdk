import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../..";

export type InitPoolTransactionParam = {
  initialSqrtPrice: any;
};

export type OpenPositionQuoteParam = {
  tokenMint: PublicKey;
  tokenAmount: u64;
  tickLowerIndex: number;
  tickUpperIndex: number;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type OpenPositionQuote = {
  maxTokenA: u64;
  maxTokenB: u64;
  liquidity: u64;
};

// export interface OrcaWhirlpool {
//   getInitPoolTransaction: (initialSqrtPrice: any) => Promise<any>;

//   getOpenPositionQuote: (
//     tokenMint: PublicKey,
//     tokenAmount: u64,
//     tickLowerIndex: number,
//     tickUpperIndex: number,
//     slippageTolerence?: Percentage
//   ) => Promise<{ maxTokenA: u64; maxTokenB: u64; liquidity: u64 }>;

// create lp position
// getOpenPositionTransaction: (
//   owner: Owner,
//   tokenAccountA: any,
//   tokenAccountB: any,
//   token: any,
//   tokenAmount: any,
//   tickLowerIndex: number,
//   tickUpperIndex: number,
//   slippageTolerence?: Percentage
// ) => Promise<any>;

// getSwapQuote: (
//   swapAmount: SwapAmount<A, B>,
//   slippageTolerence?: Percentage
// ) => Promise<SwapQuote<A, B>>;

// // TODO this needs to do some precalculation on sdk side to pass in tick array
// // accounts that need to be traversed by contract
// getSwapTransaction: (
//   owner: Owner,
//   tokenAccountA: any,
//   tokenAccountB: any,
//   amount: any,
//   slippageTolerence?: Percentage
// ) => Promise<any>;

// loadTickArray: (tickIndex: number) => Promise<TickArrayAccount>;

// // return distribution of liquidity
// // required to visualize liquidity in UI
// getLiquidityDistribution: () => Promise<any>;

// // return the suggested price range
// getSuggestedPriceRange: (conservative: boolean) => Promise<any>;
// }
