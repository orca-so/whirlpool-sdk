import { PublicKey } from "@solana/web3.js";

export abstract class Account {
  abstract parse(): Account;
  abstract get address(): PublicKey;
  static getAddress: () => PublicKey;
}
