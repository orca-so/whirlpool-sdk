import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { AccountInfo, MintInfo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  PositionData,
  TickArrayData,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import {
  ParsableEntity,
  ParsableMintInfo,
  ParsablePosition,
  ParsableTickArray,
  ParsableTokenInfo,
  ParsableWhirlpool,
  ParsableWhirlpoolsConfig,
} from "./parse";
import { getPositionPda, WhirlpoolConfigAccount } from "@orca-so/whirlpool-client-sdk";

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
 * Data access layer for accounts used by OrcaWhirlpool and OrcaPosition.
 * The types of accounts that are being used are defined by CachedAccount.
 * Includes internal cache that can be refreshed by the client.
 */
export class OrcaDAL {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;
  public readonly connection: Connection;

  private readonly _cache: Record<string, CachedContent<CachedValue>> = {};

  constructor(whirlpoolsConfig: PublicKey, programId: PublicKey, connection: Connection) {
    this.whirlpoolsConfig = whirlpoolsConfig;
    this.programId = programId;
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
  public async getPool(address: PublicKey, refresh = false): Promise<WhirlpoolData | null> {
    return this.get(address, ParsableWhirlpool, refresh);
  }

  /**
   * Retrieve a cached position account. Fetch from rpc on cache miss.
   *
   * @param address position address
   * @param refresh force cache refresh
   * @returns position account
   */
  public async getPosition(address: PublicKey, refresh = false): Promise<PositionData | null> {
    return this.get(address, ParsablePosition, refresh);
  }

  /**
   * Retrieve a cached tick array account. Fetch from rpc on cache miss.
   *
   * @param address tick array address
   * @param refresh force cache refresh
   * @returns tick array account
   */
  public async getTickArray(address: PublicKey, refresh = false): Promise<TickArrayData | null> {
    return this.get(address, ParsableTickArray, refresh);
  }

  /**
   * Retrieve a cached token info account. Fetch from rpc on cache miss.
   *
   * @param address token info address
   * @param refresh force cache refresh
   * @returns token info account
   */
  public async getTokenInfo(address: PublicKey, refresh = false): Promise<AccountInfo | null> {
    return this.get(address, ParsableTokenInfo, refresh);
  }

  /**
   * Retrieve a cached mint info account. Fetch from rpc on cache miss.
   *
   * @param address mint info address
   * @param refresh force cache refresh
   * @returns mint info account
   */
  public async getMintInfo(address: PublicKey, refresh = false): Promise<MintInfo | null> {
    return this.get(address, ParsableMintInfo, refresh);
  }

  /**
   * Retrieve a cached whirlpool config account. Fetch from rpc on cache miss.
   *
   * @param address whirlpool config address
   * @param refresh force cache refresh
   * @returns whirlpool config account
   */
  public async getConfig(
    address: PublicKey,
    refresh = false
  ): Promise<WhirlpoolConfigAccount | null> {
    return this.get(address, ParsableWhirlpoolsConfig, refresh);
  }

  /**
   * Retrieve a list of cached whirlpool accounts. Fetch from rpc for cache misses.
   *
   * @param addresses whirlpool addresses
   * @param refresh force cache refresh
   * @returns whirlpool accounts
   */
  public async listPools(
    addresses: PublicKey[],
    refresh = false
  ): Promise<(WhirlpoolData | null)[]> {
    return this.list(addresses, ParsableWhirlpool, refresh);
  }

  /**
   * Retrieve a list of cached position accounts. Fetch from rpc for cache misses.
   *
   * @param addresses position addresses
   * @param refresh force cache refresh
   * @returns position accounts
   */
  public async listPositions(
    addresses: PublicKey[],
    refresh = false
  ): Promise<(PositionData | null)[]> {
    return this.list(addresses, ParsablePosition, refresh);
  }

  /**
   * Retrieve a list of cached tick array accounts. Fetch from rpc for cache misses.
   *
   * @param addresses tick array addresses
   * @param refresh force cache refresh
   * @returns tick array accounts
   */
  public async listTickArrays(
    addresses: PublicKey[],
    refresh = false
  ): Promise<(TickArrayData | null)[]> {
    return this.list(addresses, ParsableTickArray, refresh);
  }

  /**
   * Retrieve a list of cached token info accounts. Fetch from rpc for cache misses.
   *
   * @param addresses token info addresses
   * @param refresh force cache refresh
   * @returns token info accounts
   */
  public async listTokenInfos(
    addresses: PublicKey[],
    refresh = false
  ): Promise<(AccountInfo | null)[]> {
    return this.list(addresses, ParsableTokenInfo, refresh);
  }

  /**
   * Retrieve a list of cached mint info accounts. Fetch from rpc for cache misses.
   *
   * @param addresses mint info addresses
   * @param refresh force cache refresh
   * @returns mint info accounts
   */
  public async listMintInfos(
    addresses: PublicKey[],
    refresh = false
  ): Promise<(MintInfo | null)[]> {
    return this.list(addresses, ParsableMintInfo, refresh);
  }

  /**
   * Fetch the user token account of the given token mint.
   * Note: not cached.
   *
   * @param walletAddress wallet address
   * @param mint
   * @returns account address or null if the account does not exist
   */
  public async getUserNFTAccount(
    walletAddress: PublicKey,
    mint: PublicKey
  ): Promise<PublicKey | null> {
    const { value } = await this.connection.getParsedTokenAccountsByOwner(walletAddress, {
      programId: TOKEN_PROGRAM_ID,
      mint,
    });

    if (!value || value.length === 0) {
      return null;
    }

    let tokenAccount: PublicKey | null = null;
    for (const accountInfo of value) {
      const amount: string | undefined =
        accountInfo.account?.data?.parsed?.info?.tokenAmount?.amount;
      const decimals: number | undefined =
        accountInfo.account?.data?.parsed?.info?.tokenAmount?.decimals;

      if (amount === "1" && decimals === 0) {
        tokenAccount = accountInfo.pubkey;
        break;
      }
    }

    return tokenAccount;
  }

  /**
   * Fetch a list of positions owned by the wallet address.
   * Note: not cached.
   *
   * @param walletAddress wallet address
   * @returns a list of positions owned by the wallet address
   */
  public async listUserPositions(walletAddress: PublicKey): Promise<PublicKey[]> {
    // get user token accounts
    const { value } = await this.connection.getParsedTokenAccountsByOwner(walletAddress, {
      programId: TOKEN_PROGRAM_ID,
    });

    // get mint addresses of all token accounts with amount equal to 1
    // then derive Position addresses and filter out if accounts don't exist
    const addresses: PublicKey[] = [];
    value.forEach((accountInfo) => {
      const amount: string | undefined =
        accountInfo.account?.data?.parsed?.info?.tokenAmount?.amount;
      const decimals: number | undefined =
        accountInfo.account?.data?.parsed?.info?.tokenAmount?.decimals;
      const mint: string | undefined = accountInfo.account?.data?.parsed?.info?.mint;

      if (amount !== "1" || decimals !== 0 || !mint) {
        return;
      }
      const positionAddress = getPositionPda(this.programId, new PublicKey(mint)).publicKey;
      addresses.push(positionAddress);
    });

    const positions = await this.listPositions(addresses, true);
    invariant(addresses.length === positions.length, "not enough positions data");

    const validPositionAddresses: PublicKey[] = addresses.filter((_address, index) => {
      return positions[index] !== null;
    });

    return validPositionAddresses;
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

    // TODO - currently we store null in cache. is this the correct behavior?
    //    Q - should we fetch if cached value is null? (i don't think we should)
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
    const cachedValues: (CachedValue | null | undefined)[] = keys.map(
      (key) => this._cache[key]?.value
    );

    const undefinedAccounts: { cachedIdx: number; key: string }[] = [];
    cachedValues.forEach((val, cachedIdx) => {
      if (val === undefined || refresh) {
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

    const result = cachedValues.filter((value): value is T | null => value !== undefined);
    invariant(result.length === addresses.length, "error while fetching accounts");

    return result;
  }

  /**
   * Make batch rpc request
   */
  private async bulkRequest(addresses: string[]): Promise<(Buffer | null)[]> {
    // @ts-ignore
    const res = await this.connection._rpcRequest("getMultipleAccounts", [
      addresses,
      { commitment: this.connection.commitment },
    ]);
    invariant(!res.error, "bulkRequest result error");
    invariant(!!res.result?.value, "bulkRequest no value");
    invariant(res.result.value.length === addresses.length, "bulkRequest not enough results");

    return res.result.value.map((account: { data: [string, string] } | null) => {
      if (!account || account.data[1] !== "base64") {
        return null;
      }

      return Buffer.from(account.data[0], "base64");
    });
  }
}
