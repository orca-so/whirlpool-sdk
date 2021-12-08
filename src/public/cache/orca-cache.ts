import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaCacheInternal, OrcaCacheInterface } from "../..";
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
} from "..";
import invariant from "tiny-invariant";

/**
 * Data Access Layer with basic cache management logic exposed to client.
 */
export class OrcaCache implements OrcaCacheInterface {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;

  private readonly _cache: OrcaCacheInternal = {};
  private readonly _connection: Connection;
  private readonly _strategy: OrcaCacheStrategy;

  constructor(network: Network, connection: Connection, strategy = OrcaCacheStrategy.Manual) {
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this._connection = connection;
    this._strategy = strategy;
  }

  public async getWhirlpool(address: PublicKey, forceRefresh = false): Promise<Whirlpool> {
    return this.get(address, OrcaCacheContentType.Whirlpool, forceRefresh) as Promise<Whirlpool>;
  }

  public async getPosition(address: PublicKey, forceRefresh = false): Promise<Position> {
    return this.get(address, OrcaCacheContentType.Position, forceRefresh) as Promise<Position>;
  }

  public async getTickArray(address: PublicKey, forceRefresh = false): Promise<TickArray> {
    return this.get(address, OrcaCacheContentType.TickArray, forceRefresh) as Promise<TickArray>;
  }

  private async get(
    address: PublicKey,
    type: OrcaCacheContentType,
    forceRefresh: boolean
  ): Promise<OrcaCacheContentValue> {
    const key = address.toBase58();
    const cachedValue: OrcaCacheContentValue | undefined = this._cache[key]?.value;

    if (cachedValue && !forceRefresh) {
      return cachedValue;
    }

    let fetch: (() => Promise<OrcaCacheContentValue>) | null = null;

    if (type === OrcaCacheContentType.Whirlpool) {
      fetch = () => Whirlpool.fetch(this._connection, address);
    } else if (type === OrcaCacheContentType.Position) {
      fetch = () => Position.fetch(this._connection, address);
    } else if (type === OrcaCacheContentType.TickArray) {
      fetch = () => TickArray.fetch(this._connection, address);
    } else {
      throw new Error(`${type} is not a known OrcaAccountType`);
    }

    const value = await fetch();

    if (this._strategy !== OrcaCacheStrategy.AlwaysFetch) {
      this._cache[key] = { type, value, fetch };
    }

    return value;
  }

  public isCached(address: PublicKey): boolean {
    invariant(this._strategy !== OrcaCacheStrategy.AlwaysFetch, "not supported for AlwaysFetch");
    return address.toBase58() in this._cache;
  }

  public getCachedAll(): [OrcaCacheKey, OrcaCacheContentValue][] {
    invariant(this._strategy !== OrcaCacheStrategy.AlwaysFetch, "not supported for AlwaysFetch");
    return Object.entries(this._cache).map(([key, content]) => [key, content.value]);
  }

  /**
   * TODO - use batch account fetch, then parse individually, instead of individual fetch and parse
   */
  public async fetchAll(
    infos: { address: PublicKey; type: OrcaCacheContentType }[]
  ): Promise<void> {
    invariant(this._strategy !== OrcaCacheStrategy.AlwaysFetch, "not supported for AlwaysFetch");
    throw new Error("TODO - implement");
    for (const { address, type } of infos) {
    }
  }

  /**
   * TODO - use batch account fetch, then parse individually, instead of individual fetch and parse
   */
  public async refreshAll(): Promise<void> {
    invariant(this._strategy !== OrcaCacheStrategy.AlwaysFetch, "not supported for AlwaysFetch");
    for (const [key, cachedContent] of Object.entries(this._cache)) {
      const value = await cachedContent.fetch();
      this._cache[key] = { ...cachedContent, value };
    }
  }
}
