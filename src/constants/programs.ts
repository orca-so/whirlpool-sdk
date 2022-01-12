import { PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "./public/network";

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
