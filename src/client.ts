import { Commitment, Connection } from "@solana/web3.js";
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

  // public async getWhirlpoolByTokens(
  //   tokenMintA: PublicKey,
  //   tokenMintB: PublicKey,
  //   tickSpacing: TickSpacing,
  //   refresh = false
  // ): Promise<WhirlpoolData | null> {
  //   const pda = getWhirlpoolPda(
  //     this.dal.programId,
  //     this.dal.whirlpoolsConfig,
  //     tokenMintA,
  //     tokenMintB,
  //     tickSpacing
  //   );
  //   return this.dal.getWhirlpool(pda.publicKey, refresh);
  // }

  // public async getPositionByMint(
  //   positionMint: PublicKey,
  //   refresh = false
  // ): Promise<PositionData | null> {
  //   const pda = getPositionPda(this.dal.programId, positionMint);
  //   return this.dal.getPosition(pda.publicKey, refresh);
  // }
}
