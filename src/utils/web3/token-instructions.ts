import { Instruction } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { AccountLayout, NATIVE_MINT, Token, TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { ResolvedTokenAddressInstruction } from "./helpers";

// TODO use native-mint instead
export function createWSOLAccountInstructions(
  walletAddress: PublicKey,
  amountIn: u64,
  rentExemptLamports: number
): ResolvedTokenAddressInstruction {
  const tempAccount = new Keypair();

  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: walletAddress,
    newAccountPubkey: tempAccount.publicKey,
    lamports: amountIn.toNumber() + rentExemptLamports,
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID,
  });

  const initAccountInstruction = Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    tempAccount.publicKey,
    walletAddress
  );

  const closeWSOLAccountInstruction = Token.createCloseAccountInstruction(
    TOKEN_PROGRAM_ID,
    tempAccount.publicKey,
    walletAddress,
    walletAddress,
    []
  );

  return {
    address: tempAccount.publicKey,
    instructions: [createAccountInstruction, initAccountInstruction],
    cleanupInstructions: [closeWSOLAccountInstruction],
    signers: [tempAccount],
  };
}

export function createApproveInstruction(
  walletAddress: PublicKey,
  approveAmount: u64,
  userTokenAddress: PublicKey,
  transferAuthority: Keypair
): Instruction {
  const approveInstruction = Token.createApproveInstruction(
    TOKEN_PROGRAM_ID,
    userTokenAddress,
    transferAuthority.publicKey,
    walletAddress,
    [],
    new u64(approveAmount.toString())
  );

  const revokeInstruction = Token.createRevokeInstruction(
    TOKEN_PROGRAM_ID,
    userTokenAddress,
    walletAddress,
    []
  );

  return {
    instructions: [approveInstruction],
    cleanupInstructions: [revokeInstruction],
    signers: [transferAuthority],
  };
}
