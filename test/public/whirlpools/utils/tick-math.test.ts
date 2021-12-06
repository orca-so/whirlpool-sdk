import Decimal from "decimal.js";
import { TickMath } from "../../../../src";
Decimal.set({ precision: 40, rounding: 4 });

/**
 * This test is based on the script in the whirlpool smart contract repository
 * (location: whirlpool/scripts/genExpBitConstants.ts), which was used to create
 * the pre-computed magic numbers used in the whirlpool smart contract and this sdk.
 */
const bitShiftX128 = new Decimal(2).pow(128);
const b = new Decimal("1.0001");
const n = 64;

type MagicNumbers = Record<number, string>;

// we need 19 bit constants to support maximum tick of +/-443636
// since 2^18 < 443636 < 2^19
const magicNumbers = [...Array(19).keys()].reduce((acc: MagicNumbers, j: number) => {
  const power = new Decimal("2").pow(j - 1);
  const sqrtBPower = b.pow(power); // sqrt(b)^2^j => b^2^(j-1)
  const iSqrtBPower = new Decimal("1").div(sqrtBPower).mul(bitShiftX128);
  acc[j] = iSqrtBPower.round().toHexadecimal().substring(2); // skip "0x"
  return acc;
}, {});

function generateExpectedValues(tick: number): { pos: string; neg: string } {
  const jsResult = new Decimal(b).pow(tick).sqrt().mul(new Decimal(2).pow(n)).toFixed(0, 1);
  const njsResult = new Decimal(b).pow(-tick).sqrt().mul(new Decimal(2).pow(n)).toFixed(0, 1);
  return { pos: jsResult, neg: njsResult };
}

// TODO test not working
describe("TickMath.sqrtPriceAtTick", () => {
  test("with exact bit values", () => {
    const exactBitGroup = [
      0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072,
      262144, 524288,
    ];

    exactBitGroup.forEach((tick) => {
      const resultPos = TickMath.sqrtPriceAtTick(tick);
      const resultNeg = TickMath.sqrtPriceAtTick(-tick);

      const expected = generateExpectedValues(tick);
      expect(resultPos).toEqual(expected.pos);
      expect(resultNeg).toEqual(expected.neg);
    });
  });

  test("with random values used in smartcontract test", () => {
    const scRandGroup = [2493, 23750, 395, 129, 39502, 395730, 245847, 120821].sort(
      (n1, n2) => n1 - n2
    );

    scRandGroup.forEach((tick) => {
      const resultPos = TickMath.sqrtPriceAtTick(tick);
      const resultNeg = TickMath.sqrtPriceAtTick(-tick);

      const expected = generateExpectedValues(tick);
      expect(resultPos).toEqual(expected.pos);
      expect(resultNeg).toEqual(expected.neg);
    });
  });

  // test("with generated random values", () => {
  //   const randGroup = Array.from({ length: 1000 }, () =>
  //     Math.floor(Math.random() * TickMath.MAX_TICK)
  //   );

  //   randGroup.forEach((tick) => {
  //     const resultPos = TickMath.sqrtPriceAtTick(tick);
  //     const resultNeg = TickMath.sqrtPriceAtTick(-tick);

  //     const expected = generateExpectedValues(tick);
  //     expect(resultPos).toEqual(expected.pos);
  //     expect(resultNeg).toEqual(expected.neg);
  //   });
  // });
});
