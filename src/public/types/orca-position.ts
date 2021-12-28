import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Percentage, TransactionPayload } from "..";
import { Token } from "../../model/utils";
import { TokenAmount } from "../../model/utils/token/amount";
import { Owner } from "../utils/web3/key-utils";

export type OrcaPositionArgs = {
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

export type CollectRewardsQuote<R1 extends Token, R2 extends Token, R3 extends Token> = {
  rewardOwedA?: TokenAmount<R1>;
  rewardOwedB?: TokenAmount<R2>;
  rewardOwedC?: TokenAmount<R3>;
};

export enum PositionStatus {
  BelowRange,
  InRange,
  AboveRange,
}

export interface OrcaPosition {
  getAddLiquidityQuote<A extends Token, B extends Token>(
    tokenAmount: TokenAmount<A> | TokenAmount<B>,
    slippageTolerence?: Percentage
  ): Promise<AddLiquidityQuote<A, B>>;

  getAddLiquidityTransaction<A extends Token, B extends Token>(
    owner: Owner,
    quote: AddLiquidityQuote<A, B>
  ): Promise<TransactionPayload>;

  getRemoveLiquidityQuote<A extends Token, B extends Token>(
    liquidity: u64,
    slippageTolerence?: Percentage
  ): Promise<RemoveLiquidityQuote<A, B>>;

  getRemoveLiquidityTransaction<A extends Token, B extends Token>(
    owner: Owner,
    quote: RemoveLiquidityQuote<A, B>
  ): Promise<TransactionPayload>;

  getCollectFeesQuote<A extends Token, B extends Token>(): Promise<CollectFeesQuote<A, B>>;

  getCollectRewardsQuote<R1 extends Token, R2 extends Token, R3 extends Token>(): Promise<
    CollectRewardsQuote<R1, R2, R3>
  >;

  getCollectFeesAndRewardsTransaction(owner: Owner): Promise<TransactionPayload>;
}
