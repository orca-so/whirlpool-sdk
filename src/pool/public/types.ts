import { u64 } from "@solana/spl-token";
import { Address, BN, Provider } from "@project-serum/anchor";
import Decimal from "decimal.js";
import { Percentage } from "../../utils/public/percentage";

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
  quote: SwapQuote;
};

export type FillTickArraysParam = {
  provider: Provider;
  poolAddress: Address;
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
  poolAddress: Address;
  tokenMint: Address;
  tokenAmount: u64;
  refresh: boolean;
  slippageTolerance?: Percentage;
};

export type OpenPositionQuote = {
  poolAddress: Address;
  tickLowerIndex: number;
  tickUpperIndex: number;
  maxTokenA: u64;
  maxTokenB: u64;
  liquidity: BN;
};

export type ClosePositionQuoteParam = {
  positionAddress: Address;
  refresh: boolean;
  slippageTolerance?: Percentage;
};

export type ClosePositionQuote = {
  positionAddress: Address;
  minTokenA: u64;
  minTokenB: u64;
  liquidity: BN;
};

export type SwapQuoteParam = {
  poolAddress: Address;
  tokenMint: Address;
  tokenAmount: u64;
  isInput: boolean;
  slippageTolerance?: Percentage;
  refresh: boolean;
};

export type SwapQuote = {
  poolAddress: Address;
  otherAmountThreshold: u64;
  sqrtPriceLimitX64: BN;
  amountIn: u64;
  amountOut: u64;
  aToB: boolean;
  fixedInput: boolean;
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
