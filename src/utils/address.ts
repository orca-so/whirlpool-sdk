import { Address, translateAddress } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

export function toPubKey(address: Address): PublicKey {
  return translateAddress(address);
}

export function toPubKeys(addresses: Address[]): PublicKey[] {
  return addresses.map((address) => toPubKey(address));
}
