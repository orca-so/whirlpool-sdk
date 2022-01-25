import { getPoolMock, OrcaDALFileMock } from "../mocks/orca-dal";
import { Connection, PublicKey } from "@solana/web3.js";
import { OrcaDAL } from "../../src/dal/orca-dal";
import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";

describe("Mocking Orca DAL", () => {
  beforeEach(() => {
    OrcaDALFileMock.clearAllMocks();
    // OrcaDALMock.mockClear();
    // getPoolMock.mockClear();
  });

  it("test", () => {
    const orcaDal = new OrcaDAL(
      PublicKey.default,
      PublicKey.default,
      new Connection("http://google.com")
    );
    expect(orcaDal.getPool(PublicKey.default)).toEqual("default-mock");
    getPoolMock.mockImplementation(() => ({} as WhirlpoolData));
    expect(orcaDal.getPool(PublicKey.default)).toEqual("custom-mock");
  });
});
