import { Connection } from "@solana/web3.js";
import { Network } from "../../public";

export class OrcaFactory {
  getDAL(connection: Connection, network: Network) {}

  getWhirlpool(connection: Connection, network: Network) {}

  getPosition(connection: Connection, network: Network) {}
}
