import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { AccountInfo, MintInfo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  ParsableEntity,
  ParsableMintInfo,
  ParsablePosition,
  ParsableTickArray,
  ParsableTokenInfo,
  ParsableWhirlpool,
  ParsableWhirlpoolsConfig,
} from "./parse";
import { Address } from "@project-serum/anchor";
import { toPubKey, toPubKeys } from "../utils/address";
import { UserToken } from "../types";
import {
  PositionData,
  TickArrayData,
  WhirlpoolConfigAccount,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk";

/**
 * Supported accounts
 */
type CachedValue =
  | WhirlpoolConfigAccount
  | WhirlpoolData
  | PositionData
  | TickArrayData
  | AccountInfo
  | MintInfo;

/**
 * Include both the entity (i.e. type) of the stored value, and the value itself
 */
interface CachedContent<T extends CachedValue> {
  entity: ParsableEntity<T>;
  value: CachedValue | null;
}

/**
 * Type for rpc batch request response
 */
type GetMultipleAccountsResponse = {
  error?: string;
  result?: {
    value?: ({ data: [string, string] } | null)[];
  };
};

/**
 * Data access layer for accounts used by OrcaWhirlpool and OrcaPosition.
 * The types of accounts that are being used are defined by CachedAccount.
 * Includes internal cache that can be refreshed by the client.
 */
export class OrcaDAL {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;

  private readonly connection: Connection;
  private readonly _cache: Record<string, CachedContent<CachedValue>> = {};
  private _userTokens: UserToken[] = [];

  constructor(whirlpoolsConfig: Address, programId: Address, connection: Connection) {
    this.whirlpoolsConfig = toPubKey(whirlpoolsConfig);
    this.programId = toPubKey(programId);
    this.connection = connection;
  }

  /*** Public Methods ***/

  /**
   * Retrieve a cached whirlpool account. Fetch from rpc on cache miss.
   *
   * @param address whirlpool address
   * @param refresh force cache refresh
   * @returns whirlpool account
   */
  public async getPool(address: Address, refresh: boolean): Promise<WhirlpoolData | null> {
    return this.get(toPubKey(address), ParsableWhirlpool, refresh);
  }

  /**
   * Retrieve a cached position account. Fetch from rpc on cache miss.
   *
   * @param address position address
   * @param refresh force cache refresh
   * @returns position account
   */
  public async getPosition(address: Address, refresh: boolean): Promise<PositionData | null> {
    return this.get(toPubKey(address), ParsablePosition, refresh);
  }

  /**
   * Retrieve a cached tick array account. Fetch from rpc on cache miss.
   *
   * @param address tick array address
   * @param refresh force cache refresh
   * @returns tick array account
   */
  public async getTickArray(address: Address, refresh: boolean): Promise<TickArrayData | null> {
    return this.get(toPubKey(address), ParsableTickArray, refresh);
  }

  /**
   * Retrieve a cached token info account. Fetch from rpc on cache miss.
   *
   * @param address token info address
   * @param refresh force cache refresh
   * @returns token info account
   */
  public async getTokenInfo(address: Address, refresh: boolean): Promise<AccountInfo | null> {
    return this.get(toPubKey(address), ParsableTokenInfo, refresh);
  }

  /**
   * Retrieve a cached mint info account. Fetch from rpc on cache miss.
   *
   * @param address mint info address
   * @param refresh force cache refresh
   * @returns mint info account
   */
  public async getMintInfo(address: Address, refresh: boolean): Promise<MintInfo | null> {
    return this.get(toPubKey(address), ParsableMintInfo, refresh);
  }

  /**
   * Retrieve a cached whirlpool config account. Fetch from rpc on cache miss.
   *
   * @param address whirlpool config address
   * @param refresh force cache refresh
   * @returns whirlpool config account
   */
  public async getConfig(
    address: Address,
    refresh: boolean
  ): Promise<WhirlpoolConfigAccount | null> {
    return this.get(toPubKey(address), ParsableWhirlpoolsConfig, refresh);
  }

  /**
   * Retrieve a list of cached whirlpool accounts. Fetch from rpc for cache misses.
   *
   * @param addresses whirlpool addresses
   * @param refresh force cache refresh
   * @returns whirlpool accounts
   */
  public async listPools(
    addresses: Address[],
    refresh: boolean
  ): Promise<(WhirlpoolData | null)[]> {
    return this.list(toPubKeys(addresses), ParsableWhirlpool, refresh);
  }

  /**
   * Retrieve a list of cached position accounts. Fetch from rpc for cache misses.
   *
   * @param addresses position addresses
   * @param refresh force cache refresh
   * @returns position accounts
   */
  public async listPositions(
    addresses: Address[],
    refresh: boolean
  ): Promise<(PositionData | null)[]> {
    return this.list(toPubKeys(addresses), ParsablePosition, refresh);
  }

  /**
   * Retrieve a list of cached tick array accounts. Fetch from rpc for cache misses.
   *
   * @param addresses tick array addresses
   * @param refresh force cache refresh
   * @returns tick array accounts
   */
  public async listTickArrays(
    addresses: Address[],
    refresh: boolean
  ): Promise<(TickArrayData | null)[]> {
    return this.list(toPubKeys(addresses), ParsableTickArray, refresh);
  }

  /**
   * Retrieve a list of cached token info accounts. Fetch from rpc for cache misses.
   *
   * @param addresses token info addresses
   * @param refresh force cache refresh
   * @returns token info accounts
   */
  public async listTokenInfos(
    addresses: Address[],
    refresh: boolean
  ): Promise<(AccountInfo | null)[]> {
    return this.list(toPubKeys(addresses), ParsableTokenInfo, refresh);
  }

  /**
   * Retrieve a list of cached mint info accounts. Fetch from rpc for cache misses.
   *
   * @param addresses mint info addresses
   * @param refresh force cache refresh
   * @returns mint info accounts
   */
  public async listMintInfos(addresses: Address[], refresh: boolean): Promise<(MintInfo | null)[]> {
    return this.list(toPubKeys(addresses), ParsableMintInfo, refresh);
  }

  /**
   * Retrieve a list of tokens owned by the user.
   *
   * @param walletAddress user wallet address
   * @param refresh foree cache refresh
   * @returns user tokens
   */
  public async listUserTokens(walletAddress: Address, refresh: boolean): Promise<UserToken[]> {
    if (!this._userTokens || refresh) {
      const filter = { programId: TOKEN_PROGRAM_ID };
      const { value } = await this.connection.getParsedTokenAccountsByOwner(
        toPubKey(walletAddress),
        filter
      );
      const userTokens = value.map((accountInfo) => ({
        address: accountInfo.pubkey,
        amount: accountInfo.account?.data?.parsed?.info?.tokenAmount?.amount,
        decimals: accountInfo.account?.data?.parsed?.info?.tokenAmount?.decimals,
        mint: accountInfo.account?.data?.parsed?.info?.mint,
      }));
      this._userTokens = userTokens;
      return userTokens;
    }

    return this._userTokens;
  }

  /**
   * Update the cached value of all entities currently in the cache.
   * Uses batched rpc request for network efficient fetch.
   */
  public async refreshAll(): Promise<void> {
    const addresses: string[] = Object.keys(this._cache);
    const data = await this.bulkRequest(addresses);

    for (const [idx, [key, cachedContent]] of Object.entries(this._cache).entries()) {
      const entity = cachedContent.entity;
      const value = entity.parse(data[idx]);

      this._cache[key] = { entity, value };
    }
  }

  /*** Private Methods ***/

  /**
   * Retrieve from cache or fetch from rpc, an account
   */
  private async get<T extends CachedValue>(
    address: PublicKey,
    entity: ParsableEntity<T>,
    refresh: boolean
  ): Promise<T | null> {
    const key = address.toBase58();
    const cachedValue: CachedValue | null | undefined = this._cache[key]?.value;

    if (cachedValue !== undefined && !refresh) {
      return cachedValue as T | null;
    }

    const accountInfo = await this.connection.getAccountInfo(address);
    const accountData = accountInfo?.data;
    const value = entity.parse(accountData);
    this._cache[key] = { entity, value };

    return value;
  }

  /**
   * Retrieve from cache or fetch from rpc, a list of accounts
   */
  private async list<T extends CachedValue>(
    addresses: PublicKey[],
    entity: ParsableEntity<T>,
    refresh: boolean
  ): Promise<(T | null)[]> {
    const keys = addresses.map((address) => address.toBase58());
    const cachedValues: [string, CachedValue | null | undefined][] = keys.map((key) => [
      key,
      this._cache[key]?.value,
    ]);

    /* Look for accounts not found in cache */
    const undefinedAccounts: { cacheIndex: number; key: string }[] = [];
    cachedValues.forEach(([key, value], cacheIndex) => {
      if (value === undefined || refresh) {
        undefinedAccounts.push({ cacheIndex, key });
      }
    });

    /* Fetch accounts not found in cache */
    if (undefinedAccounts.length > 0) {
      const data = await this.bulkRequest(undefinedAccounts.map((account) => account.key));
      undefinedAccounts.forEach(({ cacheIndex, key }, dataIndex) => {
        const value = entity.parse(data[dataIndex]);
        invariant(cachedValues[cacheIndex]?.[1] === undefined, "unexpected non-undefined value");
        cachedValues[cacheIndex] = [key, value];
        this._cache[key] = { entity, value };
      });
    }

    const result = cachedValues
      .map(([_, value]) => value)
      .filter((value): value is T | null => value !== undefined);
    invariant(result.length === addresses.length, "not enough results fetched");
    return result;
  }

  /**
   * Make batch rpc request
   */
  private async bulkRequest(addresses: string[]): Promise<(Buffer | null)[]> {
    const responses: Promise<GetMultipleAccountsResponse>[] = [];
    const chunk = 100; // getMultipleAccounts has limitation of 100 accounts per request

    for (let i = 0; i < addresses.length; i += chunk) {
      const addressesSubset = addresses.slice(i, i + chunk);
      const res = (this.connection as any)._rpcRequest("getMultipleAccounts", [
        addressesSubset,
        { commitment: this.connection.commitment },
      ]);
      responses.push(res);
    }

    const combinedResult: (Buffer | null)[] = [];

    (await Promise.all(responses)).forEach((res) => {
      invariant(!res.error, `bulkRequest result error: ${res.error}`);
      invariant(!!res.result?.value, "bulkRequest no value");

      res.result.value.forEach((account) => {
        if (!account || account.data[1] !== "base64") {
          combinedResult.push(null);
        } else {
          combinedResult.push(Buffer.from(account.data[0], account.data[1]));
        }
      });
    });

    invariant(combinedResult.length === addresses.length, "bulkRequest not enough results");
    return combinedResult;
  }
}
