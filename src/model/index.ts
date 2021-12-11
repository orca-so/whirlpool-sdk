import { Connection } from "@solana/web3.js";
import { Network, Orca } from "../public";
import { OrcaFactory } from "./orca";

export class OrcaImpl implements Orca {
  private readonly connection: Connection;
  private readonly network: Network;
  private readonly factory: OrcaFactory;

  constructor(connection: Connection, network: Network) {
    this.connection = connection;
    this.network = network;
    this.factory = new OrcaFactory();
  }

  public getDAL() {
    return this.factory.getDAL(this.connection, this.network);
  }

  public getWhirlpool() {
    return this.factory.getWhirlpool(this.connection, this.network);
  }
  public getPosition() {
    return this.factory.getPosition(this.connection, this.network);
  }
}
