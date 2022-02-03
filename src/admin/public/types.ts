import { Address, BN, Provider } from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import Decimal from "decimal.js";

export type InitPoolTxParam = {
  provider: Provider;
  initialPrice: Decimal;
  tokenMintA: Address;
  tokenMintB: Address;
  stable: boolean;
};

export type CollectProtocolFeesTxParam = {
  provider: Provider;
  poolAddress: Address;
  tokenDestinationA: Address;
  tokenDestinationB: Address;
};

export type SetFeeAuthorityTxParam = {
  provider: Provider;
  newFeeAuthority: Address;
};

export type SetCollectProtocolFeesAuthorityTxParam = {
  provider: Provider;
  newCollectProtocolFeesAuthority: Address;
};

export type InitRewardTxParam = {
  provider: Provider;
  rewardAuthority: Address;
  poolAddress: Address;
  rewardMint: Address;
  rewardIndex: number;
};

export type SetRewardAuthorityTxParam = {
  provider: Provider;
  poolAddress: Address;
  newRewardAuthority: Address;
  rewardIndex: number;
};

export type SetRewardEmissionsTxParam = {
  provider: Provider;
  poolAddress: Address;
  rewardIndex: number;
  emissionsPerSecondX64: BN;
};

export type SetRewardAuthorityBySuperAuthorityTxParam = {
  provider: Provider;
  poolAddress: Address;
  newRewardAuthority: Address;
  rewardIndex: number;
};

export type SetRewardEmissionsBySuperAuthorityTxParam = {
  provider: Provider;
  rewardEmissionsSuperAuthority: Address;
  newRewardEmissionsSuperAuthority: Address;
};
