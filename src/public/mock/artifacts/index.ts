import { Idl } from "@project-serum/anchor";
import * as WhirlpoolIDLJson from "./whirlpool.json";

export * from "./whirlpool";
export const WhirlpoolIDL = WhirlpoolIDLJson as Idl;
