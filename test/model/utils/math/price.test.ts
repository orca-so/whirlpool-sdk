import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";
import { priceToSqrtPriceX64 } from "../../../../src/model/utils";
import { Token } from "../../../../src/model/utils/token";
import { TokenAmount } from "../../../../src/model/utils/token/amount";
import { TokenPrice } from "../../../../src/model/utils/token/price";

const eth = new Token(new PublicKey("2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk"), 18, "ETH");
const usdc = new Token(new PublicKey("BXXkv6z8ykpG1yuvUDPgh732wzVHB69RnB9YgSYh3itW"), 6, "USDC");

describe("priceToSqrtPriceX64", () => {
  it("converts 10,000 USDC per ETH to 100 in X64 format", () => {
    const quoteTokenAmount = TokenAmount.from(usdc, new Decimal(10_000));
    const ethPriceInUsdc = TokenPrice.fromBaseTokenAndQuoteAmount(eth, quoteTokenAmount);

    expect(priceToSqrtPriceX64(ethPriceInUsdc).toString()).toEqual(
      new BN("100").shln(64).toString()
    );
  });
});
