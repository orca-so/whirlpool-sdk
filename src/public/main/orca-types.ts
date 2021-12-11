import { Connection } from "@solana/web3.js";
import { Network } from "..";

export type Orca = {
  getDAL: () => any;

  getWhirlpool: () => any;

  getPosition: () => any;
};

export function getOrca(connection: Connection, network = Network.MAINNET): Orca {
  throw new Error("return new OrcaImpl(connection, network");
}
