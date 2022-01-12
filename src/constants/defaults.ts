import { Commitment } from "@solana/web3.js";
import { OrcaNetwork, Percentage } from "..";

export const defaultSlippagePercentage = Percentage.fromFraction(1, 1000); // 0.1%

export const defaultNetwork: OrcaNetwork = OrcaNetwork.MAINNET;
export const defaultCommitment: Commitment = "singleGossip";
