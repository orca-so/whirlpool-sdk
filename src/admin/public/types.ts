import { TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { Address, BN, Provider } from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import Decimal from "decimal.js";

export type InitPoolTransactionParam = {
  provider: Provider;
  initialPrice: Decimal;
  tokenMintA: Address;
  tokenMintB: Address;
  tickSpacing: TickSpacing;
};

export type CollectProtocolFeesTransactionParam = {
  provider: Provider;
  poolAddress: Address;
  tokenDestinationA: Address;
  tokenDestinationB: Address;
};

export type SetFeeAuthorityParam = {
  provider: Provider;
  newFeeAuthority: Address;
};

export type SetCollectProtocolFeesAuthorityParam = {
  provider: Provider;
  newCollectProtocolFeesAuthority: Address;
};

export type InitRewardTransactionParam = {
  provider: Provider;
  rewardAuthority: Address;
  poolAddress: Address;
  rewardMint: Address;
  rewardVaultKeypair: Keypair;
  rewardIndex: number;
};

export type SetRewardAuthorityTransactionParam = {
  provider: Provider;
  poolAddress: Address;
  newRewardAuthority: Address;
  rewardIndex: number;
};

export type SetRewardEmissionsTransactionParam = {
  provider: Provider;
  poolAddress: Address;
  rewardIndex: number;
  emissionsPerSecondX64: BN;
  rewardVault: Address;
};

export type SetRewardAuthorityBySuperAuthorityTransactionParam = {
  provider: Provider;
  poolAddress: Address;
  newRewardAuthority: Address;
  rewardIndex: number;
};

export type SetRewardEmissionsBySuperAuthorityTransactionParam = {
  provider: Provider;
  rewardEmissionsSuperAuthority: Address;
  newRewardEmissionsSuperAuthority: Address;
};
