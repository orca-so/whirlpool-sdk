import { PublicKey } from "@solana/web3.js";
import { Position, TickArray, Whirlpool } from "../entities";

export enum OrcaCacheStrategy {
  AlwaysFetch = "ALWAYS_FETCH",
  Manual = "MANUAL",
}

export enum OrcaCacheContentType {
  Whirlpool = "WHIRLPOOL",
  Position = "POSITION",
  TickArray = "TICK_ARRAY",
}

export type OrcaCacheContentValue = Whirlpool | Position | TickArray;

interface OrcaCacheContent {
  type: OrcaCacheContentType;
  value: OrcaCacheContentValue;
  fetch: () => Promise<OrcaCacheContentValue>;
}

export type OrcaCacheKey = string;

export type OrcaCacheInternal = Record<OrcaCacheKey, OrcaCacheContent>;

export interface OrcaCacheInterface {
  /**
   * Get a Whirlpool entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getWhirlpool: (address: PublicKey, refresh?: boolean) => Promise<Whirlpool>;

  /**
   * Get a Position entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getPosition: (address: PublicKey, refresh?: boolean) => Promise<Position>;

  /**
   * Get a TickArray entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getTickArray: (address: PublicKey, refresh?: boolean) => Promise<TickArray>;

  /**
   * Check if an account is in the cache
   */
  isCached: (address: PublicKey) => boolean;

  /**
   * Return entries of all the key-value pairs in the cache
   */
  getCachedAll: () => [OrcaCacheKey, OrcaCacheContentValue][];

  /**
   * Fetch and add to cache the given list of accounts
   */
  fetchAll: (infos: { address: PublicKey; type: OrcaCacheContentType }[]) => Promise<void>;

  /**
   * Update the cached value of all entities currently in the cache.
   */
  refreshAll: () => Promise<void>;
}
