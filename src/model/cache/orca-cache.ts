import { Connection, PublicKey } from "@solana/web3.js";
import { CachedAccount, OrcaCacheStrategy, OrcaCache, OrcaCacheInternal } from ".";
import invariant from "tiny-invariant";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "../../constants";
import {
  ParsableEntity,
  PositionAccount,
  Position,
  TickArrayAccount,
  TickArray,
  TokenAccount,
  TokenEntity,
  WhirlpoolAccount,
  Whirlpool,
} from "../entities";
import { Network } from "../..";

/**
 * Data Access Layer with basic cache management logic exposed to client.
 */
export class OrcaCacheImpl implements OrcaCache {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;

  private readonly _cache: OrcaCacheInternal = {};
  private readonly _connection: Connection;
  private readonly _strategy: OrcaCacheStrategy;

  constructor(connection: Connection, network: Network, strategy = OrcaCacheStrategy.Manual) {
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this._connection = connection;
    this._strategy = strategy;
  }

  public async getWhirlpool(
    address: PublicKey,
    forceRefresh = false
  ): Promise<WhirlpoolAccount | null> {
    return this.get(address, Whirlpool, forceRefresh);
  }

  public async getPosition(
    address: PublicKey,
    forceRefresh = false
  ): Promise<PositionAccount | null> {
    return this.get(address, Position, forceRefresh);
  }

  public async getTickArray(
    address: PublicKey,
    forceRefresh = false
  ): Promise<TickArrayAccount | null> {
    return this.get(address, TickArray, forceRefresh);
  }

  public async getToken(address: PublicKey, forceRefresh = false): Promise<TokenAccount | null> {
    return this.get(address, TokenEntity, forceRefresh);
  }

  private async get<T extends CachedAccount>(
    address: PublicKey,
    entity: ParsableEntity<T>,
    forceRefresh: boolean
  ): Promise<T | null> {
    const key = address.toBase58();
    const cachedValue: CachedAccount | null | undefined = this._cache[key]?.value;

    // TODO - currently we store null in cache. is this the correct behavior?
    if (cachedValue !== undefined && !forceRefresh) {
      return cachedValue as T;
    }

    const accountInfo = await this._connection.getAccountInfo(address, "singleGossip");
    const accountData = accountInfo?.data;
    const value = entity.parse(accountData);

    if (this._strategy !== OrcaCacheStrategy.AlwaysFetch) {
      this._cache[key] = { value, entity };
    }

    return value;
  }

  public isCached(address: PublicKey): boolean {
    invariant(this._strategy !== OrcaCacheStrategy.AlwaysFetch, "not supported for AlwaysFetch");
    return address.toBase58() in this._cache;
  }

  public async fetchAll(
    infos: { address: PublicKey; entity: ParsableEntity<CachedAccount> }[]
  ): Promise<void> {
    invariant(this._strategy !== OrcaCacheStrategy.AlwaysFetch, "not supported for AlwaysFetch");

    const addresses: string[] = infos.map((info) => info.address.toBase58());
    const requests = addresses.map((address: string) => ({
      methodName: "getAccountInfo",
      args: this._connection._buildArgs([address], "singleGossip"),
    }));

    const results: any[] | null = await (this._connection as any)._rpcBatchRequest(requests);
    invariant(results !== null, "fetchAll no results");
    invariant(addresses.length === results.length, "fetchAll not enough results");

    for (const [idx, { address, entity }] of infos.entries()) {
      const data: Buffer | null = results[idx].result.value.data;
      const value = entity.parse(data);

      const key = address.toBase58();
      this._cache[key] = { entity, value };
    }
  }

  public async refreshAll(): Promise<void> {
    invariant(this._strategy !== OrcaCacheStrategy.AlwaysFetch, "not supported for AlwaysFetch");

    const addresses: string[] = Object.keys(this._cache);
    const requests = addresses.map((address: string) => ({
      methodName: "getAccountInfo",
      args: this._connection._buildArgs([address], "singleGossip"),
    }));

    const results: any[] | null = await (this._connection as any)._rpcBatchRequest(requests);
    invariant(results !== null, "refreshAll no results");
    invariant(addresses.length === results.length, "refreshAll not enough results");

    for (const [idx, [key, cachedContent]] of Object.entries(this._cache).entries()) {
      const entity = cachedContent.entity;
      const data: Buffer | null = results[idx].result.value.data;
      const value = entity.parse(data);

      this._cache[key] = { entity, value };
    }
  }
}
