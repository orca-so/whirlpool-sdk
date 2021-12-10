import { PublicKey } from "@solana/web3.js";
import { Network } from "../public";

// TODO - update once we have actual contract addresses
export function getWhirlpoolsConfig(network: Network): PublicKey {
  switch (network) {
    case Network.MAINNET:
      return PublicKey.default;
    case Network.DEVNET:
      return PublicKey.default;
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}

// TODO - update once we have actual contract addresses
export function getWhirlpoolProgramId(network: Network): PublicKey {
  switch (network) {
    case Network.MAINNET:
      return PublicKey.default;
    case Network.DEVNET:
      return PublicKey.default;
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}

/**
 * Number of ticks contained in a single tick array
 */
export const TICK_ARRAY_SIZE: number = 1000;

/**
 * Tick spacing
 */
export const TICK_SPACING: number = 5;
