import { PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "../public";

// TODO - update once we have actual contract addresses
export function getWhirlpoolsConfig(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      return PublicKey.default;
    case OrcaNetwork.DEVNET:
      return PublicKey.default;
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}

// TODO - update once we have actual contract addresses
export function getWhirlpoolProgramId(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      return PublicKey.default;
    case OrcaNetwork.DEVNET:
      return PublicKey.default;
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}

export const TICK_ARRAY_SIZE: number = 1000;
export const TICK_SPACING: number = 5;

export const NUM_REWARDS: number = 3;
