import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import { OrcaDAL } from "../../dal/orca-dal";
import { deserializeTokenAccount } from "./deserialize-token-account";
import { emptyInstruction, ResolvedTokenAddressInstruction } from "./helpers";
import { createWSOLAccountInstructions } from "./token-instructions";

/**
 * IMPORTANT: wrappedSolAmountIn should only be used for input/source token that
 *            could be SOL. This is because when SOL is the output, it is the end
 *            destination, and thus does not need to be wrapped with an amount.
 *
 * @param connection Solana connection class
 * @param ownerAddress The user's public key
 * @param tokenMint Token mint address
 * @param wrappedSolAmountIn Optional. Only use for input/source token that could be SOL
 * @returns
 */
export async function resolveOrCreateATA(
  dal: OrcaDAL,
  connection: Connection,
  ownerAddress: PublicKey,
  tokenMint: PublicKey,
  wrappedSolAmountIn = new u64(0)
): Promise<ResolvedTokenAddressInstruction> {
  const instructions = await resolveOrCreateATAs(dal, connection, ownerAddress, [
    { tokenMint, wrappedSolAmountIn },
  ]);
  return instructions[0]!;
}

type ResolvedTokenAddressRequest = {
  tokenMint: PublicKey;
  wrappedSolAmountIn?: u64;
};

/**
 * IMPORTANT: wrappedSolAmountIn should only be used for input/source token that
 *            could be SOL. This is because when SOL is the output, it is the end
 *            destination, and thus does not need to be wrapped with an amount.
 *
 * @param connection Solana connection class
 * @param ownerAddress The user's public key
 * @param tokenMint Token mint address
 * @param wrappedSolAmountIn Optional. Only use for input/source token that could be SOL
 * @returns
 */
export async function resolveOrCreateATAs(
  dal: OrcaDAL,
  connection: Connection,
  ownerAddress: PublicKey,
  requests: ResolvedTokenAddressRequest[]
): Promise<ResolvedTokenAddressInstruction[]> {
  const nonNativeMints = requests.filter(({ tokenMint }) => !tokenMint.equals(NATIVE_MINT));
  const nativeMints = requests.filter(({ tokenMint }) => tokenMint.equals(NATIVE_MINT));
  invariant(nativeMints.length <= 1, "Cannot try to create multiple WSolAccounts");

  let instructions: ResolvedTokenAddressInstruction[] = [];

  if (nonNativeMints.length > 0) {
    const nonNativeAddresses = await Promise.all(
      nonNativeMints.map(({ tokenMint }) => deriveATA(ownerAddress, tokenMint))
    );
    const tokenAccountInfos = await connection.getMultipleAccountsInfo(nonNativeAddresses);
    const tokenAccounts = tokenAccountInfos.map((tai) =>
      deserializeTokenAccount(tai?.data as Buffer)
    );
    instructions = instructions.concat(
      tokenAccounts.map((tokenAccount, index) => {
        const ataAddress = nonNativeAddresses[index]!;
        if (tokenAccount) {
          return { address: ataAddress, ...emptyInstruction };
        } else {
          const createAtaInstruction = Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            nonNativeMints[index]!.tokenMint,
            ataAddress,
            ownerAddress,
            ownerAddress
          );

          return {
            address: ataAddress,
            instructions: [createAtaInstruction],
            cleanupInstructions: [],
            signers: [],
          };
        }
      })
    );
  }

  if (nativeMints.length > 0) {
    const accountRentExempt = await dal.getAccountRentExempt();
    const wrappedSolAmountIn = nativeMints[0]?.wrappedSolAmountIn || new u64(0);
    instructions.push(
      createWSOLAccountInstructions(ownerAddress, wrappedSolAmountIn, accountRentExempt)
    );
  }

  return instructions;
}

export async function deriveATA(ownerAddress: PublicKey, tokenMint: PublicKey): Promise<PublicKey> {
  return await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    tokenMint,
    ownerAddress
  );
}
