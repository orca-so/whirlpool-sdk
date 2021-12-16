import { BN } from "@project-serum/anchor";
import { Token, TokenPrice } from "..";

// SCUBA-ATAMARI: Can't get this test to run properly

/**
 * Returns sqrtPriceX64 (BNx64) for a given TokenPrice
 * @param price token price
 */
export function priceToSqrtPriceX64(price: TokenPrice<Token, Token>): BN {
  const sqrtPriceDecimal = price.toDecimal().sqrt();

  // We're left shifting the decimal by 64 bits. Since Decimal doesn't have a left shift operator, we multiply it with (1 << 64) instead which has the same effect
  const sqrtPriceX64Decimal = sqrtPriceDecimal.mul(new BN(1).shln(64).toString());
  return new BN(sqrtPriceX64Decimal.floor().toHex(), "hex");
}
