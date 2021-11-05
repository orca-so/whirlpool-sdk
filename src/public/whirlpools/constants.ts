import { PublicKey } from "@solana/web3.js";
import { WhirlpoolsConfig } from ".";

// TODO - update once we have actual contract addresses
export const ORCA_WHIRPOOLS_CONFIG_MAINNET: WhirlpoolsConfig = {
  protocolFeeAuthority: PublicKey.default,
  collectProtocolFeeAuthority: PublicKey.default,
  feeRateAuthority: PublicKey.default,
  rewardEmissionsSuperAuthority: PublicKey.default,
};

// TODO - update once we have actual contract addresses
export const ORCA_WHIRPOOLS_CONFIG_DEVNET: WhirlpoolsConfig = {
  protocolFeeAuthority: PublicKey.default,
  collectProtocolFeeAuthority: PublicKey.default,
  feeRateAuthority: PublicKey.default,
  rewardEmissionsSuperAuthority: PublicKey.default,
};

export const NUM_TICKS_IN_ARRAY = 1000;
