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

      const response = await this._request.request({
        url: "/token/list",
        method: "get",
        params: { whitelisted: true },
      });
      const tokens = response?.data?.tokens;
      if (!tokens) {
        return null;
      }

      const result: Record<string, OffchainTokenData> = {};
      tokens.forEach((token: any) => {
        result[token.mint] = {
          mint: token.mint,
          name: token.name,
          symbol: token.symbol,
          logoURI: token.logoURI,
          whitelisted: token.whitelisted,
          coingeckoId: token.coingeckoId,
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

      const response = await this._request.request({
        url: "/whirlpool/list",
        method: "get",
        params: { whitelisted: true },
      });
      const whirlpools = response?.data?.whirlpools;
      if (!whirlpools) {
        return null;
      }

      const result: Record<string, OffchainPoolData> = {};
      whirlpools.forEach((pool: any) => {
        result[pool.address] = {
          address: pool.address,
          whitelisted: pool.whitelisted,
          tokenMintA: pool.tokenA.mint,
          tokenMintB: pool.tokenB.mint,
          stable: pool.stable,
          price: pool.price,
          lpsFeeRate: pool.lpFeeRate,
          protocolFeeRate: pool.protocolFeeRate,
          priceHistory: pool.priceRange,
          tvl: pool.tvl,
          volume: pool.volume,
          feeApr: pool.feeApr,
          reward0Apr: pool.reward0Apr,
          reward1Apr: pool.reward1Apr,
          reward2Apr: pool.reward2Apr,
          totalApr: pool.totalApr,
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
    if (!content || Date.now() >= content.eol) {
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
