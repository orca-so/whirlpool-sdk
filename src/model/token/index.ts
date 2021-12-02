import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";
import { TokenAmount } from "./amount";

export class Token {
  public readonly mint: PublicKey;
  public readonly decimals: number;
  public readonly symbol: string;
  public readonly name: string;

  public constructor(mint: PublicKey, decimals: number, symbol: string, name?: string) {
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
}
