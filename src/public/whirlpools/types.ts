import { AccountInfo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { OrcaToken, OrcaU64 } from "..";
import { Percentage } from "../utils/models/percentage";
import { OrcaU256 } from "../utils/numbers/orca-u256";
import { Owner } from "../utils/web3/key-utils";

export type WhirlpoolsConfig = {
  protocolFeeAuthority: PublicKey;
  collectProtocolFeeAuthority: PublicKey;
  feeRateAuthority: PublicKey;
  rewardEmissionsSuperAuthority: PublicKey;
};

export enum FeeTier {
  LOW = 1,
  STANDARD = 2,
  HIGH = 3,
}

/**
 * TODO
 * very unstable, depends on the caching mechanism
 * will update when we have the whirlpool entities completed and have caching ready
 */
export interface OrcaWhirlpool<A extends OrcaToken, B extends OrcaToken, FeeTier> {
  getMintPositionQuoteByTick: (
    token: A | B,
    tokenAmount: OrcaU64, // should we just use u64?
    tickLowerIndex: number,
    tickUpperIndex: number,
    slippageTolerence?: Percentage
  ) => Promise<any>; // { maxTokenA, maxTokenB, liquidity }

  getMintPositionQuoteByPrice: (
    token: A | B,
    tokenAmount: OrcaU64,
    priceLower: OrcaU256,
    priceUpper: OrcaU256,
    slippageTolerence?: Percentage
  ) => Promise<any>; // { maxTokenA, maxTokenB, liquidity }

  // create lp position
  getMintPositionTransaction: (
    owner: Owner,
    tokenAccountA: AccountInfo,
    tokenAccountB: AccountInfo,
    token: any,
    tokenAmount: OrcaU64,
    tickLowerIndex: number,
    tickUpperIndex: number,
    slippageTolerence?: Percentage
  ) => Promise<any>;

  getSwapQuote: (token: any, amount: OrcaU64, slippageTolerence?: Percentage) => Promise<any>;

  getSwapTransaction: (
    owner: Owner,
    tokenAccountA: AccountInfo,
    tokenAccountB: AccountInfo,
    amount: OrcaU64,
    slippageTolerence?: Percentage
  ) => Promise<any>;

  loadTickArray: (ticketIndex: number) => Promise<any>;

  // return distribution of liquidity
  // required to visualize liquidity in UI
  getLiquidityDistribution: () => Promise<any>;

  // return the suggested price range
  getSuggestedPriceRange: (conservative: boolean) => Promise<any>;
}
