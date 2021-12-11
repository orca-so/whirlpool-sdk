import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { u64 } from "@solana/spl-token";
import { q64 } from "../../public";
import { PDA } from "../utils/pda";

export interface PositionRewardInfo {
  readonly growthInsideCheckpoint: q64;
  readonly amountOwed: u64;
}

export interface PositionAccount {
  readonly whirlpool: PublicKey;

  readonly positionMint: PublicKey;
  readonly liquidity: u64;
  readonly tickLower: number;
  readonly tickUpper: number;

  readonly feeGrowthCheckpointA: q64;
  readonly feeOwedA: u64;

  readonly feeGrowthCheckpointB: q64;
  readonly feeOwedB: u64;

  readonly rewardInfos: [PositionRewardInfo, PositionRewardInfo, PositionRewardInfo];

  readonly programId: PublicKey; // TODO most likely remove
}

export class Position {
  public readonly account: PositionAccount;

  // TODO move these to constant?
  private static SEED_HEADER = "position";
  private readonly pda: PDA;

  // This entity can only be created by calling Position.fetch(...)
  // TODO most likely not needed, make private empty constructure
  private constructor(account: PositionAccount) {
    invariant(account.tickLower < account.tickUpper, "tick boundaries are not in order");
    this.account = account;
    this.pda = Position.getPDA(account.whirlpool, account.positionMint, account.programId);
  }

  public get address(): PublicKey {
    return this.pda.publicKey;
  }

  public static async fetch(connection: Connection, address: PublicKey): Promise<Position> {
    // TODO: Also fetch whirlpool account here to get token A and B objects
    throw new Error("TODO - fetch, then deserialize the account data into Position object");
  }

  public static getAddress(
    whirlpool: PublicKey,
    positionMint: PublicKey,
    whirlpoolProgram: PublicKey
  ): PublicKey {
    return PDA.derive(whirlpoolProgram, [Position.SEED_HEADER, whirlpool, positionMint]).publicKey;
  }

  public static getPDA(
    whirlpool: PublicKey,
    positionMint: PublicKey,
    whirlpoolProgram: PublicKey
  ): PDA {
    return PDA.derive(whirlpoolProgram, [Position.SEED_HEADER, whirlpool, positionMint]);
  }
}
