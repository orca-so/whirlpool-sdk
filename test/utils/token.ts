import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk";
import { BN, Provider } from "@project-serum/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export const createInOrderMints = async (provider: Provider): Promise<[PublicKey, PublicKey]> => {
  const tokenXMintPubKey = await createMint(provider);
  const tokenYMintPubKey = await createMint(provider);

  let tokenAMintPubKey, tokenBMintPubKey;
  if (Buffer.compare(tokenXMintPubKey.toBuffer(), tokenYMintPubKey.toBuffer()) < 0) {
    tokenAMintPubKey = tokenXMintPubKey;
    tokenBMintPubKey = tokenYMintPubKey;
  } else {
    tokenAMintPubKey = tokenYMintPubKey;
    tokenBMintPubKey = tokenXMintPubKey;
  }

  return [tokenAMintPubKey, tokenBMintPubKey];
};

export async function createMint(provider: Provider, authority?: PublicKey): Promise<PublicKey> {
  if (authority === undefined) {
    authority = provider.wallet.publicKey;
  }
  const mint = Keypair.generate();
  const instructions = await createMintInstructions(provider, authority, mint.publicKey);

  const tx = new Transaction();
  tx.add(...instructions);

  await provider.send(tx, [mint]);

  return mint.publicKey;
}

async function createMintInstructions(provider: Provider, authority: PublicKey, mint: PublicKey) {
  let instructions = [
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitMintInstruction(TOKEN_PROGRAM_ID, mint, 0, authority, null),
  ];
  return instructions;
}

export async function createAndMintToTokenAccount(
  provider: Provider,
  mint: PublicKey,
  amount: number | BN
): Promise<PublicKey> {
  const tokenAccount = await createAssociatedTokenAccount(provider, mint);
  await mintToByAuthority(provider, mint, tokenAccount, amount);
  return tokenAccount;
}

export async function mintToByAuthority(
  provider: Provider,
  mint: PublicKey,
  destination: PublicKey,
  amount: number | BN
): Promise<string> {
  const tx = new Transaction();
  tx.add(
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint,
      destination,
      provider.wallet.publicKey,
      [],
      amount
    )
  );
  return provider.send(tx);
}

async function createAssociatedTokenAccount(provider: Provider, mint: PublicKey) {
  const owner = provider.wallet.publicKey;
  const associatedTokenAddress = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    owner,
    false
  );
  const tx = new Transaction();
  tx.add(
    Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      associatedTokenAddress,
      owner,
      owner
    )
  );
  await provider.send(tx);
  return associatedTokenAddress;
}
