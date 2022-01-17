export const getPoolMock = jest.fn(() => "default-mock");
export const OrcaDALMock = jest.fn(function () {
  return {
    getPool: getPoolMock,
  };
});

export const OrcaDALFileMock = jest.mock("../../src/dal/orca-dal", function () {
  return {
    OrcaDAL: OrcaDALMock,
  };
});
