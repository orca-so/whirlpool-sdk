import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { CachedValue, InternalCacheStore, OrcaDAL } from ".";
import invariant from "tiny-invariant";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "../../constants";
import {
  ParsableEntity,
  PositionEntity,
  TickArrayEntity,
  TokenEntity,
  WhirlpoolEntity,
} from "../entities";
import { OrcaNetwork, PositionData, TickArrayData, TokenData, WhirlpoolData } from "../..";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export class OrcaDALImpl implements OrcaDAL {
  public readonly whirlpoolsConfig: PublicKey;
  public readonly programId: PublicKey;

  private readonly _cache: InternalCacheStore = {};
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
    return this.get(address, WhirlpoolEntity, refresh);
  }

  public async getPosition(address: PublicKey, refresh = false): Promise<PositionData | null> {
    return this.get(address, PositionEntity, refresh);
  }

  public async getTickArray(address: PublicKey, refresh = false): Promise<TickArrayData | null> {
    return this.get(address, TickArrayEntity, refresh);
  }

  public async getToken(address: PublicKey, refresh = false): Promise<TokenData | null> {
    return this.get(address, TokenEntity, refresh);
  }

  public async listWhirlpools(addresses: PublicKey[], refresh = false): Promise<WhirlpoolData[]> {
    return this.list(addresses, WhirlpoolEntity, refresh);
  }

  public async listPositions(addresses: PublicKey[], refresh = false): Promise<PositionData[]> {
    return this.list(addresses, PositionEntity, refresh);
  }

  public async listTickArrays(addresses: PublicKey[], refresh = false): Promise<TickArrayData[]> {
    return this.list(addresses, TickArrayEntity, refresh);
  }

  public async listTokens(addresses: PublicKey[], refresh = false): Promise<TokenData[]> {
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
      const positionAddress = PositionEntity.deriveAddress(positionMint, this.programId);
      addresses.push(positionAddress);
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
