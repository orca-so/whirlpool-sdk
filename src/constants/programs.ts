import { PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "./public/network";

export function getWhirlpoolsConfig(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      return new PublicKey("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ");
    case OrcaNetwork.DEVNET:
      return new PublicKey("847gd7SckNwJetbjf22ktip9vAtKWPMY4ntdr6CdCsJj");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}

export function getWhirlpoolProgramId(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      return new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
    case OrcaNetwork.DEVNET:
      return new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}
