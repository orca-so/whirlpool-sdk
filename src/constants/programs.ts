import { PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "./public/network";

export function getWhirlpoolsConfig(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      throw new Error("TODO");
    case OrcaNetwork.DEVNET:
      return new PublicKey("2GMAtsznwuTUKeD8rFjy5prMr1zKAHrJNq5TNCwSKmpx");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}

export function getWhirlpoolProgramId(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      throw new Error("TODO");
    case OrcaNetwork.DEVNET:
      return new PublicKey("123aHGsUDPaH5tLM8HFZMeMjHgJJXPq9eSEk32syDw6k");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}
