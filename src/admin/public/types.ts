import { Percentage } from "@orca-so/sdk";
import { TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { Address, BN, Provider } from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";

export type InitPoolTxParam = {
  initSqrtPrice: BN;
  tokenMintA: Address;
  tokenMintB: Address;
  tickSpacing: TickSpacing;
};

export type InitWhirlpoolConfigsTxParam = {
  whirlpoolConfigKeypair: Keypair;
  feeAuthority: Address;
  collectProtocolFeesAuthority: Address;
  rewardEmissionsSuperAuthority: Address;
  defaultProtocolFeeRate: number;
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

export type SetRewardEmissionsBySuperAuthorityTxParam = {
  rewardEmissionsSuperAuthority: Address;
  newRewardEmissionsSuperAuthority: Address;
};
