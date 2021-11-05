import { PublicKey } from "@solana/web3.js";
import { OrcaU64, Percentage } from "../../../public";
import { FeeTier, Network, OrcaWhirlpool, OrcaWhirlpoolArgs } from "../../../public/whirlpools";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "../../../public/whirlpools/constants";

interface OrcaWhirpoolImplConstructorArgs {
  network: Network;
  args: OrcaWhirlpoolArgs;
}

export class OrcaWhirpoolImpl implements OrcaWhirlpool {
  private programId: PublicKey;
  private whirlpoolsConfig: PublicKey;

  private feeTier: FeeTier;
  private tokenMintA: PublicKey;
  private tokenMintB: PublicKey;

  constructor({
    network,
    args: { tokenMintA, tokenMintB, feeTier },
  }: OrcaWhirpoolImplConstructorArgs) {
    this.programId = getWhirlpoolProgramId(network);
    this.whirlpoolsConfig = getWhirlpoolsConfig(network);
    this.feeTier = feeTier;

    // consistent ordering of tokenA and tokenB
    const inOrder = tokenMintA.toBase58() < tokenMintB.toBase58();
    this.tokenMintA = inOrder ? tokenMintA : tokenMintB;
    this.tokenMintB = inOrder ? tokenMintB : tokenMintA;
  }

  async getOpenPositionQuote(
    token: PublicKey,
    tokenAmount: OrcaU64,
    tickLowerIndex: number,
    tickUpperIndex: number,
    slippageTolerence?: Percentage | undefined
  ): Promise<{ maxTokenA: number; maxTokenB: number; liquidity: number }> {
    return { maxTokenA: 0, maxTokenB: 0, liquidity: 0 };
  }
}
