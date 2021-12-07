import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaCache, OrcaCacheManager } from "../..";
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
} from "../../public";

export class OrcaCacheManagerImpl implements OrcaCacheManager {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;

  private _connection: Connection;
  private _cache: OrcaCache = {};

  constructor(network: Network, connection: Connection) {
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this._connection = connection;
  }

  public async getWhirlpool(address: PublicKey | string): Promise<Whirlpool> {
    return this.get(address, OrcaCacheContentType.Whirlpool);
  }

  public async getPosition(address: PublicKey | string): Promise<Position> {
    return this.get(address, OrcaCacheContentType.Position);
  }

  public async getTickArray(address: PublicKey | string): Promise<TickArray> {
    return this.get(address, OrcaCacheContentType.TickArray);
  }

  private async get(
    address: PublicKey | string,
    type: OrcaCacheContentType
  ): Promise<OrcaCacheContentValue> {
    const cachedValue = this.getCached(address);
    if (cachedValue) {
      return cachedValue;
    }

    return this.add(address, type);
  }

  public getCached(address: PublicKey | string): OrcaCacheContentValue | null {
    const key = OrcaCacheManagerImpl.toAddressString(address);
    return this._cache[key]?.value || null;
  }

  public getCachedAll(): [OrcaCacheKey, OrcaCacheContentValue][] {
    return Object.entries(this._cache).map(([key, content]) => [key, content.value]);
  }

  public async add(
    address: PublicKey | string,
    type: OrcaCacheContentType
  ): Promise<OrcaCacheContentValue> {
    const pk = OrcaCacheManagerImpl.toPublicKey(address);

    let fetch: (() => Promise<OrcaCacheContentValue>) | null = null;

    if (type === OrcaCacheContentType.Whirlpool) {
      fetch = () => Whirlpool.fetch(pk);
    } else if (type === OrcaCacheContentType.Position) {
      fetch = () => Position.fetch(pk);
    } else if (type === OrcaCacheContentType.TickArray) {
      fetch = () => TickArray.fetch(pk);
    } else {
      throw new Error(`${type} is not a known OrcaAccountType`);
    }

    const key = OrcaCacheManagerImpl.toAddressString(address);

    const value = await fetch();
    this._cache[key] = { type, value, fetch };
    return value;
  }

  public async refresh(address: PublicKey | string): Promise<void> {
    const key = OrcaCacheManagerImpl.toAddressString(address);

    const cachedContent = this._cache[key];
    if (!cachedContent) {
      throw new Error("unable to refresh non-existing key");
    }

    const value = await cachedContent.fetch();
    this._cache[key] = { ...cachedContent, value };
  }

  public async refreshAll(): Promise<void> {
    for (const [address, cachedContent] of Object.entries(this._cache)) {
      const value = await cachedContent.fetch();
      this._cache[address] = { ...cachedContent, value };
    }
  }

  private static toAddressString(address: PublicKey | string): string {
    return typeof address === "string" ? address : address.toBase58();
  }

  private static toPublicKey(address: PublicKey | string): PublicKey {
    return typeof address === "string" ? new PublicKey(address) : address;
  }
}
