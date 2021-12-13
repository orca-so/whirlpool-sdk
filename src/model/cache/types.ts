import { PublicKey } from "@solana/web3.js";
import {
  ParsableEntity,
  PositionAccount,
  TickArrayAccount,
  TokenAccount,
  WhirlpoolAccount,
} from "../entities";

export enum OrcaCacheStrategy {
  AlwaysFetch = "ALWAYS_FETCH",
  Manual = "MANUAL",
}

export type CachedAccount = WhirlpoolAccount | PositionAccount | TickArrayAccount | TokenAccount;

interface CachedContent<T extends CachedAccount> {
  entity: ParsableEntity<T>;
  value: CachedAccount | null;
}

export type OrcaCacheInternal = Record<string, CachedContent<CachedAccount>>;

export interface OrcaCache {
  readonly whirlpoolsConfig: PublicKey;
  readonly programId: PublicKey;

  /**
   * Get a Whirlpool entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getWhirlpool: (address: PublicKey, refresh?: boolean) => Promise<WhirlpoolAccount | null>;

  /**
   * Get a Position entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getPosition: (address: PublicKey, refresh?: boolean) => Promise<PositionAccount | null>;

  /**
   * Get a TickArray entity from the cache.
   * If it doesn't exist in the cache, then fetch, save to cache, then return.
   */
  getTickArray: (address: PublicKey, refresh?: boolean) => Promise<TickArrayAccount | null>;

  /**
   *
   */
  getToken: (address: PublicKey, refresh?: boolean) => Promise<TokenAccount | null>;

  /**
   * Check if an account is in the cache
   */
  isCached: (address: PublicKey) => boolean;

  /**
   * Fetch and add to cache the given list of accounts
   */
  fetchAll: (
    infos: { address: PublicKey; entity: ParsableEntity<CachedAccount> }[]
  ) => Promise<void>;

  /**
   * Update the cached value of all entities currently in the cache.
   */
  refreshAll: () => Promise<void>;

  /**
   * Get whitelisted whirlpools
   */
  getWhitelist: () => Promise<PublicKey>;
}
