import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export interface TokenData {
  readonly mint: PublicKey;
  readonly owner: PublicKey;
  readonly amount: BN;
}
