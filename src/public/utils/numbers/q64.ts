import BN from "bn.js";
import { u64 } from "@solana/spl-token";
import { u128 } from "./u128";
import invariant from "tiny-invariant";

// TODO change to q64x64 maybe
export class q64 extends u128 {
  public static toU64(value: q64): u64 {
    const u64Value = value.shrn(64);
    invariant(!value.isNeg(), "value is negative");
    invariant(u64Value.bitLength() <= 64, "value exeeds u64");
    return u64Value;
  }

  public static fromU64(value: u64): q64 {
    return value.shln(64);
  }

  public static toIntNumber(value: q64): number {
    return value.shrn(64).toNumber();
  }

  public static fromIntNumber(value: number): q64 {
    return new BN(Math.floor(value)).shln(64);
  }
}
