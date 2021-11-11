import { DecimalUtil } from ".";
import Decimal from "decimal.js";
import { u256 } from "./u256";

/**
 * Orca's U256 wrapper class to help users convert to/from regular javascript number types
 *
 *
 * Examples:
 * OrcaU64(value: 99999, decimal: 0) -> 99999
 * OrcaU64(value: 99999, decimal: 5) -> 0.99999
 */
export class OrcaU256 {
  readonly value: u256;
  readonly scale: number;

  constructor(value: u256, scale = 0) {
    this.value = value;
    this.scale = Math.floor(scale);
  }

  /**
   * Create an OrcaU256 from a Decimal
   * @param value - an object representing the value of the u256 in Decimal form
   * @param scale - the number of digits after the decimal point to keep account for in this u256
   * @returns OrcaU256 hosting a u256 representing the input value adjusted to the provided scale
   */
  static fromDecimal(value: Decimal, scale = 0) {
    const dec = Math.floor(scale);
    return new OrcaU256(DecimalUtil.toU256(value, dec), dec);
  }

  /**
   * Create an OrcaU256 from a number
   * @param value - an object representing the value of the u256 in number form
   * @param scale - the number of digits after the decimal point to keep account for in this u256
   * @returns OrcaU256 hosting a u256 representing the input value adjusted to the provided scale
   */
  static fromNumber(value: number, scale = 0) {
    const dec = Math.floor(scale);
    return new OrcaU256(DecimalUtil.toU256(new Decimal(value), dec), dec);
  }

  /**
   * Create an OrcaU256 from a u256
   * @param value - an object representing the value of the u256
   * @param scale - the number of digits after the decimal point represented in this u256
   * @returns OrcaU256 hosting the input u256 with the provided scale
   */
  static fromU256(value: u256, scale = 0) {
    const dec = Math.floor(scale);
    return new OrcaU256(value, dec);
  }

  /**
   * Convert this OrcaU256 to Decimal.
   * @returns Decimal object that equals to the OrcaU256's value & scale
   */
  public toDecimal() {
    return DecimalUtil.fromU256(this.value, this.scale);
  }

  /**
   * Convert this OrcaU256 to number.
   * @returns number that equals to the OrcaU256's value & scale
   */
  public toNumber() {
    return DecimalUtil.fromU256(this.value, this.scale).toNumber();
  }

  /**
   * Convert this OrcaU256 to u256.
   * @returns u256 that equals to the OrcaU256 value
   */
  public toU256() {
    return new u256(this.value.toString());
  }
}
