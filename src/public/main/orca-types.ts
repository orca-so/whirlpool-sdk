import { Connection } from "@solana/web3.js";
import { Network } from "..";
import { OrcaImpl } from "../../model";

export type Orca = {
  initializeWithWhitelist(): Promise<void>;

  refreshCache(): Promise<void>;

  getWhirlpool: (args: any) => any;

  getPosition: (args: any) => any;
};

export function getOrca(connection: Connection, network = Network.MAINNET): Orca {
  return new OrcaImpl(connection, network);
}
