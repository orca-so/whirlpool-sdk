import { Connection, PublicKey } from "@solana/web3.js";
import { Network, Orca } from "../public";
import { OrcaCacheImpl, OrcaCache } from "./cache";
import { Whirlpool } from "./entities";
import { OrcaFactory } from "./orca";

export class OrcaImpl implements Orca {
  private readonly cache: OrcaCache;
  private readonly factory: OrcaFactory;

  constructor(connection: Connection, network: Network) {
    this.cache = new OrcaCacheImpl(connection, network);
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
