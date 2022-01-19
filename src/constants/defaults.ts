import { Commitment } from "@solana/web3.js";
import { Percentage } from "../utils/public/percentage";
import { OrcaNetwork } from "./public/network";

export const defaultSlippagePercentage = Percentage.fromFraction(1, 1000); // 0.1%

export const defaultNetwork: OrcaNetwork = OrcaNetwork.MAINNET;
export const defaultCommitment: Commitment = "recent";
