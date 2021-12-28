import { Commitment, PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "..";

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
