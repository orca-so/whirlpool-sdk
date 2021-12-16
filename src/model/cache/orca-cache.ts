import { Connection, PublicKey } from "@solana/web3.js";
import { CachedAccount, CacheStrategy, OrcaCache, CacheStore } from ".";
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
import { OrcaNetwork } from "../..";

export class OrcaCacheImpl implements OrcaCache {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;

  private readonly _cache: CacheStore = {};
  private readonly _connection: Connection;
  private readonly _strategy: CacheStrategy;

  constructor(connection: Connection, network: OrcaNetwork, strategy = CacheStrategy.Manual) {
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this._connection = connection;
    this._strategy = strategy;
  }

  public async getWhirlpool(address: PublicKey, refresh = false): Promise<WhirlpoolAccount | null> {
    return this.get(address, Whirlpool, refresh);
  }

  public async getPosition(address: PublicKey, refresh = false): Promise<PositionAccount | null> {
    return this.get(address, Position, refresh);
  }

  public async getTickArray(address: PublicKey, refresh = false): Promise<TickArrayAccount | null> {
    return this.get(address, TickArray, refresh);
  }

  public async getToken(address: PublicKey, refresh = false): Promise<TokenAccount | null> {
    return this.get(address, TokenEntity, refresh);
  }

  public async getUserTokens(user: PublicKey): Promise<any> {
    const { value: userTokenAccountsInfo } = await this._connection.getParsedTokenAccountsByOwner(
      user,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    const mintsAndNulls = userTokenAccountsInfo.map((accountInfo) => {
      const amount: string = accountInfo.account.data.parsed.info.tokenAmount.amount;
      if (amount !== "1") {
        return null;
      }

      return new PublicKey(accountInfo.account.data.parsed.info.mint);
    });
    const mints = mintsAndNulls.filter((address): address is PublicKey => address !== null);

    const addresses = mints.map((mint) => Position.deriveAddress(mint, this.programId));
    const infos = addresses.map((address) => ({ address, entity: Position }));
    await this.fetchAll(infos);

    const allAccounts = await Promise.all(addresses.map((address) => this.getPosition(address)));
    const validAccounts = allAccounts.filter(
      (account): account is PositionAccount => account !== null
    );
    return validAccounts;
  }

  private async get<T extends CachedAccount>(
    address: PublicKey,
    entity: ParsableEntity<T>,
    refresh: boolean
  ): Promise<T | null> {
    const key = address.toBase58();
    const cachedValue: CachedAccount | null | undefined = this._cache[key]?.value;
    const alwaysFetch = this._strategy === CacheStrategy.AlwaysFetch;

    // TODO - currently we store null in cache. is this the correct behavior?
    if (cachedValue !== undefined && !refresh && !alwaysFetch) {
      return cachedValue as T | null;
    }

    const accountInfo = await this._connection.getAccountInfo(address, "singleGossip");
    const accountData = accountInfo?.data;
    const value = entity.parse(accountData);
    this._cache[key] = { entity, value };

    return value;
  }

  public isCached(address: PublicKey): boolean {
    return address.toBase58() in this._cache;
  }

  public async fetchAll(
    infos: { address: PublicKey; entity: ParsableEntity<CachedAccount> }[]
  ): Promise<void> {
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
