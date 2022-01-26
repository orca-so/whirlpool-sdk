import { getPositionPda, getWhirlpoolPda } from "@orca-so/whirlpool-client-sdk";
import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from ".";
import { OrcaAdmin } from "./admin/orca-admin";
import { defaultNetwork, getDefaultConnection } from "./constants/defaults";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "./constants/programs";
import { OrcaDAL } from "./dal/orca-dal";
import { OrcaWhirlpool } from "./pool/orca-whirlpool";
import { OrcaPosition } from "./position/orca-position";

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

  public getPoolAddress(whirlpool: WhirlpoolData): PublicKey {
    const pda = getWhirlpoolPda(
      this.dal.programId,
      this.dal.whirlpoolsConfig,
      whirlpool.tokenMintA,
      whirlpool.tokenMintB,
      whirlpool.tickSpacing
    );
    return pda.publicKey;
  }

  public getPositionAddress(position: PositionData): PublicKey {
    const pda = getPositionPda(this.dal.programId, position.positionMint);
    return pda.publicKey;
  }
}
