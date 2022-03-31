import { PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from "./public/network";

export function getWhirlpoolsConfig(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      return new PublicKey("4NPRn2WVyyCrKEQBFaog8dvTjPLK8ETddrZUyRLq61Bo");
    case OrcaNetwork.DEVNET:
      return new PublicKey("485iG9deEgUnMzXdLpzhQeVM99pB4T2jhBYoLH8eM9uZ");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}

export function getWhirlpoolProgramId(network: OrcaNetwork): PublicKey {
  switch (network) {
    case OrcaNetwork.MAINNET:
      return new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
    case OrcaNetwork.DEVNET:
      return new PublicKey("6cnzkt2ooxusZ2CErhcggzkTW12LjPdZkN8jB9TAGaTj");
    default:
      throw new Error(`type ${network} is an Unknown network`);
  }
}
