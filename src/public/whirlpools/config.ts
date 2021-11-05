import { FeeTier } from ".";
import { orcaToken, solToken } from "../../constants/tokens";

// TODO - update once we have a list of supported token pairs
export const OrcaWhirpoolTokenPair = {
  ORCA_SOL: {
    tokenA: orcaToken,
    tokenB: solToken,
    feeTier: FeeTier.STANDARD,
  },
};
