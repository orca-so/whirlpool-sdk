import { TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

export type PoolData = {
  address: PublicKey;
  tickSpacing: TickSpacing;
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

export type UserToken = {
  address: PublicKey;
  amount?: string;
  decimals?: number;
  mint?: string;
};
