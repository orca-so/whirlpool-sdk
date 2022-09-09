import { Address } from "@project-serum/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection } from "@solana/web3.js";
import Decimal from "decimal.js";
import { OrcaNetwork } from "./constants/public/network";
import { PoolData } from "./types";
import { OrcaAdmin } from "./admin/orca-admin";
import {
  defaultNetwork,
  getDefaultConnection,
  getDefaultOffchainDataURI,
} from "./constants/public/defaults";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "./constants/programs";
import { OrcaDAL } from "./dal/orca-dal";
import { OrcaPool } from "./pool/orca-pool";
import { OrcaPosition } from "./position/orca-position";
import {
  BaseTokenInfo,
  DEFAULT_OTHER_BASE_TOKENS,
  getTokenUSDPrices,
  TokenUSDPrices,
} from "./utils/token-price";
import { convertWhirlpoolDataToPoolData } from "./pool/convert-data";
import { UserPositionData } from "./types";
import { convertPositionDataToUserPositionData } from "./position/convert-data";
import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk";
import { OrcaZooplankton } from "./offchain/orca-zp";
import { toPubKey } from "./utils/address";

// Global rules for Decimals
//  - 40 digits of precision for the largest number
//  - 20 digits of precision for the smallest number
//  - Always round towards 0 to mirror smart contract rules
Decimal.set({ precision: 40, toExpPos: 40, toExpNeg: -20, rounding: 1 });

export type OrcaWhirlpoolClientConfig = {
  network?: OrcaNetwork;
  connection?: Connection;
  whirlpoolConfig?: Address;
  programId?: Address;
  offchainDataURI?: string;
};

export class OrcaWhirlpoolClient {
  public readonly data: OrcaDAL;
  public readonly admin: OrcaAdmin;
  public readonly pool: OrcaPool;
  public readonly position: OrcaPosition;
  public readonly offchain: OrcaZooplankton;

  constructor(config?: OrcaWhirlpoolClientConfig) {
    const network = config?.network || defaultNetwork;
    const connection = config?.connection || getDefaultConnection(network);
    const whirlpoolsConfig = config?.whirlpoolConfig || getWhirlpoolsConfig(network);
    const programId = config?.programId || getWhirlpoolProgramId(network);
    const offchainDataURI = config?.offchainDataURI || getDefaultOffchainDataURI(network);

    this.data = new OrcaDAL(whirlpoolsConfig, programId, connection);
    this.admin = new OrcaAdmin(this.data);
    this.pool = new OrcaPool(this.data);
    this.position = new OrcaPosition(this.data);
    this.offchain = new OrcaZooplankton(offchainDataURI);
  }

  /**
   * Use on-chain dex data to derive usd prices for tokens.
   *
   * @param poolAddresses pools to be used for price discovery
   * @param baseTokenMint a token mint with known stable usd price (e.g. USDC)
   * @param baseTokenUSDPrice baseTokenMint's usd price. defaults to 1, assuming `baseTokenMint` is a USD stable coin
   * @param otherBaseTokens optional list of token mints and USD prices to prioritize as base. If the price of an "other" base token is derivable from on-chain dex data, the on-chain price will be used instead of the provided price.
   * @param refresh defaults to refreshing the cache
   */
  public async getTokenPrices(
    poolAddresses: Address[],
    baseTokenMint: Address,
    baseTokenUSDPrice = new Decimal(1),
    otherBaseTokens: BaseTokenInfo[] = DEFAULT_OTHER_BASE_TOKENS,
    refresh = true
  ): Promise<TokenUSDPrices> {
    const allPools = await this.data.listPools(poolAddresses, refresh);
    const pools = allPools.filter((pool): pool is WhirlpoolData => pool !== null);
    return getTokenUSDPrices(this.data, pools, baseTokenMint, baseTokenUSDPrice, otherBaseTokens);
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
    return convertPositionDataToUserPositionData(this.data, walletAddress, refresh);
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
    return convertWhirlpoolDataToPoolData(this.data, poolAddresses, refresh);
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
