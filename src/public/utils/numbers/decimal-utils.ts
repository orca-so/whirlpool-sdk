import { u64 } from "@solana/spl-token";
import Decimal from "decimal.js";
import { u256 } from "./u256";

export class DecimalUtil {
  public static fromU64(input: u64, shift = 0): Decimal {
    return new Decimal(input.toString()).div(new Decimal(10).pow(shift));
  }

  public static toU64(input: Decimal, shift = 0): u64 {
    if (input.isNeg()) {
      throw new Error(`Negative decimal value ${input} cannot be converted to u64.`);
    }

    const shiftedValue = input.mul(new Decimal(10).pow(shift));
    const zeroDecimalValue = shiftedValue.trunc();
    return new u64(zeroDecimalValue.toString());
  }

  public static fromU256(input: u256, shift = 0): Decimal {
    return new Decimal(input.toString()).div(new Decimal(10).pow(shift));
  }

  public static toU256(input: Decimal, shift = 0): u256 {
    if (input.isNeg()) {
      throw new Error(`Negative decimal value ${input} cannot be converted to u256.`);
    }

    const shiftedValue = input.mul(new Decimal(10).pow(shift));
    const zeroDecimalValue = shiftedValue.trunc();
    return new u256(zeroDecimalValue.toString());
  }
}
