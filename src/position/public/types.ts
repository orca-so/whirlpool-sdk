import { Provider } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../../utils/public/percentage";

/*** Transactions ***/

export type AddLiquidityTransactionParam = {
  provider: Provider;
  address: PublicKey;
  quote: AddLiquidityQuote;
};

export type RemoveLiquidityTransactionParam = {
  provider: Provider;
  address: PublicKey;
  quote: RemoveLiquidityQuote;
};

export type CollectFeesAndRewardsTransactionParam = {
  provider: Provider;
  address: PublicKey;
};

/*** Quotes ***/

export type AddLiquidityQuoteParam = {
  address: PublicKey;
  tokenMint: PublicKey;
  tokenAmount: u64;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type AddLiquidityQuote = {
  maxTokenA: u64;
  maxTokenB: u64;
  liquidity: u64;
};

export type RemoveLiquidityQuoteParam = {
  address: PublicKey;
  liquidity: u64;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type RemoveLiquidityQuote = {
  minTokenA: u64;
  minTokenB: u64;
  liquidity: u64;
};

export type CollectFeesQuoteParam = {
  address: PublicKey;
  refresh?: boolean;
};

export type CollectFeesQuote = {
  feeOwedA: u64;
  feeOwedB: u64;
};

export type CollectRewardsQuoteParam = {
  address: PublicKey;
  refresh?: boolean;
};

export type CollectRewardsQuote = [u64 | undefined, u64 | undefined, u64 | undefined];
