import { u64 } from "@solana/spl-token";
import { BN, Provider } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { Percentage } from "../..";

/*** Transactions ***/

export type OpenPositionTxParam = {
  provider: Provider;
  quote: OpenPositionQuote;
};

export type ClosePositionTxParam = {
  provider: Provider;
  quote: ClosePositionQuote;
};

export type SwapTxParam = {
  provider: Provider;
  whirlpool: PublicKey;
  quote: SwapQuote;
};

/*** Quotes ***/

export type OpenPositionQuoteParam = OpenPositionQuoteByPrice | OpenPositionQuoteByTickIndex;

export type OpenPositionQuoteByPrice = BaseOpenPositionQuoteParam & {
  priceLower: Decimal;
  priceUpper: Decimal;
};

export type OpenPositionQuoteByTickIndex = BaseOpenPositionQuoteParam & {
  tickLowerIndex: number;
  tickUpperIndex: number;
};

type BaseOpenPositionQuoteParam = {
  poolAddress: PublicKey;
  tokenMint: PublicKey;
  tokenAmount: u64;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type OpenPositionQuote = {
  poolAddress: PublicKey;
  tickLowerIndex: number;
  tickUpperIndex: number;
  maxTokenA: u64;
  maxTokenB: u64;
  liquidity: u64;
};

export type ClosePositionQuoteParam = {
  positionAddress: PublicKey;
  refresh?: boolean;
  slippageTolerence?: Percentage;
};

export type ClosePositionQuote = {
  positionAddress: PublicKey;
  minTokenA: u64;
  minTokenB: u64;
  liquidity: u64;
};

export type SwapQuoteParam = {
  // TODO(atamari)
  whirlpoolAddress: PublicKey;
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

/*** Type Guards ***/

export function isQuoteByPrice(param: OpenPositionQuoteParam): param is OpenPositionQuoteByPrice {
  return (
    (param as OpenPositionQuoteByPrice).priceLower != null &&
    (param as OpenPositionQuoteByPrice).priceUpper != null
  );
}

export function isQuoteByTickIndex(
  param: OpenPositionQuoteParam
): param is OpenPositionQuoteByTickIndex {
  return (
    (param as OpenPositionQuoteByTickIndex).tickLowerIndex != null &&
    (param as OpenPositionQuoteByTickIndex).tickUpperIndex != null
  );
}
