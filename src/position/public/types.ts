import { Address, BN, Provider } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
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
  resolvedAssociatedTokenAddresses?: Record<string, PublicKey>;
};

export type CollectMultipleFeesAndRewardsTxParam = {
  provider: Provider;
  positionAddresses: Address[];
  resolvedAssociatedTokenAddresses?: Record<string, PublicKey>;
};

/*** Quotes ***/

export type AddLiquidityQuoteParam = {
  positionAddress: Address;
  tokenMint: Address;
  tokenAmount: BN;
  refresh: boolean;
  slippageTolerance?: Percentage;
};

export type AddLiquidityQuote = {
  positionAddress: Address;
  maxTokenA: BN;
  maxTokenB: BN;
  liquidity: BN;
};

export type RemoveLiquidityQuoteParam = {
  positionAddress: Address;
  liquidity: BN;
  refresh: boolean;
  slippageTolerance?: Percentage;
};

export type RemoveLiquidityQuote = {
  positionAddress: Address;
  minTokenA: BN;
  minTokenB: BN;
  liquidity: BN;
};

export type CollectFeesQuote = {
  feeOwedA: BN;
  feeOwedB: BN;
};

export type CollectRewardsQuote = [BN | undefined, BN | undefined, BN | undefined];
