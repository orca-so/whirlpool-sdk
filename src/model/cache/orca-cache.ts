import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { CachedAccount, CacheStrategy, OrcaCache, CacheStore } from ".";
import invariant from "tiny-invariant";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "../../constants";
import {
  ParsableEntity,
  PositionEntity,
  TickArrayEntity,
  TokenEntity,
  WhirlpoolEntity,
} from "../entities";
import {
  OrcaNetwork,
  PositionAccount,
  TickArrayAccount,
  TokenAccount,
  WhirlpoolAccount,
} from "../..";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// TODO part of config
const COMMITMENT: Commitment = "singleGossip";

export class OrcaCacheImpl implements OrcaCache {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;

  private readonly _cache: CacheStore = {};
  private readonly _connection: Connection;
  private readonly _strategy: CacheStrategy;

  /*** listUserPositions ***/
  private _userWallet: PublicKey | null = null;
  private _userPositions: PositionAccount[] | null = null;

  constructor(
    connection: Connection,
    network: OrcaNetwork,
    strategy = CacheStrategy.Manual,
    callback?: (key: string) => void
  ) {
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this._connection = connection;
    this._strategy = strategy;
  }

  /*** Public Methods ***/

  public async getWhirlpool(address: PublicKey, refresh = false): Promise<WhirlpoolAccount | null> {
    return this.get(address, WhirlpoolEntity, refresh);
  }

  public async getPosition(address: PublicKey, refresh = false): Promise<PositionAccount | null> {
    return this.get(address, PositionEntity, refresh);
  }

  public async getTickArray(address: PublicKey, refresh = false): Promise<TickArrayAccount | null> {
    return this.get(address, TickArrayEntity, refresh);
  }

  public async getToken(address: PublicKey, refresh = false): Promise<TokenAccount | null> {
    return this.get(address, TokenEntity, refresh);
  }

  public async listWhirlpools(
    addresses: PublicKey[],
    refresh = false
  ): Promise<WhirlpoolAccount[]> {
    return this.list(addresses, WhirlpoolEntity, refresh);
  }

  public async listPositions(addresses: PublicKey[], refresh = false): Promise<PositionAccount[]> {
    return this.list(addresses, PositionEntity, refresh);
  }

  public async listTickArrays(
    addresses: PublicKey[],
    refresh = false
  ): Promise<TickArrayAccount[]> {
    return this.list(addresses, TickArrayEntity, refresh);
  }

  public async listTokens(addresses: PublicKey[], refresh = false): Promise<TokenAccount[]> {
    return this.list(addresses, TokenEntity, refresh);
  }

  public async refreshAll(): Promise<void> {
    const addresses: string[] = Object.keys(this._cache);
    const data = await this.bulkRequest(addresses);

    for (const [idx, [key, cachedContent]] of Object.entries(this._cache).entries()) {
      const entity = cachedContent.entity;
      const value = entity.parse(data[idx]);

      this._cache[key] = { entity, value };
    }
  }

  public async listUserPositions(wallet: PublicKey, refresh = false): Promise<PositionAccount[]> {
    // default to using cached value
    if (this._userPositions !== null && this._userWallet?.equals(wallet) && !refresh) {
      return this._userPositions;
    }

    // get user tokens
    const { value: tokenAccountsInfo } = await this._connection.getParsedTokenAccountsByOwner(
      wallet,
      {
        programId: TOKEN_PROGRAM_ID,
      },
      COMMITMENT
    );

    // get mint addresses of all token accounts with amount equal to 1
    // then derive Position addresses and filter out if accounts don't exist
    const addresses: PublicKey[] = [];
    tokenAccountsInfo.forEach((accountInfo) => {
      const amount: string = accountInfo.account.data.parsed.info.tokenAmount.amount;
      if (amount !== "1") {
        return;
      }
      const positionMint = new PublicKey(accountInfo.account.data.parsed.info.mint);
      const positionAddress = PositionEntity.deriveAddress(positionMint, this.programId);
      addresses.push(positionAddress);
    });

    const positions = await this.listPositions(addresses, refresh);
    this._userPositions = positions;
    this._userWallet = wallet;
    return positions;
  }

  /*** Private Methods ***/

  private async get<T extends CachedAccount>(
    address: PublicKey,
    entity: ParsableEntity<T>,
    refresh: boolean
  ): Promise<T | null> {
    const key = address.toBase58();
    const cachedValue: CachedAccount | null | undefined = this._cache[key]?.value;
    const alwaysFetch = this._strategy === CacheStrategy.AlwaysFetch;

    // TODO - currently we store null in cache. is this the correct behavior?
    //    Q - should we fetch if cached value is null? (i don't think we should)
    if (cachedValue !== undefined && !refresh && !alwaysFetch) {
      return cachedValue as T | null;
    }

    const accountInfo = await this._connection.getAccountInfo(address, COMMITMENT);
    const accountData = accountInfo?.data;
    const value = entity.parse(accountData);
    this._cache[key] = { entity, value };

    return value;
  }

  private async list<T extends CachedAccount>(
    addresses: PublicKey[],
    entity: ParsableEntity<T>,
    refresh = false
  ): Promise<T[]> {
    addresses = this.dedupeAddresses(addresses);

    const alwaysFetch = this._strategy === CacheStrategy.AlwaysFetch;

    const keys = addresses.map((address) => address.toBase58());
    const cachedValues: (CachedAccount | null | undefined)[] = keys.map(
      (key) => this._cache[key]?.value
    );

    const undefinedAccounts: { cachedIdx: number; key: string }[] = [];
    cachedValues.forEach((val, cachedIdx) => {
      if (val === undefined || refresh || alwaysFetch) {
        undefinedAccounts.push({ cachedIdx, key: keys[cachedIdx] });
      }
    });

    // TODO - currently we store null in cache. is this the correct behavior?
    //    Q - should we fetch if cached value is null? (i don't think we should)
    if (undefinedAccounts.length === 0) {
      return cachedValues.filter((value): value is T => value !== null);
    }

    const data = await this.bulkRequest(undefinedAccounts.map((account) => account.key));

    for (const [dataIdx, { cachedIdx, key }] of undefinedAccounts.entries()) {
      const value = entity.parse(data[dataIdx]);
      this._cache[key] = { entity, value };
      cachedValues[cachedIdx] = value;
    }

    return cachedValues.filter((value): value is T => value !== null);
  }

  private async bulkRequest(addresses: string[]): Promise<(Buffer | null)[]> {
    const requests = addresses.map((address: string) => ({
      methodName: "getAccountInfo",
      args: this._connection._buildArgs([address], COMMITMENT),
    }));

    const infos: any[] | null = await (this._connection as any)._rpcBatchRequest(requests);
    invariant(infos !== null, "bulkRequest no results");
    invariant(addresses.length === infos.length, "bulkRequest not enough results");

    return infos.map((info) => info.result.value.data);
  }

  private dedupeAddresses(publicKeys: PublicKey[]): PublicKey[] {
    const addresses = publicKeys.map((publicKey) => publicKey.toBase58());
    return Array.from(new Set(addresses)).map((address) => new PublicKey(address));
  }
}
