import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "..";
import { OrcaImpl } from "../../model";

export type Orca = {
  // refreshCache(): Promise<void>;
  // getWhirlpool: (args: any) => any;
  // getPosition: (args: any) => any;
  // listTokens(): Promise<any>;
  // listWhirlpools(): Promise<any>;
  // listPositions(wallet: PublicKey): Promise<any>;
};

/**
 * Note: cache is turned off by default.
 *
 * @param connection
 * @param network
 * @param cache
 * @returns
 */
export function getOrca(
  connection: Connection,
  network = OrcaNetwork.MAINNET,
  cache = false
): Orca {
  return new OrcaImpl(connection, network, cache);
}
