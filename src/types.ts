import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

/*** Pool ***/

export type PoolData = {
  address: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  stable: boolean;
  feeRate: Decimal;
  protocolFeeRate: Decimal;
  liquidity: u64;
  sqrtPrice: BN;
  tickCurrentIndex: number;
  price: Decimal;
  protocolFeeOwedA: Decimal;
  protocolFeeOwedB: Decimal;
  tokenVaultAmountA: Decimal;
  tokenVaultAmountB: Decimal;
  rewards: PoolRewardInfo[];
};

export type PoolRewardInfo = {
  mint: PublicKey;
  vaultAmount: Decimal;
  emissionsPerSecond: Decimal;
};

/*** Position ***/

export type UserPositionData = {
  address: PublicKey;
  whirlpool: PublicKey;
  positionMint: PublicKey;
  liquidity: u64;
  tickLowerIndex: number;
  tickUpperIndex: number;
  priceLower: Decimal;
  priceUpper: Decimal;
  feeOwedA: Decimal;
  feeOwedB: Decimal;
  rewards: UserPositionRewardInfo[];
};

export type UserPositionRewardInfo = {
  mint: PublicKey;
  amountOwed?: Decimal;
};

/*** Misc ***/

export type UserToken = {
  address: PublicKey;
  amount?: string;
  decimals?: number;
  mint?: string;
};
