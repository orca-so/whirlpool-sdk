import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaNetwork, Orca } from "../public";
import { OrcaCacheImpl, OrcaCache, CacheStrategy } from "./cache";
import { Whirlpool } from "./entities";
import { OrcaFactory } from "./orca";

export class OrcaImpl implements Orca {
  private readonly cache: OrcaCache;
  private readonly factory: OrcaFactory;

  constructor(connection: Connection, network: OrcaNetwork, cache: boolean) {
    const cacheStrategy = cache ? CacheStrategy.Manual : CacheStrategy.AlwaysFetch;
    this.cache = new OrcaCacheImpl(connection, network, cacheStrategy);
    this.factory = new OrcaFactory();
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
}
