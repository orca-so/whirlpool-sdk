import { Instruction } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { utils } from "@project-serum/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

export type ResolvedTokenAddressInstruction = { address: PublicKey } & Instruction;

export const emptyInstruction: Instruction = {
  instructions: [],
  cleanupInstructions: [],
  signers: [],
};

export function deriveATA(walletAddress: PublicKey, tokenMint: PublicKey): PublicKey {
  const [publicKey, _bump] = utils.publicKey.findProgramAddressSync(
    [walletAddress.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return publicKey;
}
