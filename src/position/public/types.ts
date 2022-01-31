import { Address, Provider } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Percentage } from "../../utils/public/percentage";

/*** Transactions ***/

export type AddLiquidityTxParam = {
  provider: Provider;
  quote: AddLiquidityQuote;
};

export type RemoveLiquidityTxParam = {
  provider: Provider;
  quote: RemoveLiquidityQuote;
};

export type CollectFeesAndRewardsTxParam = {
  provider: Provider;
  positionAddress: Address;
};

/*** Quotes ***/

export type AddLiquidityQuoteParam = {
  positionAddress: Address;
  tokenMint: Address;
  tokenAmount: u64;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type AddLiquidityQuote = {
  positionAddress: Address;
  maxTokenA: u64;
  maxTokenB: u64;
  liquidity: u64;
};

export type RemoveLiquidityQuoteParam = {
  positionAddress: Address;
  liquidity: u64;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type RemoveLiquidityQuote = {
  positionAddress: Address;
  minTokenA: u64;
  minTokenB: u64;
  liquidity: u64;
};

export type CollectFeesQuote = {
  feeOwedA: u64;
  feeOwedB: u64;
};

export type CollectRewardsQuote = [u64 | undefined, u64 | undefined, u64 | undefined];
