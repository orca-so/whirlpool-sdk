import { BN } from "@project-serum/anchor";
import { Token, TokenPrice } from "..";

// SCUBA-ATAMARI: Can't get this test to run properly

/**
 * Returns sqrtPriceX64 (BNx64) for a given TokenPrice
 * @param price token price
 */
export function priceToSqrtPriceX64(price: TokenPrice<Token, Token>): BN {
  const sqrtPriceDecimal = price.toDecimal().sqrt();
  const sqrtPriceX64Decimal = sqrtPriceDecimal.mul(new BN(1).shln(64).toString());
  return new BN(sqrtPriceX64Decimal.floor().toHex(), "hex");
}
