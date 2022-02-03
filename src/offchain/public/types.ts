/*** Token ***/

export type OffchainTokenData = {
  mint: string;
  name: string;
  symbol: string;
  logoURI: string;
  whitelisted: boolean;
  coingeckoId?: string;
  ftxId?: string;
};

/*** Pool ***/

export type OffchainPoolData = {
  address: string;
  whitelisted: boolean;
  tokenMintA: string;
  tokenMintB: string;
  stable: boolean;
  price: number;
  lpsFeeRate: number;
  protocolFeeRate: number;

  tokenAPriceUSD?: CombinedTokenPrice;
  tokenBPriceUSD?: CombinedTokenPrice;
  tvl?: number;
  volume?: DayWeekMonthData;
  feeApr?: DayWeekMonthData;
  reward0Apr?: DayWeekMonthData;
  reward1Apr?: DayWeekMonthData;
  reward2Apr?: DayWeekMonthData;
};

export type DayWeekMonthData = {
  day: number;
  week: number;
  month: number;
};

export type CombinedTokenPrice = {
  price?: number;
  dex?: number;
  coingecko?: number;
};
