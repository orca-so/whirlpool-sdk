import { TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { BN, Wallet } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";

export type InitPoolTransactionParam = {
  wallet: Wallet;
  initSqrtPrice: Decimal;
  whirlpoolConfigKey: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  tokenVaultAKeypair: Keypair;
  tokenVaultBKeypair: Keypair;
  tickSpacing: TickSpacing;
};

export type CollectProtocolFeesTransactionParam = {
  wallet: Wallet;
  address: PublicKey;
  tokenDestinationA: PublicKey;
  tokenDestinationB: PublicKey;
  refresh?: boolean;
};

export type SetFeeAuthorityParam = {
  wallet: Wallet;
  newFeeAuthority: PublicKey;
};

export type SetCollectProtocolFeesAuthorityParam = {
  wallet: Wallet;
  newCollectProtocolFeesAuthority: PublicKey;
};

export type InitRewardTransactionParam = {
  wallet: Wallet;
  rewardAuthority: PublicKey;
  whirlpool: PublicKey;
  rewardMint: PublicKey;
  rewardVaultKeypair: Keypair;
  rewardIndex: number;
};

export type SetRewardAuthorityTransactionParam = {
  wallet: Wallet;
  whirlpool: PublicKey;
  newRewardAuthority: PublicKey;
  rewardIndex: number;
};

export type SetRewardEmissionsTransactionParam = {
  wallet: Wallet;
  whirlpool: PublicKey;
  rewardIndex: number;
  emissionsPerSecondX64: BN;
};

export type SetRewardAuthorityBySuperAuthorityTransactionParam = {
  wallet: Wallet;
  whirlpool: PublicKey;
  newRewardAuthority: PublicKey;
  rewardIndex: number;
};

export type SetRewardEmissionsBySuperAuthorityTransactionParam = {
  wallet: Wallet;
  rewardEmissionsSuperAuthorityKeypair: Keypair;
  newRewardEmissionsSuperAuthority: PublicKey;
};
