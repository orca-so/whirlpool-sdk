import { TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { BN, Provider } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";

export type InitPoolTransactionParam = {
  provider: Provider;
  initSqrtPrice: Decimal;
  whirlpoolConfigKey: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  tokenVaultAKeypair: Keypair;
  tokenVaultBKeypair: Keypair;
  tickSpacing: TickSpacing;
};

export type CollectProtocolFeesTransactionParam = {
  provider: Provider;
  address: PublicKey;
  tokenDestinationA: PublicKey;
  tokenDestinationB: PublicKey;
  refresh?: boolean;
};

export type SetFeeAuthorityParam = {
  provider: Provider;
  newFeeAuthority: PublicKey;
};

export type SetCollectProtocolFeesAuthorityParam = {
  provider: Provider;
  newCollectProtocolFeesAuthority: PublicKey;
};

export type InitRewardTransactionParam = {
  provider: Provider;
  rewardAuthority: PublicKey;
  whirlpool: PublicKey;
  rewardMint: PublicKey;
  rewardVaultKeypair: Keypair;
  rewardIndex: number;
};

export type SetRewardAuthorityTransactionParam = {
  provider: Provider;
  whirlpool: PublicKey;
  newRewardAuthority: PublicKey;
  rewardIndex: number;
};

export type SetRewardEmissionsTransactionParam = {
  provider: Provider;
  whirlpool: PublicKey;
  rewardIndex: number;
  emissionsPerSecondX64: BN;
};

export type SetRewardAuthorityBySuperAuthorityTransactionParam = {
  provider: Provider;
  whirlpool: PublicKey;
  newRewardAuthority: PublicKey;
  rewardIndex: number;
};

export type SetRewardEmissionsBySuperAuthorityTransactionParam = {
  provider: Provider;
  rewardEmissionsSuperAuthorityKeypair: Keypair;
  newRewardEmissionsSuperAuthority: PublicKey;
};
