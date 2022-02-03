import axios, { AxiosInstance } from "axios";
import { OffchainTokenData, OffchainPoolData } from "./public/types";

const CacheKey_Tokens = "tokens";
const CacheKey_Pools = "pools";

type ZPData = Record<string, OffchainTokenData> | Record<string, OffchainPoolData>;

/**
 * Offchain data accessor.
 */
export class OrcaZooplankton {
  private readonly _request: AxiosInstance;
  private readonly _cache: InternalZPCache<ZPData> = new InternalZPCache();

  constructor(dataSourceURI: string) {
    this._request = axios.create({ baseURL: dataSourceURI });
  }

  public async getTokens(): Promise<Record<string, OffchainTokenData> | null> {
    try {
      const cachedResponse = this._cache.get(CacheKey_Tokens);
      if (cachedResponse) {
        return cachedResponse as Record<string, OffchainTokenData>;
      }

      const response = await this._request.request({ url: "/tokens", method: "get" });
      const data = response?.data;
      if (!data) {
        return null;
      }

      const result: Record<string, OffchainTokenData> = {};
      data.forEach((token: any) => {
        result[token.mint] = {
          mint: token.mint,
          name: token.name,
          symbol: token.symbol,
          logoURI: token.logoURI,
          whitelisted: token.whitelisted,
          coingeckoId: token.coingeckoId,
          ftxId: token.ftxId,
        };
      });

      this._cache.set(CacheKey_Tokens, result);
      return result;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  public async getPools(): Promise<Record<string, OffchainPoolData> | null> {
    try {
      const cachedResponse = this._cache.get(CacheKey_Pools);
      if (cachedResponse) {
        return cachedResponse as Record<string, OffchainPoolData>;
      }

      const response = await this._request.request({ url: "/pools", method: "get" });
      const data = response?.data;
      if (!data) {
        return null;
      }

      const result: Record<string, OffchainPoolData> = {};
      data.forEach((pool: any) => {
        result[pool.address] = {
          address: pool.address,
          whitelisted: pool.whitelisted,
          tokenMintA: pool.tokenMintA,
          tokenMintB: pool.tokenMintB,
          price: pool.price,
          lpsFeeRate: pool.lpsFeeRate,
          protocolFeeRate: pool.protocolFeeRate,
          tokenAPriceUSD: pool.tokenAPriceUSD,
          tokenBPriceUSD: pool.tokenBPriceUSD,
          tvl: pool.tvl,
          volume: pool.volume,
          feeApr: pool.feeApr,
          reward0Apr: pool.reward0Apr,
          reward1Apr: pool.reward1Apr,
          reward2Apr: pool.reward2Apr,
        };
      });

      this._cache.set(CacheKey_Pools, result);
      return result;
    } catch (e) {
      console.error(e);
      return null;
    }
  }
}

/*** Internal Cache ***/

class InternalZPCache<T> {
  private readonly _cache: Record<string, { value: T; eol: number }> = {};

  /**
   * Retrieves cached response if it exists and has not expired
   */
  public get(key: string): T | null {
    const content = this._cache[key];
    if (!content || content.eol >= Date.now()) {
      return null;
    }
    return content.value;
  }

  /**
   * Stores the response in cache with time-to-live default to 15 seconds.
   */
  public set(key: string, value: T, ttl = 15_000): void {
    this._cache[key] = { value, eol: Date.now() + ttl };
  }
}
