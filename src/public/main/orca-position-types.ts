import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Percentage, TransactionPayload } from "..";
import { Token } from "../../model/utils";
import { TokenAmount } from "../../model/utils/token/amount";
import { Owner } from "../utils/web3/key-utils";

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
