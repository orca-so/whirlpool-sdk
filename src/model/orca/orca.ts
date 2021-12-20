import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaNetwork, Orca, OrcaPosition, PositionAccount, WhirlpoolAccount } from "../..";
import { OrcaCacheImpl, OrcaCache, CacheStrategy } from "../cache";

export class OrcaImpl implements Orca {
  private readonly cache: OrcaCache;

  constructor(connection: Connection, network: OrcaNetwork, cache: boolean) {
    const cacheStrategy = cache ? CacheStrategy.Manual : CacheStrategy.AlwaysFetch;
    this.cache = new OrcaCacheImpl(connection, network, cacheStrategy);
  }

  // Address -> dispatch
  // Idea 1: callbacks
  // Idea 1.5: CacheEventManager
  // Idea 2: event listen

  /**
   * Whirlpools
   * 1. Get a list of whirlpools (this list can change when user adds a specific whirlpool)
   * 2. Whenever a whirlpool in this list gets updated, rerender
   */

  /**
   * Positions
   * 1. Get a list of positions that the wallet owns
   * 2. Whenever a position in this list gets updated, rerender
   */

  public async refreshCache(): Promise<void> {
    this.cache.refreshAll();
  }

  public async getWhirlpool(address: PublicKey): Promise<WhirlpoolAccount> {
    throw new Error("Method not implemented.");
  }

  public async getWhirlpoolByTokens(
    tokenA: PublicKey,
    tokenB: PublicKey
  ): Promise<WhirlpoolAccount> {
    throw new Error("Method not implemented.");
  }

  public async getPosition(address: PublicKey): Promise<PositionAccount> {
    throw new Error("Method not implemented.");
  }

  public async getPositionByMint(positionMint: PublicKey): Promise<PositionAccount> {
    throw new Error("Method not implemented.");
  }

  public async listWhirlpools(addresses: PublicKey[]): Promise<WhirlpoolAccount[]> {
    throw new Error("Method not implemented.");
  }

  // maybe crate OrcaUser that keys off of wallet address and cache the result
  // will there be other values cached by wallet address?
  public async listUserPositions(wallet: PublicKey): Promise<PositionAccount[]> {
    return this.cache.listUserPositions(wallet, true);
  }
}
