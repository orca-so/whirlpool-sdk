import { u64 } from "@solana/spl-token";
import Decimal from "decimal.js";
import { Token } from ".";
import { TokenAmount } from "./amount";

export class TokenPrice<Base extends Token, Quote extends Token> {
  public readonly baseToken: Base;
  public readonly quoteToken: Quote;
  private readonly price: u64;

  private constructor(base: Base, quote: Quote, price: u64) {
    if (base.equals(quote)) {
      throw new Error("Base and Quote tokens cannot be the same");
    }

    this.baseToken = base;
    this.quoteToken = quote;
    this.price = price;
  }

  public static fromBaseAndQuoteAmounts<Base extends Token, Quote extends Token>(
    baseAmount: TokenAmount<Base>,
    quoteAmount: TokenAmount<Quote>
  ): TokenPrice<Base, Quote> {
    const oneBaseTokenInQuoteTokens = quoteAmount.div(baseAmount);
    return TokenPrice.fromBaseTokenAndQuoteAmount(baseAmount.token, oneBaseTokenInQuoteTokens);
  }

  public static fromBaseTokenAndQuoteAmount<Base extends Token, Quote extends Token>(
    base: Base,
    quoteAmount: TokenAmount<Quote>
  ): TokenPrice<Base, Quote> {
    return new TokenPrice(base, quoteAmount.token, quoteAmount.to_U64());
  }

  public to_U64(): u64 {
    return this.price;
  }

  public toDecimal(): Decimal {
    return new Decimal(this.price.toString()).div(new Decimal(10).pow(this.quoteToken.decimals));
  }

  public invert(): TokenPrice<Quote, Base> {
    return TokenPrice.fromBaseAndQuoteAmounts(
      TokenAmount.from(this.quoteToken, this.price),
      TokenAmount.one(this.baseToken)
    );
  }

  public matchBaseAndQuote(
    base: Base | Quote,
    quote: Quote | Base
  ): TokenPrice<Base, Quote> | TokenPrice<Quote, Base> {
    if (this.baseToken.equals(base) && this.quoteToken.equals(quote)) {
      return this;
    } else if (this.baseToken.equals(quote) && this.quoteToken.equals(base)) {
      return this.invert();
    }

    throw new Error("Incompatiable base/quote provided");
  }
}
