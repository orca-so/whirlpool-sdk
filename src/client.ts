import { Address } from "@project-serum/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import Decimal from "decimal.js";
import { PoolData } from "./types";
import { getTokenUSDPrices, TokenUSDPrices } from "./utils/token-price";
import { convertWhirlpoolDataToPoolData } from "./pool/convert-data";
import { UserPositionData } from "./types";
import { convertPositionDataToUserPositionData } from "./position/convert-data";
import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk";
import { toPubKey } from "./utils/address";
import { WhirlpoolContext } from "./context";

// Global rules for Decimals
//  - 40 digits of precision for the largest number
//  - 20 digits of precision for the smallest number
//  - Always round towards 0 to mirror smart contract rules
Decimal.set({ precision: 40, toExpPos: 40, toExpNeg: -20, rounding: 1 });

export class OrcaWhirlpoolClient {
  public readonly ctx: WhirlpoolContext;

  constructor(context: WhirlpoolContext) {
    this.ctx = context;
  }

  /**
   * Use on-chain dex data to derive usd prices for tokens.
   *
   * @param poolAddresses pools to be used for price discovery
   * @param baseTokenMint a token mint with known stable usd price (e.g. USDC)
   * @param baseTokenUSDPrice baseTokenMint's usd price. defaults to 1, assuming `baseTokenMint` is a USD stable coin
   * @param otherBaseTokenMints optional list of token mints to prioritize as base
   * @param refresh defaults to refreshing the cache
   */
  public async getTokenPrices(
    poolAddresses: Address[],
    baseTokenMint: Address,
    baseTokenUSDPrice = new Decimal(1),
    otherBaseTokenMints: Address[] = [NATIVE_MINT],
    refresh = true
  ): Promise<TokenUSDPrices> {
    const allPools = await this.ctx.accountFetcher.listPools(poolAddresses, refresh);
    const pools = allPools.filter((pool): pool is WhirlpoolData => pool !== null);
    return getTokenUSDPrices(
      this.ctx.accountFetcher,
      pools,
      baseTokenMint,
      baseTokenUSDPrice,
      otherBaseTokenMints
    );
  }

  /**
   * Fetch position data owned by the wallet address.
   *
   * @param walletAddress wallet address
   * @param refresh defaults to refreshing the cache
   * @returns positions owned by the wallet address
   */
  public async getUserPositions(
    walletAddress: Address,
    refresh = true
  ): Promise<Record<string, UserPositionData>> {
    return convertPositionDataToUserPositionData(this.ctx, walletAddress, refresh);
  }

  /**
   * Fetch list of pool data.
   *
   * @param poolAddresses list of pools to retrieve
   * @param refresh defaults to refreshing the cache
   * @returns list of pool data
   */
  public async getPools(
    poolAddresses: Address[],
    refresh = true
  ): Promise<Record<string, PoolData>> {
    return convertWhirlpoolDataToPoolData(this.ctx, poolAddresses, refresh);
  }

  /**
   * Fetch pool data.
   *
   * @param poolAddress pool address
   * @param refresh defaults to refreshing the cache
   * @returns pool data
   */
  public async getPool(poolAddress: Address, refresh = true): Promise<PoolData | null> {
    const pool = (await this.getPools([poolAddress], refresh))[toPubKey(poolAddress).toBase58()];
    return pool || null;
  }
}
