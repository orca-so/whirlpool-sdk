import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaNetwork, Orca, OrcaPosition } from "../../public";
import { OrcaCacheImpl, OrcaCache, CacheStrategy } from "../cache";
import { Position, PositionAccount, Whirlpool } from "../entities";
import { OrcaFactory } from "./orca-factory";

export class OrcaImpl implements Orca {
  private readonly cache: OrcaCache;
  private readonly factory: OrcaFactory;
  private readonly connection: Connection;

  constructor(connection: Connection, network: OrcaNetwork, cache: boolean) {
    const cacheStrategy = cache ? CacheStrategy.Manual : CacheStrategy.AlwaysFetch;
    this.cache = new OrcaCacheImpl(connection, network, cacheStrategy);
    this.factory = new OrcaFactory();
    this.connection = connection;
  }

  public async initializeWithWhitelist(): Promise<void> {
    const whitelistedWhirlpools: PublicKey[] = []; // TODO
    const infos = whitelistedWhirlpools.map((address) => ({ address, entity: Whirlpool }));
    this.cache.fetchAll(infos);
  }

  public async refreshCache(): Promise<void> {
    this.cache.refreshAll();
  }

  public getWhirlpool(args: any) {
    return this.factory.getWhirlpool(this.cache, args);
  }

  public getPosition(args: any) {
    return this.factory.getPosition(this.cache, args);
  }

  public async listTokens(): Promise<any> {
    throw new Error("Method not implemented.");
  }

  public async listWhirlpools(): Promise<any> {
    throw new Error("Method not implemented.");
  }

  public async listPositions(wallet: PublicKey): Promise<OrcaPosition[]> {
    const { value: tokenAccountsInfo } = await this.connection.getParsedTokenAccountsByOwner(
      wallet,
      {
        programId: TOKEN_PROGRAM_ID,
      },
      "singleGossip"
    );

    const nftsAndNulls = tokenAccountsInfo.map((accountInfo) => {
      const amount: string = accountInfo.account.data.parsed.info.tokenAmount.amount;
      if (amount !== "1") {
        return null;
      }

      return new PublicKey(accountInfo.account.data.parsed.info.mint);
    });
    const nfts = nftsAndNulls.filter((address): address is PublicKey => address !== null);

    const infos = nfts.map((mint) => ({
      address: Position.deriveAddress(mint, this.cache.programId),
      entity: Position,
    }));
    const allAccounts = await this.cache.fetchAll(infos);

    const validAccounts = allAccounts.filter(
      (account): account is [string, PositionAccount] => account[1] !== null
    );
    const orcaPositions = validAccounts.map((account) =>
      this.getPosition({ positionMint: account[0] })
    );
    return orcaPositions;
  }
}
