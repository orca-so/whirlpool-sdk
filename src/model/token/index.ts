import { MintLayout, u64 } from "@solana/spl-token";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";
import { TokenAmount } from "./amount";

export class Token {
  public readonly mint: PublicKey;
  public readonly decimals: number;
  public readonly symbol?: string;
  public readonly name?: string;

  public constructor(
    mint: PublicKey,
    decimals: number,
    symbol?: string,
    name?: string,
    connection?: Connection
  ) {
    this.mint = mint;
    this.decimals = decimals;
    this.symbol = symbol;
    this.name = name || symbol;
  }

  public toAmount(amount: BN | Decimal): TokenAmount {
    return TokenAmount.from(this, amount);
  }

  public equals(other: Token): boolean {
    return this.mint.equals(other.mint);
  }

  public static fromMintAccountData(mintAccountPubkey: PublicKey, mintAccountData: Buffer): Token {
    const mintInfo = MintLayout.decode(mintAccountData);
    return new Token(mintAccountPubkey, mintInfo.decimals);
  }

  public static async fromMintAccount(
    mintAccount: PublicKey,
    connection: Connection
  ): Promise<Token> {
    const account = await connection.getAccountInfo(mintAccount);

    if (!account?.data) {
      throw new Error(`Unable to fetch data for account ${mintAccount.toString()}`);
    }

    return Token.fromMintAccountData(mintAccount, account?.data);
  }
}
