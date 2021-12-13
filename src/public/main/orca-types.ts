import { Connection } from "@solana/web3.js";
import { Network } from "..";

export type Orca = {
  getWhirlpool: (args: any) => any;

  getPosition: (args: any) => any;
};

export function getOrca(connection: Connection, network = Network.MAINNET): Orca {
  throw new Error("return new OrcaImpl(connection, network");
}
