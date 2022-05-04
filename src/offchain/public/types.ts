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

  priceHistory?: DayWeekMonthData<MinMax>;
  tokenAPriceUSD?: CombinedTokenPrice;
  tokenBPriceUSD?: CombinedTokenPrice;
  tvl?: number;
  volume?: DayWeekMonthData<number>;
  feeApr?: DayWeekMonthData<number>;
  reward0Apr?: DayWeekMonthData<number>;
  reward1Apr?: DayWeekMonthData<number>;
  reward2Apr?: DayWeekMonthData<number>;
  totalApr?: DayWeekMonthData<number>;
};

export interface DayWeekMonthData<T> {
  day: T;
  week: T;
  month: T;
}

export type CombinedTokenPrice = {
  price?: number;
  dex?: number;
  coingecko?: number;
};

export type MinMax = {
  min: number;
  max: number;
};
