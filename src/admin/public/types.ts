import { Address, BN, Provider } from "@project-serum/anchor";

export type InitPoolTxParam = {
  initSqrtPrice: BN;
  tokenMintA: Address;
  tokenMintB: Address;
  stable: boolean;
};

export type CollectProtocolFeesTxParam = {
  poolAddress: Address;
};

export type SetFeeAuthorityTxParam = {
  newFeeAuthority: Address;
};

export type SetFeeRateTxParam = {
  poolAddress: Address;
  feeRate: number;
};

export type SetProtocolFeeRateTxParam = {
  poolAddress: Address;
  protocolFeeRate: number;
};

export type SetCollectProtocolFeesAuthorityTxParam = {
  newCollectProtocolFeesAuthority: Address;
};

export type InitRewardTxParam = {
  rewardAuthority: Address;
  poolAddress: Address;
  rewardMint: Address;
  rewardIndex: number;
};

export type SetRewardAuthorityTxParam = {
  poolAddress: Address;
  newRewardAuthority: Address;
  rewardIndex: number;
};

export type SetRewardEmissionsTxParam = {
  poolAddress: Address;
  rewardIndex: number;
  emissionsPerSecondX64: BN;
};

export type SetRewardAuthorityBySuperAuthorityTxParam = {
  poolAddress: Address;
  newRewardAuthority: Address;
  rewardIndex: number;
};

export type SetRewardEmissionsBySuperAuthorityTxParam = {
  rewardEmissionsSuperAuthority: Address;
  newRewardEmissionsSuperAuthority: Address;
};
