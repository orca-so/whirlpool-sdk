import { Address } from "@project-serum/anchor";
import { OrcaDAL } from "../dal/orca-dal";

export type PriceRange = {};

export type SuggestedPriceRanges = {
  conservative: PriceRange;
  standard: PriceRange;
};

export async function getSuggestedPriceRanges(
  dal: OrcaDAL,
  poolAddress: Address,
  refresh: boolean
): Promise<SuggestedPriceRanges> {
  throw new Error();
}
