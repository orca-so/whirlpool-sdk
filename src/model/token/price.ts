import BN from "bn.js";
import Decimal from "decimal.js";
import { Token } from ".";
import { TokenAmount } from "./amount";

export class TokenPrice {
  public readonly baseToken: Token;
  public readonly quoteToken: Token;
  private readonly price: BN;

  private constructor(base: Token, quote: Token, price: BN) {
    if (base.equals(quote)) {
      throw new Error("Base and Quote tokens cannot be the same");
    }

    this.baseToken = base;
    this.quoteToken = quote;
    this.price = price;
  }

  public static fromBaseAndQuoteAmounts(
    baseAmount: TokenAmount,
    quoteAmount: TokenAmount
  ): TokenPrice {
    const oneBaseTokenInQuoteTokens = quoteAmount.div(baseAmount);
    return TokenPrice.fromBaseTokenAndQuoteAmount(baseAmount.token, oneBaseTokenInQuoteTokens);
  }

  public static fromBaseTokenAndQuoteAmount(base: Token, quoteAmount: TokenAmount): TokenPrice {
    return new TokenPrice(base, quoteAmount.token, quoteAmount.toBN());
  }

  public toBN(): BN {
    return this.price;
  }

  public toDecimal(): Decimal {
    return new Decimal(this.price.toString()).div(new Decimal(10).pow(this.quoteToken.decimals));
  }

  public invert(): TokenPrice {
    return TokenPrice.fromBaseAndQuoteAmounts(
      TokenAmount.from(this.quoteToken, this.price),
      TokenAmount.one(this.baseToken)
    );
  }

  public match(base: Token, quote: Token): TokenPrice {
    if (this.baseToken.equals(base) && this.quoteToken.equals(quote)) {
      return this;
    } else if (this.baseToken.equals(quote) && this.quoteToken.equals(base)) {
      return this.invert();
    }

    throw new Error("Incompatiable base/quote provided");
  }
}
