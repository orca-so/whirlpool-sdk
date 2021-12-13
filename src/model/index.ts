import { Connection } from "@solana/web3.js";
import { Network, Orca } from "../public";
import { OrcaCacheImpl, OrcaCache } from "./cache";
import { OrcaFactory } from "./orca";

export class OrcaImpl implements Orca {
  public readonly cache: OrcaCache;
  private readonly factory: OrcaFactory;

  constructor(connection: Connection, network: Network) {
    this.cache = new OrcaCacheImpl(connection, network);
    this.factory = new OrcaFactory();
  }

  public getWhirlpool(args: any) {
    return this.factory.getWhirlpool(this.cache, args);
  }
  public getPosition(args: any) {
    return this.factory.getPosition(this.cache, args);
  }
}
