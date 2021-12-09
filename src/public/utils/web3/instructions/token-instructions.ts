import { AccountLayout, Token, TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { Instruction, SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID } from "../..";
import { ResolvedTokenAddressInstruction } from "../ata-utils";
import { Owner } from "../key-utils";

/**
 * TODO, feedback from yutaro:
 * Note that we should change the behavior of WSOL to support syncNative.
 * https://github.com/solana-labs/solana-program-library/blob/0b8961597b3adf7355e48506d7e81b3925bbacd0/token/js/client/token.js#L1405
 *
 * Essentially, we always use the user's WSOL ATA.
 * If the WSOL ATA doesn't exist, create it.
 * If the WSOL ATA exists and the balance is insufficient but the user has lamports,
 * transfer lamports to the WSOL ATA, call syncNative, and use the WSOL ATA.
 *
 * This also means that we never close the WSOL account.
 */
export const createWSOLAccountInstructions = (
  owner: PublicKey,
  solMint: PublicKey,
  amountIn: u64,
  rentExemptLamports: number
): ResolvedTokenAddressInstruction => {
  const tempAccount = new Keypair();

  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: owner,
    newAccountPubkey: tempAccount.publicKey,
    lamports: amountIn.toNumber() + rentExemptLamports,
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID,
  });

  const initAccountInstruction = Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID,
    solMint,
    tempAccount.publicKey,
    owner
  );

  const closeWSOLAccountInstruction = Token.createCloseAccountInstruction(
    TOKEN_PROGRAM_ID,
    tempAccount.publicKey,
    owner,
    owner,
    []
  );

  return {
    address: tempAccount.publicKey,
    instructions: [createAccountInstruction, initAccountInstruction],
    cleanupInstructions: [closeWSOLAccountInstruction],
    signers: [tempAccount],
  };
};

export function createAssociatedTokenAccountInstruction(
  associatedTokenAddress: PublicKey,
  fundSource: PublicKey,
  destination: PublicKey,
  tokenMint: PublicKey,
  fundAddressOwner: Owner
): Instruction {
  const systemProgramId = new PublicKey("11111111111111111111111111111111");
  const keys = [
    {
      pubkey: fundSource,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: destination,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: tokenMint,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  const createATAInstruction = new TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
  return {
    instructions: [createATAInstruction],
    cleanupInstructions: [],
    signers: fundAddressOwner.signer ? [fundAddressOwner.signer] : [],
  };
}
