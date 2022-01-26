import { PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "./public/network";

export function getWhirlpoolsConfig(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      throw new Error("TODO");
    case OrcaNetwork.DEVNET:
      return new PublicKey("HSf6yfFfaNsn5yTteBMrNhMNRQ6ZB3z1AqxuwZkznq9E");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}

export function getWhirlpoolProgramId(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      throw new Error("TODO");
    case OrcaNetwork.DEVNET:
      return new PublicKey("BJCiu66eFG6zrMxCmP3AUVM7hk88egY43LR6eD9WkSXb");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}
