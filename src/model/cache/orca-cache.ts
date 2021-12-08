import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaCacheInternal, OrcaCache } from "../..";
import {
  getWhirlpoolProgramId,
  getWhirlpoolsConfig,
  Network,
  OrcaCacheContentType,
  OrcaCacheKey,
  Position,
  TickArray,
  Whirlpool,
  OrcaCacheContentValue,
  OrcaCacheStrategy,
} from "../../public";

/**
 * Data Access Object with cache management logic exposed to client.
 */
export class OrcaCacheImpl implements OrcaCache {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;

  private readonly _cache: OrcaCacheInternal = {};
  private readonly _connection: Connection;
  private readonly _strategy: OrcaCacheStrategy;

  constructor(network: Network, connection: Connection, strategy = OrcaCacheStrategy.AlwaysFetch) {
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this._connection = connection;
    this._strategy = strategy;
  }

  public async getWhirlpool(address: PublicKey | string, forceRefresh = false): Promise<Whirlpool> {
    return this.getGeneric(
      address,
      OrcaCacheContentType.Whirlpool,
      forceRefresh
    ) as Promise<Whirlpool>;
  }

  public async getPosition(address: PublicKey | string, forceRefresh = false): Promise<Position> {
    return this.getGeneric(
      address,
      OrcaCacheContentType.Position,
      forceRefresh
    ) as Promise<Position>;
  }

  public async getTickArray(address: PublicKey | string, forceRefresh = false): Promise<TickArray> {
    return this.getGeneric(
      address,
      OrcaCacheContentType.TickArray,
      forceRefresh
    ) as Promise<TickArray>;
  }

  private async getGeneric(
    address: PublicKey | string,
    type: OrcaCacheContentType,
    forceRefresh: boolean
  ): Promise<OrcaCacheContentValue> {
    const key = typeof address === "string" ? address : address.toBase58();
    const cachedValue: OrcaCacheContentValue | undefined = this._cache[key]?.value;

    /**
     * If there is cached value, and the strategy is not always fetch, and we shouldn't force refresh,
     * then return the cached value.
     */
    if (cachedValue && this._strategy !== OrcaCacheStrategy.AlwaysFetch && !forceRefresh) {
      return cachedValue;
    }

    const pk = typeof address === "string" ? new PublicKey(address) : address;

    let fetch: (() => Promise<OrcaCacheContentValue>) | null = null;

    if (type === OrcaCacheContentType.Whirlpool) {
      fetch = () => Whirlpool.fetch(this._connection, pk);
    } else if (type === OrcaCacheContentType.Position) {
      fetch = () => Position.fetch(this._connection, pk);
    } else if (type === OrcaCacheContentType.TickArray) {
      fetch = () => TickArray.fetch(this._connection, pk);
    } else {
      throw new Error(`${type} is not a known OrcaAccountType`);
    }

    const value = await fetch();
    this._cache[key] = { type, value, fetch };
    return value;
  }

  public getCachedAll(): [OrcaCacheKey, OrcaCacheContentValue][] {
    return Object.entries(this._cache).map(([key, content]) => [key, content.value]);
  }

  /**
   * TODO - use batch account fetch, then parse individually, instead of individual fetch and parse
   */
  public async refreshAll(): Promise<void> {
    for (const [address, cachedContent] of Object.entries(this._cache)) {
      const value = await cachedContent.fetch();
      this._cache[address] = { ...cachedContent, value };
    }
  }
}
