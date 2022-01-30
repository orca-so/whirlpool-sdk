import { getPositionPda, getWhirlpoolPda, TickSpacing } from "@orca-so/whirlpool-client-sdk";
import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { Address } from "@project-serum/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import { OrcaNetwork } from ".";
import { OrcaAdmin } from "./admin/orca-admin";
import { defaultNetwork, getDefaultConnection } from "./constants/defaults";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "./constants/programs";
import { OrcaDAL } from "./dal/orca-dal";
import { OrcaWhirlpool } from "./pool/orca-whirlpool";
import { OrcaPosition } from "./position/orca-position";
import { toPubKey } from "./utils/address";
import { getTokenUSDPrices, TokenUSDPrices } from "./utils/price";

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
   */
  public async getTokenPrices(
    poolAddresses: Address[],
    baseTokenMint: Address,
    baseTokenUSDPrice = new Decimal(1),
    otherBaseTokenMints: Address[] = [NATIVE_MINT]
  ): Promise<TokenUSDPrices> {
    const allPools = await this.dal.listPools(poolAddresses, true);
    const pools = allPools.filter((pool): pool is WhirlpoolData => pool !== null);
    return await getTokenUSDPrices(pools, baseTokenMint, baseTokenUSDPrice, otherBaseTokenMints);
  }

  /**
   * Fetch a list of positions owned by the wallet address.
   *
   * @param walletAddress wallet address
   * @returns a list of positions owned by the wallet address
   */
  public async getUserPositions(walletAddress: Address): Promise<PublicKey[]> {
    const potentialPositionAddresses: Address[] = [];
    const userTokens = await this.dal.listUserTokens(walletAddress);
    userTokens.forEach(({ amount, decimals, mint }) => {
      if (amount === "1" && decimals === 0 && !!mint) {
        potentialPositionAddresses.push(this.derivePositionAddress(mint));
      }
    });

    const positions = await this.dal.listPositions(potentialPositionAddresses, true);
    invariant(potentialPositionAddresses.length === positions.length, "not enough positions data");
  }

  /**
   * Populate the cache with whirlpool data, and all of its associated data, including:
   *   tokenMintA, tokenMintB, tokenVaultA, tokenVaultB, rewardInfo.mint, rewardInfo.vault
   */
  public async hydrate(poolAddresses: Address[]): Promise<void> {
    const pools = await this.dal.listPools(poolAddresses, true);

    const allTokenAccounts: Set<string> = new Set();
    const allMintInfos: Set<string> = new Set();
    pools.forEach((pool) => {
      if (pool) {
        allTokenAccounts.add(pool.tokenVaultA.toBase58());
        allTokenAccounts.add(pool.tokenVaultB.toBase58());
        allMintInfos.add(pool.tokenMintA.toBase58());
        allMintInfos.add(pool.tokenMintB.toBase58());

        pool.rewardInfos.forEach(({ vault, mint }) => {
          allTokenAccounts.add(vault.toBase58());
          allMintInfos.add(mint.toBase58());
        });
      }
    });

    await this.dal.listTokenInfos(Array.from(allTokenAccounts), true);
    await this.dal.listMintInfos(Array.from(allMintInfos), true);
  }
}
