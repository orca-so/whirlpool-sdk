import { u64 } from "@solana/spl-token";
import { BN, Provider } from "@project-serum/anchor";
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

export type ClosePositionQuoteParam = {
  position: PublicKey;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type ClosePositionQuote = {
  minTokenA: u64;
  minTokenB: u64;
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
  sqrtPriceLimitX64: BN;
  amountIn: u64;
  amountOut: u64;
  aToB: boolean;
  fixedOutput: boolean;
};

export type OpenPositionTransactionParam = {
  provider: Provider;
  whirlpool: PublicKey;
  quote: OpenPositionQuote;
};

export type OpenPositionTransaction = TransactionExecutable;

export type ClosePositionTransactionParam = {
  provider: Provider;
  positionAuthority?: PublicKey;
  receiver?: PublicKey;
  position: PublicKey;
  quote: ClosePositionQuote;
};

export type ClosePositionTransaction = TransactionExecutable;

export type SwapTransactionParam = {
  provider: Provider;
  whirlpool: PublicKey;
  quote: SwapQuote;
};

export type SwapTransaction = TransactionExecutable;
