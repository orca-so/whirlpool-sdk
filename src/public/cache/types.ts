import { PublicKey } from "@solana/web3.js";
import { Position, TickArray, Whirlpool } from "..";

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

export interface OrcaCache {
  /**
   * Get a Whirlpool entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getWhirlpool: (address: PublicKey | string, refresh?: boolean) => Promise<Whirlpool>;

  /**
   * Get a Position entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getPosition: (address: PublicKey | string, refresh?: boolean) => Promise<Position>;

  /**
   * Get a TickArray entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getTickArray: (address: PublicKey | string, refresh?: boolean) => Promise<TickArray>;

  /**
   * Return entries of all the key, value pairs in the cache
   */
  getCachedAll: () => [OrcaCacheKey, OrcaCacheContentValue][];

  /**
   * Update the cached value of all entities currently in the cache.
   */
  refreshAll: () => Promise<void>;
}
