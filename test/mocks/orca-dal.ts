import {
  PositionData,
  TickArrayData,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { MintInfo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

// TODO: Add proper mocks

export const getPoolMock = jest.fn(
  (address: PublicKey, refresh: boolean = false) => ({} as WhirlpoolData)
);
export const getPositionMock = jest.fn(
  (address: PublicKey, refresh: boolean = false) => ({} as PositionData)
);
export const getTickArrayMock = jest.fn(
  (address: PublicKey, refresh: boolean = false) => ({} as TickArrayData)
);
export const listMintInfosMock = jest.fn(
  (addresses: PublicKey[], refresh: boolean = false) => ({} as MintInfo[])
);
export const OrcaDALMock = jest.fn(function () {
  return {
    getPool: getPoolMock,
    getPosition: getPositionMock,
    getTickArray: getTickArrayMock,
    listMintInfos: listMintInfosMock,
  };
});

export const OrcaDALFileMock = jest.mock("../../src/dal/orca-dal", function () {
  return {
    OrcaDAL: OrcaDALMock,
  };
});
