import { Wallet } from "@project-serum/anchor";
import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "..";
import { OrcaImpl } from "../../model";

export type OrcaConfig = {
  network?: OrcaNetwork;
  commitment?: Commitment;
};

export type Orca = {
  getWhirlpool: (address: PublicKey, refresh?: boolean) => Promise<any>;

  getWhirlpoolByTokens: (
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    refresh?: boolean
  ) => Promise<any>;

  listWhirlpools: (addresses: PublicKey[], refresh?: boolean) => Promise<any>;

  getPosition: (address: PublicKey, refresh?: boolean) => Promise<any>;

  getPositionByMint: (positionMint: PublicKey, refresh?: boolean) => Promise<any>;

  listPositions(addresses: PublicKey[], refresh?: boolean): Promise<any>;

  listUserPositions(wallet: PublicKey): Promise<any>;

  refreshCache(): Promise<void>;
};

/**
 * Note: cache is turned off by default.
 *
 * @param connection
 * @param network
 * @param cache
 * @returns
 */
export function getOrca(connection: Connection, config?: OrcaConfig): Orca {
  return new OrcaImpl(connection, config);
}
