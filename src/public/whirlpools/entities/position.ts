import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import { q64 } from "../..";
import { PDA } from "../../../model/pda";
import { Token } from "../../../model/token";
import { AddLiquidityQuote, OrcaPosition, PositionStatus, TickMath } from "..";
import { TokenAmount } from "../../../model/token/amount";
import { Percentage } from "../../utils";
import { Whirlpool, WhirlpoolAccount } from ".";
import { assert } from "console";

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
  private readonly pda: PDA;

  // This entity can only be created by calling Position.fetch(...)
  private constructor(account: PositionAccount) {
    invariant(account.tickLower < account.tickUpper, "tick boundaries are not in order");
    this.account = account;
    this.pda = Position.getPDA(account.whirlpool, account.positionMint, account.programId);
  }

  public get address(): PublicKey {
    return this.pda.publicKey;
  }

  public equals(position: Position): boolean {
    const { positionMint, programId } = this.account;
    const { positionMint: otherMint, programId: otherProgramId } = position.account;
    return positionMint.equals(otherMint) && programId.equals(otherProgramId);
  }

  public static async fetch<A extends Token, B extends Token>(
    connection: Connection,
    address: PublicKey
  ): Promise<Position> {
    // TODO: Also fetch whirlpool account here to get token A and B objects
    throw new Error("TODO - fetch, then deserialize the account data into Position object");
  }

  public static getPDA(
    whirlpool: PublicKey,
    positionMint: PublicKey,
    whirlpoolProgram: PublicKey
  ): PDA {
    return PDA.derive(whirlpoolProgram, [Position.SEED_HEADER, whirlpool, positionMint]);
  }
}
