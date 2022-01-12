import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { OrcaNetwork } from "..";
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
} from "./parse";
import { getPositionPda } from "@orca-so/whirlpool-client-sdk";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "../constants/programs";

/**
 * Supported accounts
 */
type CachedValue = WhirlpoolData | PositionData | TickArrayData | AccountInfo | MintInfo;

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

  private readonly _cache: Record<string, CachedContent<CachedValue>> = {};
  private readonly _connection: Connection;
  private readonly _commitment: Commitment;

  constructor(connection: Connection, network: OrcaNetwork, commitment: Commitment) {
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.programId = getWhirlpoolProgramId(network);
    this._connection = connection;
    this._commitment = commitment;
  }

  /*** Public Methods ***/

  public async getWhirlpool(address: PublicKey, refresh = false): Promise<WhirlpoolData | null> {
    return this.get(address, ParsableWhirlpool, refresh);
  }

  public async getPosition(address: PublicKey, refresh = false): Promise<PositionData | null> {
    return this.get(address, ParsablePosition, refresh);
  }

  public async getTickArray(address: PublicKey, refresh = false): Promise<TickArrayData | null> {
    return this.get(address, ParsableTickArray, refresh);
  }

  public async getTokenInfo(address: PublicKey, refresh = false): Promise<AccountInfo | null> {
    return this.get(address, ParsableTokenInfo, refresh);
  }

  public async getMintInfo(address: PublicKey, refresh = false): Promise<MintInfo | null> {
    return this.get(address, ParsableMintInfo, refresh);
  }

  public async listWhirlpools(addresses: PublicKey[], refresh = false): Promise<WhirlpoolData[]> {
    return this.list(addresses, ParsableWhirlpool, refresh);
  }

  public async listPositions(addresses: PublicKey[], refresh = false): Promise<PositionData[]> {
    return this.list(addresses, ParsablePosition, refresh);
  }

  public async listTickArrays(addresses: PublicKey[], refresh = false): Promise<TickArrayData[]> {
    return this.list(addresses, ParsableTickArray, refresh);
  }

  public async listTokenInfos(addresses: PublicKey[], refresh = false): Promise<AccountInfo[]> {
    return this.list(addresses, ParsableTokenInfo, refresh);
  }

  public async listMintInfos(addresses: PublicKey[], refresh = false): Promise<MintInfo[]> {
    return this.list(addresses, ParsableMintInfo, refresh);
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

  public async listUserPositions(wallet: PublicKey): Promise<PositionData[]> {
    // get user token accounts
    const { value: tokenAccounts } = await this._connection.getParsedTokenAccountsByOwner(
      wallet,
      {
        programId: TOKEN_PROGRAM_ID,
      },
      this._commitment
    );

    // get mint addresses of all token accounts with amount equal to 1
    // then derive Position addresses and filter out if accounts don't exist
    const addresses: PublicKey[] = [];
    tokenAccounts.forEach((accountInfo) => {
      const amount: string = accountInfo.account.data.parsed.info.tokenAmount.amount;
      if (amount !== "1") {
        return;
      }
      const positionMint = new PublicKey(accountInfo.account.data.parsed.info.mint);
      const positionAddress = getPositionPda(this.programId, positionMint);
      addresses.push(positionAddress.publicKey);
    });

    return await this.listPositions(addresses, true);
  }

  /*** Private Methods ***/

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

    const accountInfo = await this._connection.getAccountInfo(address, this._commitment);
    const accountData = accountInfo?.data;
    const value = entity.parse(accountData);
    this._cache[key] = { entity, value };

    return value;
  }

  private async list<T extends CachedValue>(
    addresses: PublicKey[],
    entity: ParsableEntity<T>,
    refresh: boolean
  ): Promise<T[]> {
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

    return cachedValues.filter((value): value is T => value !== null);
  }

  private async bulkRequest(addresses: string[]): Promise<(Buffer | null)[]> {
    const requests = addresses.map((address: string) => ({
      methodName: "getAccountInfo",
      args: this._connection._buildArgs([address], this._commitment),
    }));

    const infos: any[] | null = await (this._connection as any)._rpcBatchRequest(requests);
    invariant(infos !== null, "bulkRequest no results");
    invariant(addresses.length === infos.length, "bulkRequest not enough results");

    return infos.map((info) => info.result.value.data);
  }
}
