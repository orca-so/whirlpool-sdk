import { getPoolMock, OrcaDALFileMock } from "../mocks/orca-dal";
import { Connection, PublicKey } from "@solana/web3.js";
import { defaultCommitment } from "../../src/constants/defaults";
import { OrcaDAL } from "../../src/dal/orca-dal";

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
      new Connection("http://google.com"),
      defaultCommitment
    );
    expect(orcaDal.getPool(PublicKey.default)).toEqual("default-mock");
    getPoolMock.mockImplementation(() => "custom-mock");
    expect(orcaDal.getPool(PublicKey.default)).toEqual("custom-mock");
  });
});
