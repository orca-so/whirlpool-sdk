import { WhirlpoolData, fromX64 } from "@orca-so/whirlpool-client-sdk";
import { Address } from "@project-serum/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import Decimal from "decimal.js";
import { toPubKey, toPubKeys } from "./address";

type TokenMint = string;
type PoolData = Pick<WhirlpoolData, "tokenMintA" | "tokenMintB" | "sqrtPrice">;
type TokenGraph = Record<TokenMint, Record<TokenMint, PoolData>>;

export type TokenUSDPrices = Record<TokenMint, Decimal>;

/**
 * Use on-chain dex data to derive usd prices for tokens.
 *
 * @param pools pools to be used for price discovery
 * @param baseTokenMint a token mint with known stable usd price (e.g. USDC)
 * @param baseTokenUSDPrice baseTokenMint's usd price. defaults to 1, assuming `baseTokenMint` is a USD stable coin
 * @param otherBaseTokenMints optional list of token mints to prioritize as base
 */
export async function getTokenUSDPrices(
  pools: PoolData[],
  baseTokenMint: Address,
  baseTokenUSDPrice = new Decimal(1),
  otherBaseTokenMints: Address[] = [NATIVE_MINT]
): Promise<TokenUSDPrices> {
  // Create a bi-directional graph, where tokens are vertices and pairings are edges
  const tokenGraph: TokenGraph = {};
  pools.forEach((pool) => {
    const tokenMintA = pool.tokenMintA.toBase58();
    const tokenMintB = pool.tokenMintB.toBase58();
    tokenGraph[tokenMintA] = { [tokenMintB]: pool, ...tokenGraph[tokenMintA] };
    tokenGraph[tokenMintB] = { [tokenMintA]: pool, ...tokenGraph[tokenMintB] };
  });

  // Start with tokens paired with `baseTokenMint`, then prioritize tokens paired with SOL, then others.
  // For example, `baseTokenMint` could be USDC mint address.
  const base = toPubKey(baseTokenMint).toBase58();
  const otherBases = toPubKeys(otherBaseTokenMints).map((pubKey) => pubKey.toBase58());

  const result: TokenUSDPrices = { [base]: baseTokenUSDPrice };
  const queue: string[] = [base, ...otherBases];
  const visited: Set<string> = new Set();

  // Traverse the graph breath-first
  while (queue.length > 0) {
    const vertex = queue.shift();
    if (!vertex || visited.has(vertex)) {
      continue;
    } else {
      visited.add(vertex);
    }

    const vertexPriceUSD = result[vertex];
    if (!vertexPriceUSD) {
      continue;
    }

    for (const [neighbor, pool] of Object.entries(tokenGraph[vertex] || {})) {
      if (visited.has(neighbor)) {
        continue;
      }

      if (result[neighbor]) {
        queue.push(neighbor);
        continue;
      }

      const yxPrice = fromX64(pool.sqrtPrice).pow(2);
      if (pool.tokenMintA.toBase58() === neighbor) {
        result[neighbor] = yxPrice.mul(vertexPriceUSD);
      } else {
        result[neighbor] = vertexPriceUSD.div(yxPrice);
      }

      queue.push(neighbor);
    }
  }

  return result;
}
