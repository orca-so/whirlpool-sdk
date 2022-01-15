import { TransactionPayload } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { u64 } from "@solana/spl-token";
import { Provider } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { Percentage } from "../..";
import { TransactionExecutable } from "../../utils/public/transaction-executable";

export type OpenPositionQuoteParam = {
  whirlpoolAddress: PublicKey;
  tokenMint: PublicKey;
  tokenAmount: u64;
  priceLower: Decimal;
  priceUpper: Decimal;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type OpenPositionQuote = {
  maxTokenA: u64;
  maxTokenB: u64;
  liquidity: u64;
  tickLowerIndex: number;
  tickUpperIndex: number;
};

export type SwapQuoteParam = {
  // TODO(atamari)
  whirlpool: PublicKey;
  tokenMint: PublicKey;
  tokenAmount: u64;
  isOutput?: boolean;
  slippageTolerance?: Percentage;
  refresh?: boolean;
};

export type SwapQuote = {
  // TODO(atamari)
  sqrtPriceLimitX64: Decimal;
  amountIn: Decimal;
  amountOut: Decimal;
  fixedOutput: boolean;
};

export type OpenPositionTransactionParam = {
  provider: Provider;
  whirlpool: PublicKey;
  quote: OpenPositionQuote;
};

export type OpenPositionTransaction = TransactionExecutable;

export type ClosePositionTransactionParam = {
  // TODO(atamari)
};

export type ClosePositionTransaction = TransactionPayload;

export type SwapTransactionParam = {
  // TODO(atamari)
};

export type SwapTransaction = TransactionPayload;

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
