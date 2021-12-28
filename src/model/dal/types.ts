import { PublicKey } from "@solana/web3.js";
import { PositionData, TickArrayData, TokenData, WhirlpoolData } from "../..";
import { ParsableEntity } from "../entities";

export type CachedValue = WhirlpoolData | PositionData | TickArrayData | TokenData;

/**
 * Include both the entity (i.e. type) of the stored value, and the value itself
 */
interface CachedContent<T extends CachedValue> {
  entity: ParsableEntity<T>;
  value: CachedValue | null;
}

/**
 * Map PublicKey.toBase58() to CachedContent
 */
export type InternalCacheStore = Record<string, CachedContent<CachedValue>>;

/**
 * Data access layer for accounts used by OrcaWhirlpool and OrcaPosition.
 * The types of accounts that are being used are defined by CachedAccount.
 * Includes internal cache that can be refreshed by the client.
 */
export interface OrcaDAL {
  readonly whirlpoolsConfig: PublicKey;
  readonly programId: PublicKey;

  /**
   * Get a Whirlpool account from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   * If _refresh_ is true, then ignore the cached value, then fetch, save to cache, and return.
   */
  getWhirlpool: (address: PublicKey, refresh?: boolean) => Promise<WhirlpoolData | null>;

  /**
   * Get a Position account from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   * If _refresh_ is true, then ignore the cached value, then fetch, save to cache, and return.
   */
  getPosition: (address: PublicKey, refresh?: boolean) => Promise<PositionData | null>;

  /**
   * Get a TickArray account from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   * If _refresh_ is true, then ignore the cached value, then fetch, save to cache, and return.
   */
  getTickArray: (address: PublicKey, refresh?: boolean) => Promise<TickArrayData | null>;

  /**
   * Get a Token account from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   * If _refresh_ is true, then ignore the cached value, then fetch, save to cache, and return.
   */
  getToken: (address: PublicKey, refresh?: boolean) => Promise<TokenData | null>;

  listWhirlpools: (addresses: PublicKey[], refresh?: boolean) => Promise<(WhirlpoolData | null)[]>;

  listPositions: (addresses: PublicKey[], refresh?: boolean) => Promise<(PositionData | null)[]>;

  listTickArrays: (addresses: PublicKey[], refresh?: boolean) => Promise<(TickArrayData | null)[]>;

  listTokens: (addresses: PublicKey[], refresh?: boolean) => Promise<(TokenData | null)[]>;

  /**
   * Update the cached value of all entities currently in the cache.
   * Uses batched rpc request for network efficient fetch.
   */
  refreshAll: () => Promise<void>;

  listUserPositions: (wallet: PublicKey) => Promise<PositionData[]>;
}
