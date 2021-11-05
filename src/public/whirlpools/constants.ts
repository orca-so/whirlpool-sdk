import { PublicKey } from "@solana/web3.js";
import { Network } from ".";

// TODO - update once we have actual contract addresses
export function getWhirlpoolsConfig(network: Network): PublicKey {
  switch (network) {
    case Network.MAINNET:
      return PublicKey.default;
    case Network.DEVNET:
      return PublicKey.default;
    default:
      throw new Error("Unknown network");
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
      throw new Error("Unknown network");
  }
}

/**
 * Number of ticks contained in a single tick array
 */
export const NUM_TICKS_IN_ARRAY = 1000;
