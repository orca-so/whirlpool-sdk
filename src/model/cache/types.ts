import { PublicKey } from "@solana/web3.js";
import {
  ParsableEntity,
  PositionAccount,
  TickArrayAccount,
  TokenAccount,
  WhirlpoolAccount,
} from "../entities";

/**
 * Determines if OrcaCache should utilize the internal cache or not.
 */
export enum CacheStrategy {
  /**
   * Do not use cache. Always fetch the latest account info from rpc.
   */
  AlwaysFetch = "ALWAYS_FETCH",

  /**
   * Use cache. The client is responsible for cache refresh.
   */
  Manual = "MANUAL",
}

export type CachedAccount = WhirlpoolAccount | PositionAccount | TickArrayAccount | TokenAccount;

/**
 * Include both the entity (i.e. type) of the stored value, and the value itself
 */
interface CachedContent<T extends CachedAccount> {
  entity: ParsableEntity<T>;
  value: CachedAccount | null;
}

/**
 * Map PublicKey.toBase58() to CachedContent
 */
export type CacheStore = Record<string, CachedContent<CachedAccount>>;

/**
 * Data access layer for accounts used by OrcaWhirlpool and OrcaPosition.
 * The types of accounts that are being used are defined by CachedAccount.
 * Includes internal cache that can be refreshed by the client.
 */
export interface OrcaCache {
  readonly whirlpoolsConfig: PublicKey;
  readonly programId: PublicKey;

  /**
   * Get a Whirlpool account from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   * If _refresh_ is true, then ignore the cached value, then fetch, save to cache, and return.
   */
  getWhirlpool: (address: PublicKey, refresh?: boolean) => Promise<WhirlpoolAccount | null>;

  /**
   * Get a Position account from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   * If _refresh_ is true, then ignore the cached value, then fetch, save to cache, and return.
   */
  getPosition: (address: PublicKey, refresh?: boolean) => Promise<PositionAccount | null>;

  /**
   * Get a TickArray account from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   * If _refresh_ is true, then ignore the cached value, then fetch, save to cache, and return.
   */
  getTickArray: (address: PublicKey, refresh?: boolean) => Promise<TickArrayAccount | null>;

  /**
   * Get a Token account from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   * If _refresh_ is true, then ignore the cached value, then fetch, save to cache, and return.
   */
  getToken: (address: PublicKey, refresh?: boolean) => Promise<TokenAccount | null>;

  /**
   * Check if an account is in the cache
   * TODO: not sure if we need this. delete?
   */
  isCached: (address: PublicKey) => boolean;

  /**
   * Fetch and add to cache the list of accounts.
   * Uses batched rpc request for network efficient fetch.
   * Use case: initializing the cache with a list of whitelisted accounts
   */
  fetchAll: (
    infos: { address: PublicKey; entity: ParsableEntity<CachedAccount> }[]
  ) => Promise<void>;

  /**
   * Update the cached value of all entities currently in the cache.
   * Uses batched rpc request for network efficient fetch.
   */
  refreshAll: () => Promise<void>;
}
