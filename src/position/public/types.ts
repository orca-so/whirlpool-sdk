import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Percentage } from "../../utils/public/percentage";

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

export type CollectRewardsQuote = {
  rewardOwedA?: u64;
  rewardOwedB?: u64;
  rewardOwedC?: u64;
};

export enum PositionStatus {
  BelowRange,
  InRange,
  AboveRange,
}
