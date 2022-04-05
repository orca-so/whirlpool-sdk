import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

/*** Pool ***/

export type PoolData = {
  address: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  tickSpacing: number;
  feeRate: number;
  protocolFeeRate: number;
  liquidity: BN;
  sqrtPrice: BN;
  tickCurrentIndex: number;
  protocolFeeOwedA: BN;
  protocolFeeOwedB: BN;
  tokenVaultAmountA: BN;
  tokenVaultAmountB: BN;
  rewards: PoolRewardInfo[];
  feeGrowthGlobalAX64: BN;
  feeGrowthGlobalBX64: BN;

  // Derived helper fields
  feePercentage: Decimal;
  protocolFeePercentage: Decimal;
  price: Decimal;
  decimalProtocolFeeOwedA: Decimal;
  decimalProtocolFeeOwedB: Decimal;
  decimalTokenVaultAmountA: Decimal;
  decimalTokenVaultAmountB: Decimal;
  tokenDecimalsA: number;
  tokenDecimalsB: number;
};

export type PoolRewardInfo = {
  mint: PublicKey;
  vault: PublicKey;
  vaultAmount?: BN;
  emissionsPerSecondX64: BN;
  growthGlobalX64: BN;

  // Derived helper fields
  decimalVaultAmount?: Decimal;
  emissionsPerSecond?: Decimal;
};

/*** Position ***/

export type UserPositionData = {
  address: PublicKey;
  poolAddress: PublicKey;
  positionMint: PublicKey;
  liquidity: BN;
  tickLowerIndex: number;
  tickUpperIndex: number;
  feeOwedA: BN;
  feeOwedB: BN;
  rewards: UserPositionRewardInfo[];

  // Derived helper fields
  priceLower: Decimal;
  priceUpper: Decimal;
  decimalFeeOwedA: Decimal;
  decimalFeeOwedB: Decimal;
};

export type UserPositionRewardInfo = {
  mint: PublicKey;
  amountOwed?: BN;

  // Derived helper fields
  decimalAmountOwed?: Decimal;
};

/*** Misc ***/

export type UserToken = {
  address: PublicKey;
  amount?: string;
  decimals?: number;
  mint?: string;
};
