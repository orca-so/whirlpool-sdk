import { Connection } from "@solana/web3.js";
import { Percentage } from "../utils/public/percentage";
import { OrcaNetwork } from "./public/network";

export const defaultSlippagePercentage = Percentage.fromFraction(1, 1000); // 0.1%

export const defaultNetwork: OrcaNetwork = OrcaNetwork.MAINNET;

export function getDefaultConnection(network: OrcaNetwork): Connection {
  switch (network) {
    case OrcaNetwork.MAINNET:
      return new Connection("https://api.mainnet-beta.solana.com", "recent");
    case OrcaNetwork.DEVNET:
      return new Connection("https://api.devnet.solana.com", "recent");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}
