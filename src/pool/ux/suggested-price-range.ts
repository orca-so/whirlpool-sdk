import { Address } from "@project-serum/anchor";
import { AccountFetcher } from "../../accounts/fetch";

export type PriceRange = {};

export type SuggestedPriceRanges = {
  conservative: PriceRange;
  standard: PriceRange;
};

export async function getSuggestedPriceRanges(
  dal: AccountFetcher,
  poolAddress: Address,
  refresh: boolean
): Promise<SuggestedPriceRanges> {
  throw new Error();
}
