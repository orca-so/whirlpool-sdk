import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ParsableEntity, staticImplements } from ".";
import { PDA } from "../utils";

export interface TokenAccount {
  readonly mint: PublicKey;
  readonly owner: PublicKey;
  readonly amount: u64;
}

@staticImplements<ParsableEntity<TokenAccount>>()
export class TokenEntity {
  private constructor() {}

  public static deriveAddress(ownerAddress: PublicKey, tokenMint: PublicKey): PublicKey {
    return PDA.derive(ASSOCIATED_TOKEN_PROGRAM_ID, [ownerAddress, TOKEN_PROGRAM_ID, tokenMint])
      .publicKey;
  }

  public static parse(accountData: Buffer | undefined | null): TokenAccount | null {
    if (accountData === undefined || accountData === null || accountData.length === 0) {
      return null;
    }

    const accountInfo = AccountLayout.decode(accountData);

    // TODO check isInitialized = accountInfo.state !== 0 ?

    return {
      mint: new PublicKey(accountInfo.mint),
      owner: new PublicKey(accountInfo.owner),
      amount: u64.fromBuffer(accountInfo.amount),
    };
  }
}
