import { u64 } from "@solana/spl-token";
import Decimal from "decimal.js";
import { DecimalUtil } from ".";

/**
 * Price is the ratio between two tokens such that, given tokens x and y: price = y / x
 */
export class Price {
  public static ratio(amountX: u64, decimalsX: number, amountY: u64, decimalsY: number): Decimal {
    const x = DecimalUtil.fromU64(amountX, decimalsX);
    const y = DecimalUtil.fromU64(amountY, decimalsY);
    return y.div(x);
  }

  public static usdPrice(ratio: Decimal, usdPriceY: number) {}
}
