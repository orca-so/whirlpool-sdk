import { TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { Address, BN, Provider } from "@project-serum/anchor";

export type InitPoolTxParam = {
  initSqrtPrice: BN;
  tokenMintA: Address;
  tokenMintB: Address;
  tickSpacing: TickSpacing;
};

export type SetFeeAuthorityTxParam = {
  newFeeAuthority: Address;
};

export type SetCollectProtocolFeesAuthorityTxParam = {
  newCollectProtocolFeesAuthority: Address;
};

export type InitRewardTxParam = {
  rewardAuthority: Address;
  rewardMint: Address;
  rewardIndex: number;
};

export type SetRewardAuthorityTxParam = {
  newRewardAuthority: Address;
  rewardIndex: number;
};

export type SetRewardEmissionsTxParam = {
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
