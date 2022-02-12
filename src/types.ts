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
  liquidity: BN;
  sqrtPrice: BN;
  tickCurrentIndex: number;
  price: Decimal;
  protocolFeeOwedA: BN;
  protocolFeeOwedB: BN;
  tokenVaultAmountA: BN;
  tokenVaultAmountB: BN;
  rewards: PoolRewardInfo[];
  tokenDecimalsA: number;
  tokenDecimalsB: number;
};

export type PoolRewardInfo = {
  mint: PublicKey;
  vaultAmount: BN;
  emissionsPerSecond: Decimal;
};

/*** Position ***/

export type UserPositionData = {
  address: PublicKey;
  poolAddress: PublicKey;
  positionMint: PublicKey;
  liquidity: BN;
  tickLowerIndex: number;
  tickUpperIndex: number;
  priceLower: BN;
  priceUpper: BN;
  feeOwedA: BN;
  feeOwedB: BN;
  rewards: UserPositionRewardInfo[];
};

export type UserPositionRewardInfo = {
  mint: PublicKey;
  amountOwed?: Decimal;
};

/*** Misc ***/

export type UserToken = {
  address: PublicKey;
  amount?: BN;
  decimals?: number;
  mint?: string;
};
