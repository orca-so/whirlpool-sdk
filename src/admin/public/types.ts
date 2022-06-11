import { Address, BN, Provider } from "@project-serum/anchor";

export type InitPoolTxParam = {
  provider: Provider;
  initSqrtPrice: BN;
  tokenMintA: Address;
  tokenMintB: Address;
  tickSpacing: number;
};

export type CollectProtocolFeesTxParam = {
  provider: Provider;
  poolAddress: Address;
};

export type SetFeeAuthorityTxParam = {
  provider: Provider;
  newFeeAuthority: Address;
};

export type SetFeeRateTxParam = {
  provider: Provider;
  poolAddress: Address;
  feeRate: number;
};

export type SetProtocolFeeRateTxParam = {
  provider: Provider;
  poolAddress: Address;
  protocolFeeRate: number;
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

export type SetRewardSuperAuthorityTxParam = {
  provider: Provider;
  newRewardSuperAuthority: Address;
};

export type SetRewardEmissionsBySuperAuthorityTxParam = {
  provider: Provider;
  rewardEmissionsSuperAuthority: Address;
  newRewardEmissionsSuperAuthority: Address;
};
