import { Connection } from "@solana/web3.js";
import { Orca, OrcaConfig } from "..";
import { OrcaImpl } from "../../model";

/**
 * @param connection
 * @param config
 * @returns
 */
export function getOrca(connection: Connection, config?: OrcaConfig): Orca {
  return new OrcaImpl(connection, config);
}
