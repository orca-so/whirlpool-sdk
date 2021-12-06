import Decimal from "decimal.js";
Decimal.set({ precision: 40, rounding: 4 });

/**
 * This test is based on the script in the whirlpool smart contract repository
 * (location: whirlpool/scripts/genExpBitConstants.ts), which was used to create
 * the pre-computed magic numbers used in the whirlpool smart contract and this sdk.
 */
const bitShiftX128 = new Decimal(2).pow(128);
const b = new Decimal("1.0001");
const n = 64;

// we need 19 bit constants to support maximum tick of +/-443636
// since 2^18 < 443636 < 2^19
const magicNumbers = [...Array(19).keys()].map((j: number) => {
  const power = new Decimal("2").pow(j - 1);
  const sqrtBPower = b.pow(power); // sqrt(b)^2^j => b^2^(j-1)
  return new Decimal("1").div(sqrtBPower).mul(bitShiftX128);
});

// TODO - need to actually create tests
