import { Instruction } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { PublicKey } from "@solana/web3.js";

export type ResolvedTokenAddressInstruction = { address: PublicKey } & Instruction;

export const emptyInstruction: Instruction = {
  instructions: [],
  cleanupInstructions: [],
  signers: [],
};
