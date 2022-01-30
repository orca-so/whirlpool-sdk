import { getPositionPda, getWhirlpoolPda, TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { Address } from "@project-serum/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import { OrcaNetwork } from "./constants/public/network";
import { PoolData } from "./types";
import { OrcaAdmin } from "./admin/orca-admin";
import { defaultNetwork, getDefaultConnection } from "./constants/defaults";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "./constants/programs";
import { OrcaDAL } from "./dal/orca-dal";
import { OrcaWhirlpool } from "./pool/orca-whirlpool";
import { OrcaPosition } from "./position/orca-position";
import { toPubKey } from "./utils/address";
import { getTokenUSDPrices, TokenUSDPrices } from "./pool/price";
import { convertWhirlpoolDataToPoolData } from "./pool/convert-data";
import { UserPositionData } from ".";
import { convertPositionDataToUserPositionData } from "./position/convert-data";

export type OrcaWhirlpoolClientConfig = {
  network?: OrcaNetwork;
  connection?: Connection;
  whirlpoolConfig?: PublicKey;
  programId?: PublicKey;
};

export class OrcaWhirlpoolClient {
  public readonly position: OrcaPosition;
  public readonly pool: OrcaWhirlpool;
  public readonly admin: OrcaAdmin;
  public readonly dal: OrcaDAL;

  constructor(config?: OrcaWhirlpoolClientConfig) {
    const network = config?.network || defaultNetwork;
    const connection = config?.connection || getDefaultConnection(network);
    const whirlpoolsConfig = config?.whirlpoolConfig || getWhirlpoolsConfig(network);
    const programId = config?.programId || getWhirlpoolProgramId(network);

    this.dal = new OrcaDAL(whirlpoolsConfig, programId, connection);
    this.position = new OrcaPosition(this.dal);
    this.pool = new OrcaWhirlpool(this.dal);
    this.admin = new OrcaAdmin(this.dal);
  }

  public derivePoolAddress(
    tokenMintA: Address,
    tokenMintB: Address,
    tickSpacing: TickSpacing
  ): PublicKey {
    // TODO tokenMintA and tokenMintB ordering
    const pda = getWhirlpoolPda(
      this.dal.programId,
      this.dal.whirlpoolsConfig,
      toPubKey(tokenMintA),
      toPubKey(tokenMintB),
      tickSpacing
    );
    return pda.publicKey;
  }

  public derivePositionAddress(positionMint: Address): PublicKey {
    const pda = getPositionPda(this.dal.programId, toPubKey(positionMint));
    return pda.publicKey;
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
    const allPools = await this.dal.listPools(poolAddresses, refresh);
    const pools = allPools.filter((pool): pool is WhirlpoolData => pool !== null);
    return await getTokenUSDPrices(pools, baseTokenMint, baseTokenUSDPrice, otherBaseTokenMints);
  }

  /**
   * Fetch position data owned by the wallet address.
   *
   * @param walletAddress wallet address
   * @param refresh defaults to refreshing the cache
   * @returns positions owned by the wallet address
   */
  public async getUserPositionData(
    walletAddress: Address,
    refresh = true
  ): Promise<Record<string, UserPositionData>> {
    return await convertPositionDataToUserPositionData(this.dal, walletAddress, refresh);
  }

  /**
   * Fetch pool data.
   *
   * @param poolAddresses list of pools to retrieve
   * @param refresh defaults to refreshing the cache
   * @returns
   */
  public async getPoolData(
    poolAddresses: Address[],
    refresh = true
  ): Promise<Record<string, PoolData>> {
    return await convertWhirlpoolDataToPoolData(this.dal, poolAddresses, refresh);
  }
}
