import { MintLayout, u64 } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { TokenAmount } from "./amount";

export class Token {
  public readonly mint: PublicKey;
  public readonly decimals: number;
  public readonly symbol?: string;
  public readonly name?: string;

  public constructor(mint: PublicKey, decimals: number, symbol?: string, name?: string) {
    this.mint = mint;
    this.decimals = decimals;
    this.symbol = symbol;
    this.name = name || symbol;
  }

  public toAmount(amount: u64 | Decimal): TokenAmount<Token> {
    return TokenAmount.from(this, amount);
  }

  public equals(other: Token): boolean {
    return this.mint.equals(other.mint);
  }

  public static fromMintAccountData(
    mintAccountPubkey: PublicKey,
    mintAccountData: Buffer,
    symbol?: string,
    name?: string
  ): Token {
    const mintInfo = MintLayout.decode(mintAccountData);
    return new Token(mintAccountPubkey, mintInfo.decimals, symbol, name);
  }

  public static async fromMintAccount(
    mintAccount: PublicKey,
    connection: Connection,
    symbol?: string,
    name?: string
  ): Promise<Token> {
    const account = await connection.getAccountInfo(mintAccount);

    if (!account?.data) {
      throw new Error(`Unable to fetch data for account ${mintAccount.toString()}`);
    }

    return Token.fromMintAccountData(mintAccount, account?.data, symbol, name);
  }

  public static sort<T extends Token[]>(...tokens: T): T {
    return tokens.sort((tokenA, tokenB) =>
      tokenA.mint.toBase58() >= tokenB.mint.toBase58() ? 1 : -1
    );
  }
}
