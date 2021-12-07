import { PublicKey } from "@solana/web3.js";
import { Position, TickArray, Whirlpool } from "..";

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

export type OrcaCache = Record<OrcaCacheKey, OrcaCacheContent>;

export interface OrcaCacheManager {
  /**
   * Get a Whirlpool entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getWhirlpool: (address: PublicKey | string) => Promise<Whirlpool>;

  /**
   * Get a Position entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getPosition: (address: PublicKey | string) => Promise<Position>;

  /**
   * Get a TickArray entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getTickArray: (address: PublicKey | string) => Promise<TickArray>;

  /**
   * Check if an entity with the given address exists.
   * Return the entity if it exists, throw an error if it does not.
   */
  getCached: (address: PublicKey | string) => OrcaCacheContentValue | null;

  /**
   * Return entries of all the key, value pairs in the cache
   */
  getCachedAll: () => [OrcaCacheKey, OrcaCacheContentValue][];

  /**
   * Manually add an entity with the given address and type to the cache.
   */
  add: (address: PublicKey | string, type: OrcaCacheContentType) => Promise<OrcaCacheContentValue>;

  /**
   * Update the cache of the entity with the given address.
   */
  refresh: (address: PublicKey | string) => Promise<void>;

  /**
   * Update the cached value of all entities currently in the cache.
   */
  refreshAll: () => Promise<void>;
}
