import { AccountLayout, NATIVE_MINT, u64 } from "@solana/spl-token";
import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { deserializeTokenAccount } from "./deserialize-token-account";
import { deriveATA, emptyInstruction, ResolvedTokenAddressInstruction } from "./helpers";
import { createATAInstruction, createWSOLAccountInstructions } from "./token-instructions";

/**
 * IMPORTANT: wrappedSolAmountIn should only be used for input/source token that
 *            could be SOL. This is because when SOL is the output, it is the end
 *            destination, and thus does not need to be wrapped with an amount.
 *
 * @param connection Solana connection class
 * @param owner The keypair for the user's wallet or just the user's public key
 * @param tokenMint Token mint address
 * @param wrappedSolAmountIn Optional. Only use for input/source token that could be SOL
 * @returns
 */
export async function resolveOrCreateAssociatedTokenAddress(
  connection: Connection,
  walletAddress: PublicKey,
  tokenMint: PublicKey,
  wrappedSolAmountIn = new u64(0)
): Promise<ResolvedTokenAddressInstruction> {
  if (!tokenMint.equals(NATIVE_MINT)) {
    const derivedAddress = deriveATA(walletAddress, tokenMint);

    // Check if current wallet has an ATA for this spl-token mint. If not, create one.
    let resolveAtaInstruction = emptyInstruction;
    await connection.getAccountInfo(derivedAddress).then((info) => {
      const tokenAccountInfo = deserializeTokenAccount(info?.data);

      if (!tokenAccountInfo) {
        resolveAtaInstruction = createATAInstruction(
          derivedAddress,
          walletAddress,
          walletAddress,
          tokenMint
        );
      }
    });

    return {
      address: derivedAddress,
      instructions: resolveAtaInstruction.instructions,
      cleanupInstructions: resolveAtaInstruction.cleanupInstructions,
      signers: resolveAtaInstruction.signers,
    };
  } else {
    const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
      AccountLayout.span
    );
    // Create a temp-account to transfer SOL in the form of WSOL
    return createWSOLAccountInstructions(walletAddress, wrappedSolAmountIn, accountRentExempt);
  }
}
