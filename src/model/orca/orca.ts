import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaNetwork, Orca, PositionData, WhirlpoolData, OrcaConfig } from "../..";
import { OrcaDALImpl, OrcaDAL } from "../dal";
import { PositionEntity, WhirlpoolEntity } from "../entities";

export class OrcaImpl implements Orca {
  private readonly dal: OrcaDAL;
  private readonly client: any; // WhirlpoolClient from low-level-sdk

  constructor(connection: Connection, network: OrcaNetwork, config?: OrcaConfig) {
    this.dal = new OrcaDALImpl(connection, network, config?.commitment || "singleGossip");
  }

  public async getWhirlpool(address: PublicKey, refresh = false): Promise<WhirlpoolData | null> {
    return this.dal.getWhirlpool(address, refresh);
  }

  public async getWhirlpoolByTokens(
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    refresh = false
  ): Promise<WhirlpoolData | null> {
    const address = WhirlpoolEntity.deriveAddress(
      this.dal.whirlpoolsConfig,
      this.dal.programId,
      tokenMintA,
      tokenMintB
    );
    return this.getWhirlpool(address, refresh);
  }

  public async listWhirlpools(addresses: PublicKey[], refresh = false): Promise<WhirlpoolData[]> {
    return this.listWhirlpools(addresses, refresh);
  }

  public async getPosition(address: PublicKey, refresh = false): Promise<PositionData | null> {
    return this.dal.getPosition(address, refresh);
  }

  public async getPositionByMint(
    positionMint: PublicKey,
    refresh = false
  ): Promise<PositionData | null> {
    const address = PositionEntity.deriveAddress(positionMint, this.dal.programId);
    return this.getPosition(address, refresh);
  }

  public async listPositions(addresses: PublicKey[], refresh = false): Promise<PositionData[]> {
    return this.listPositions(addresses, refresh);
  }

  public async listUserPositions(wallet: PublicKey): Promise<PositionData[]> {
    return this.dal.listUserPositions(wallet);
  }

  public async refreshCache(): Promise<void> {
    this.dal.refreshAll();
  }
}
