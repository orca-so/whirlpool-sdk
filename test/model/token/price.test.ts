import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { Token } from "../../../src/model/utils/token";
import { TokenAmount } from "../../../src/model/utils/token/amount";
import { TokenPrice } from "../../../src/model/utils/token/price";

const eth = new Token(new PublicKey("2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk"), 18, "ETH");
const usdc = new Token(new PublicKey("BXXkv6z8ykpG1yuvUDPgh732wzVHB69RnB9YgSYh3itW"), 6, "USDC");

describe("TokenPrice", () => {
  test(".fromBaseTokenAndQuoteAmount", () => {
    const quoteTokenAmount = TokenAmount.from(usdc, new Decimal(4000));

    const ethPriceInUsdc = TokenPrice.fromBaseTokenAndQuoteAmount(eth, quoteTokenAmount);

    expect(ethPriceInUsdc.toDecimal()).toEqual(new Decimal(4000));
    expect(ethPriceInUsdc.toU64().toString()).toEqual("4000000000");
  });

  test(".fromBaseAndQuoteAmounts", () => {
    const baseTokenAmount = TokenAmount.from(eth, new Decimal(2));
    const quoteTokenAmount = TokenAmount.from(usdc, new Decimal(8000));

    const ethPriceInUsdc = TokenPrice.fromBaseAndQuoteAmounts(baseTokenAmount, quoteTokenAmount);

    expect(ethPriceInUsdc.toDecimal()).toEqual(new Decimal(4000));
    expect(ethPriceInUsdc.toU64().toString()).toEqual("4000000000");
  });

  test(".invert", () => {
    const quoteTokenAmount = TokenAmount.from(usdc, new Decimal(4000));

    const usdcPriceInEth = TokenPrice.fromBaseTokenAndQuoteAmount(eth, quoteTokenAmount).invert();

    expect(usdcPriceInEth.toDecimal()).toEqual(new Decimal(0.00025));
    expect(usdcPriceInEth.toU64().toString()).toEqual("250000000000000");
  });
});
