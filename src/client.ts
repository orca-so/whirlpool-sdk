import { getPositionPda, getWhirlpoolPda } from "@orca-so/whirlpool-client-sdk";
import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { OrcaNetwork } from ".";
import { defaultCommitment, defaultNetwork } from "./constants/defaults";
import { OrcaDAL } from "./dal/orca-dal";
import { OrcaPosition } from "./position/orca-position";

export type OrcaWhirlpoolClientConfig = {
  network?: OrcaNetwork;
  commitment?: Commitment;
};

export class OrcaWhirlpoolClient {
  public readonly position: OrcaPosition;
  // public readonly pool: OrcaWhirlpool;
  public readonly dal: OrcaDAL;

  constructor(connection: Connection, config?: OrcaWhirlpoolClientConfig) {
    this.dal = new OrcaDAL(
      connection,
      config?.network || defaultNetwork,
      config?.commitment || defaultCommitment
    );
    this.position = new OrcaPosition(this.dal);
    // this.pool = new OrcaWhirlpool(this.dal);
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
