import { BN, Provider } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { OrcaNetwork, OrcaWhirlpoolClient, Percentage, PoolData, SwapQuote } from "../../src";
import { OrcaAdmin } from "../../src/admin/orca-admin";
import { getDefaultOffchainDataURI } from "../../src/constants/defaults";
import { OrcaDAL } from "../../src/dal/orca-dal";
import { ZERO } from "../../src/utils/web3/math-utils";
import { initPoolWithLiquidity, initWhirlpoolsConfig } from "../utils/setup";

const NETWORK_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("123aHGsUDPaH5tLM8HFZMeMjHgJJXPq9eSEk32syDw6k");
const offchainDataURI = getDefaultOffchainDataURI(OrcaNetwork.DEVNET);
const zeroSlippage = new Percentage(ZERO, new BN(100));

describe("Swap", () => {
  const provider = Provider.local(NETWORK_URL);
  const owner = provider.wallet.publicKey;

  it("swaps left", async () => {
    const whirlpoolsConfig = await initWhirlpoolsConfig(provider, PROGRAM_ID, owner);

    const dal = new OrcaDAL(whirlpoolsConfig, PROGRAM_ID, provider.connection);
    const orcaAdmin = new OrcaAdmin(dal);

    const client = new OrcaWhirlpoolClient({
      network: OrcaNetwork.DEVNET,
      connection: provider.connection,
      whirlpoolConfig: whirlpoolsConfig,
      programId: PROGRAM_ID,
      offchainDataURI,
    });

    const { tokenMintA, poolAddress } = await initPoolWithLiquidity(client, orcaAdmin, provider);

    let quote;
    try {
      quote = await client.pool.getSwapQuote({
        poolAddress,
        tokenMint: tokenMintA,
        tokenAmount: new BN("1000"),
        isInput: true,
        slippageTolerance: zeroSlippage,
        refresh: true,
      });
    } catch (e) {
      console.error("Failed to get swap quote");
      return;
    }

    if (!quote) {
      throw new Error("pool not found");
    }

    const oldPool = await client.getPool(poolAddress, true);
    if (!oldPool) {
      throw new Error("pool not found");
    }

    const tx = await client.pool.getSwapTx({ provider, quote });

    if (!tx) {
      throw new Error("pool not found");
    }

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    if (!pool) {
      throw new Error("pool not found");
    }

    expectSwapOutput(pool, oldPool, quote);
  });

  it("swaps right", async () => {
    const whirlpoolsConfig = await initWhirlpoolsConfig(provider, PROGRAM_ID, owner);

    const dal = new OrcaDAL(whirlpoolsConfig, PROGRAM_ID, provider.connection);
    const orcaAdmin = new OrcaAdmin(dal);

    const client = new OrcaWhirlpoolClient({
      network: OrcaNetwork.DEVNET,
      connection: provider.connection,
      whirlpoolConfig: whirlpoolsConfig,
      programId: PROGRAM_ID,
      offchainDataURI,
    });

    const { tokenMintB, poolAddress } = await initPoolWithLiquidity(client, orcaAdmin, provider);

    let quote;
    try {
      quote = await client.pool.getSwapQuote({
        poolAddress,
        tokenMint: tokenMintB,
        tokenAmount: new BN("1000"),
        isInput: true,
        slippageTolerance: zeroSlippage,
        refresh: true,
      });
    } catch (e) {
      console.error("Failed to get swap quote");
      return;
    }

    if (!quote) {
      throw Error("pool not found");
    }

    const oldPool = await client.getPool(poolAddress, true);
    if (!oldPool) {
      throw new Error("pool not found");
    }

    const tx = await client.pool.getSwapTx({ provider, quote });

    if (!tx) {
      throw Error("pool not found");
    }

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    if (!pool) {
      throw new Error("pool not found");
    }

    expectSwapOutput(pool, oldPool, quote);
  });

  it("swaps left with output", async () => {
    const whirlpoolsConfig = await initWhirlpoolsConfig(provider, PROGRAM_ID, owner);

    const dal = new OrcaDAL(whirlpoolsConfig, PROGRAM_ID, provider.connection);
    const orcaAdmin = new OrcaAdmin(dal);

    const client = new OrcaWhirlpoolClient({
      network: OrcaNetwork.DEVNET,
      connection: provider.connection,
      whirlpoolConfig: whirlpoolsConfig,
      programId: PROGRAM_ID,
      offchainDataURI,
    });

    const { tokenMintB, poolAddress } = await initPoolWithLiquidity(client, orcaAdmin, provider);

    let quote;
    try {
      quote = await client.pool.getSwapQuote({
        poolAddress,
        tokenMint: tokenMintB,
        tokenAmount: new BN("1000"),
        isInput: false,
        slippageTolerance: zeroSlippage,
        refresh: true,
      });
    } catch (e) {
      console.error("Failed to get swap quote");
      return;
    }

    if (!quote) {
      throw Error("pool not found");
    }

    const oldPool = await client.getPool(poolAddress, true);
    if (!oldPool) {
      throw new Error("pool not found");
    }

    const tx = await client.pool.getSwapTx({ provider, quote });

    if (!tx) {
      throw Error("pool not found");
    }

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    if (!pool) {
      throw new Error("pool not found");
    }

    expectSwapOutput(pool, oldPool, quote);
  });

  it("swaps right with output", async () => {
    const whirlpoolsConfig = await initWhirlpoolsConfig(provider, PROGRAM_ID, owner);

    const dal = new OrcaDAL(whirlpoolsConfig, PROGRAM_ID, provider.connection);
    const orcaAdmin = new OrcaAdmin(dal);

    const client = new OrcaWhirlpoolClient({
      network: OrcaNetwork.DEVNET,
      connection: provider.connection,
      whirlpoolConfig: whirlpoolsConfig,
      programId: PROGRAM_ID,
      offchainDataURI,
    });

    const { tokenMintA, poolAddress } = await initPoolWithLiquidity(client, orcaAdmin, provider);

    let quote;
    try {
      quote = await client.pool.getSwapQuote({
        poolAddress,
        tokenMint: tokenMintA,
        tokenAmount: new BN("1000"),
        isInput: false,
        slippageTolerance: zeroSlippage,
        refresh: true,
      });
    } catch (e) {
      console.error("Failed to get swap quote");
      return;
    }

    if (!quote) {
      throw Error("pool not found");
    }

    const oldPool = await client.getPool(poolAddress, true);
    if (!oldPool) {
      throw new Error("pool not found");
    }

    const tx = await client.pool.getSwapTx({ provider, quote });

    if (!tx) {
      throw Error("pool not found");
    }

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    if (!pool) {
      throw new Error("pool not found");
    }

    expectSwapOutput(pool, oldPool, quote);
  });
});

function expectSwapOutput(pool: PoolData, oldPool: PoolData, quote: SwapQuote) {
  expect(pool.sqrtPrice.eq(quote.sqrtPriceLimitX64));
  if (quote.aToB === quote.fixedInput) {
    expect(oldPool.tokenVaultAmountA.add(quote.amountIn).eq(pool.tokenVaultAmountA));
    expect(oldPool.tokenVaultAmountB.sub(quote.amountOut).eq(pool.tokenVaultAmountB));
  } else {
    expect(oldPool.tokenVaultAmountB.add(quote.amountIn).eq(pool.tokenVaultAmountB));
    expect(oldPool.tokenVaultAmountA.sub(quote.amountOut).eq(pool.tokenVaultAmountA));
  }
}
