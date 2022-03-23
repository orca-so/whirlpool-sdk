import { getPoolMock, OrcaDALFileMock } from "../mocks/orca-dal";
import { Connection, PublicKey } from "@solana/web3.js";
import { AccountFetcher } from "../../src/accounts/fetch";
import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk";

describe("Mocking Orca DAL", () => {
  beforeEach(() => {
    OrcaDALFileMock.clearAllMocks();
  });

  it("test", async () => {
    const mockDal = new AccountFetcher(
      PublicKey.default,
      PublicKey.default,
      new Connection("http://google.com")
    );

    expect(await mockDal.getPool(PublicKey.default, true)).toEqual({});
    getPoolMock.mockImplementation(() => ({ test: 1 } as any as WhirlpoolData));
    expect(await mockDal.getPool(PublicKey.default, true)).toEqual({ test: 1 });
  });
});
