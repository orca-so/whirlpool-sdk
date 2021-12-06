import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import { q64 } from "../..";
import { PDA } from "../../../model/pda";

export interface PositionAccount {
  whirlpool: PublicKey;

  positionMint: PublicKey;
  liquidity: u64;
  tickLower: number;
  tickUpper: number;

  feeGrowthCheckpointA: q64;
  feeOwedA: u64;

  feeGrowthCheckpointB: q64;
  feeOwedB: u64;

  rewardGrowthCheckpoint0: q64;
  rewardOwed0: u64;

  rewardGrowthCheckpoint1: q64;
  rewardOwed1: u64;

  rewardGrowthCheckpoint2: q64;
  rewardOwed2: u64;

  programId: PublicKey;
}

export class Position {
  public readonly account: PositionAccount;

  private static SEED_HEADER = "position";
  private pda?: PDA;

  constructor(account: PositionAccount) {
    invariant(account.tickLower < account.tickUpper, "tick boundaries are not in order");
    this.account = account;
  }

  public getAddress(): PublicKey {
    if (!this.pda) {
      const { whirlpool, positionMint, programId } = this.account;
      this.pda = Position.getPDA(whirlpool, positionMint, programId);
    }

    return this.pda.publicKey;
  }

  public async equals(position: Position): Promise<boolean> {
    const { positionMint, programId } = this.account;
    const { positionMint: otherMint, programId: otherProgramId } = position.account;
    return positionMint.equals(otherMint) && programId.equals(otherProgramId);
  }

  public static async fetch(connection: Connection, address: PublicKey): Promise<Position> {
    throw new Error("TODO - fetch, then deserialize the account data into Position object");
  }

  public static getPDA(
    whirlpool: PublicKey,
    positioMint: PublicKey,
    whirlpoolProgram: PublicKey
  ): PDA {
    return PDA.derive(whirlpoolProgram, [Position.SEED_HEADER, whirlpool, positioMint]);
  }
}
