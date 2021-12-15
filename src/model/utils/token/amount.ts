import { u64 } from "@solana/spl-token";
import { isBN } from "bn.js";
import Decimal from "decimal.js";
import { Token } from ".";

const TEN_DECIMAL = new Decimal(10);
const TEN__U64 = new u64(10);

export class TokenAmount<T extends Token> {
  public readonly token: T;
  private readonly amount: u64;

  private constructor(token: T, amount: u64) {
    this.token = token;
    this.amount = amount;
  }

  /**
   * Create a TokenAmount instance from a Token and an amount
   *
   * @param token The token
   * @param amount The amount in either u64 or Decimal. If its a u64, it will be scaled accordingly (using token.decimals) and if its a Decimal, it will be taken at face value.
   * @return The TokenAmount instance
   */
  public static from<T extends Token>(token: T, amount: u64 | Decimal): TokenAmount<T> {
    if (isBN(amount)) {
      return TokenAmount.from_U64(token, amount);
    } else if (Decimal.isDecimal(amount)) {
      return TokenAmount.fromDecimal(token, amount as Decimal);
    }

    throw new Error("Unsupported type for amount");
  }

  /**
   * Returns a TokenAmount that represents `units` units of `token`
   *
   * @param token The Token instance
   * @return The TokenAmount instance that represents `units` units of the Token
   */
  public static units<T extends Token>(token: T, units: number | u64): TokenAmount<T> {
    return TokenAmount.from_U64(
      token,
      TEN__U64.pow(new u64(token.decimals)).mul(new u64(units.toString()))
    );
  }

  /**
   * Returns a TokenAmount that represents one unit of the underlying token
   *
   * @param token The Token instance
   * @return The TokenAmount instance that represents a single unit of the Token
   */
  public static one<T extends Token>(token: T): TokenAmount<T> {
    return TokenAmount.units(token, 1);
  }

  /**
   * Returns a TokenAmount that represents 0 units of the underlying token
   *
   * @param token The Token instance
   * @return The TokenAmount instance that represents 0 units of the Token
   */
  public static zero<T extends Token>(token: T): TokenAmount<T> {
    return TokenAmount.units(token, 0);
  }

  public equals(other: TokenAmount<T>): boolean {
    return this.token.equals(other.token) && this.amount.eq(other.amount);
  }

  public to_U64(): u64 {
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
  public div<U extends Token>(other: TokenAmount<U>): TokenAmount<T> {
    const thisAmount = this.amount;
    const otherAmount = other.amount;
    const otherShift = TEN__U64.pow(new u64(other.token.decimals));

    return TokenAmount.from(this.token, thisAmount.mul(otherShift).div(otherAmount));
  }

  private static from_U64<T extends Token>(token: T, amount: u64): TokenAmount<T> {
    return new TokenAmount(token, amount);
  }

  private static fromDecimal<T extends Token>(token: T, amount: Decimal): TokenAmount<T> {
    const amount_U64 = new u64(amount.mul(TEN_DECIMAL.pow(token.decimals)).toString());
    return TokenAmount.from_U64(token, amount_U64);
  }
}
