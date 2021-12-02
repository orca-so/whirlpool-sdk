import { u64 } from "@solana/spl-token";
import BN, { isBN } from "bn.js";
import Decimal from "decimal.js";
import { Token } from ".";

const TEN_DECIMAL = new Decimal(10);
const TEN_BN = new u64(10);

export class TokenAmount {
  public readonly token: Token;
  private readonly amount: BN;

  private constructor(token: Token, amount: BN) {
    this.token = token;
    this.amount = amount;
  }

  /**
   * Create a TokenAmount instance from a Token and an amount
   *
   * @param token The token
   * @param amount The amount in either BN or Decimal. If its a BN, it will be scaled accordingly and if its a Decimal, it will be taken at face value.
   * @return The TokenAmount instance
   */
  public static from(token: Token, amount: BN | Decimal): TokenAmount {
    if (isBN(amount)) {
      return TokenAmount.fromBN(token, amount);
    } else if (Decimal.isDecimal(amount)) {
      return TokenAmount.fromDecimal(token, amount as Decimal);
    }

    throw new Error("Unsupported type for amount");
  }

  /**
   * Returns a TokenAmount that represents one unit of the underlying token
   *
   * @param token The Token instance
   * @return The TokenAmount instance that represents a single unit of the Token
   */
  public static one(token: Token): TokenAmount {
    return TokenAmount.fromBN(token, TEN_BN.pow(new u64(token.decimals)));
  }

  public equals(other: TokenAmount): boolean {
    return this.token.equals(other.token) && this.amount.eq(other.amount);
  }

  public toBN(): BN {
    return this.amount;
  }

  public toDecimal(): Decimal {
    return new Decimal(this.amount.toString()).div(TEN_DECIMAL.pow(this.token.decimals));
  }

  public toString(): string {
    return `${this.toDecimal()}`;
  }

  /**
   * Divides this token amount with another token amount and returns amount of this tokens per unit of other token
   *
   * @param other Other token amount
   * @return TokenAmount of `this` token per unit of `other` token
   */
  public div(other: TokenAmount): TokenAmount {
    const thisAmount = this.amount;
    const otherAmount = other.amount;
    const otherShift = TEN_BN.pow(new u64(other.token.decimals));

    return TokenAmount.from(this.token, thisAmount.mul(otherShift).div(otherAmount));
  }

  private static fromBN(token: Token, amount: BN): TokenAmount {
    return new TokenAmount(token, amount);
  }

  private static fromDecimal(token: Token, amount: Decimal): TokenAmount {
    const amountBN = new u64(amount.mul(TEN_DECIMAL.pow(token.decimals)).toString());
    return TokenAmount.fromBN(token, amountBN);
  }
}
