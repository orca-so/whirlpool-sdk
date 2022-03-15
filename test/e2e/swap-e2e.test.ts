import { TickSpacing, toX64 } from "@orca-so/whirlpool-client-sdk";
import { BN, Provider } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { Decimal } from "decimal.js";
import invariant from "tiny-invariant";
import { OrcaNetwork, OrcaWhirlpoolClient, Percentage, PoolData, SwapQuote } from "../../src";
import { OrcaAdmin } from "../../src/admin/orca-admin";
import { getDefaultOffchainDataURI } from "../../src/constants/defaults";
import { OrcaDAL } from "../../src/dal/orca-dal";
import { ZERO } from "../../src/utils/web3/math-utils";
import {
  DEFAULT_FEE_RATE,
  initPoolWithLiquidity,
  initStandardPoolWithLiquidity,
  initWhirlpoolsConfig,
} from "../utils/setup";

const NETWORK_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("123aHGsUDPaH5tLM8HFZMeMjHgJJXPq9eSEk32syDw6k");
const offchainDataURI = getDefaultOffchainDataURI(OrcaNetwork.DEVNET);
const zeroSlippage = new Percentage(ZERO, new BN(100));

jest.setTimeout(10_000);

describe.skip("Swap", () => {
  let provider: Provider;
  let owner: PublicKey;
  beforeEach(() => {
    provider = Provider.local(NETWORK_URL);
    owner = provider.wallet.publicKey;
  });

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

    const { tokenMintA, poolAddress } = await initStandardPoolWithLiquidity(
      client,
      orcaAdmin,
      provider
    );

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

    const oldPool = await client.getPool(poolAddress, true);
    invariant(!!oldPool);

    const tx = await client.pool.getSwapTx({ provider, quote });

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    invariant(!!pool);

    expectSwapOutput(pool, oldPool, quote);
  });

  it("swaps right across a tick array with output", async () => {
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

    const { tokenMintA, poolAddress } = await initPoolWithLiquidity(
      client,
      orcaAdmin,
      provider,
      toX64(new Decimal(1.0005)),
      [
        {
          tickLowerIndex: -128,
          tickUpperIndex: 128,
          isTokenMintA: true,
          tokenAmount: new BN("100000000"),
        },
        {
          tickLowerIndex: -22400,
          tickUpperIndex: 22400,
          isTokenMintA: true,
          tokenAmount: new BN("100000000"),
        },
      ]
    );

    let quote;
    try {
      quote = await client.pool.getSwapQuote({
        poolAddress,
        tokenMint: tokenMintA,
        tokenAmount: new BN("150000000"),
        isInput: false,
        slippageTolerance: zeroSlippage,
        refresh: true,
      });
    } catch (e) {
      console.error("Failed to get swap quote", e);
      return;
    }

    const oldPool = await client.getPool(poolAddress, true);
    invariant(!!oldPool);

    const tx = await client.pool.getSwapTx({ provider, quote });
    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    invariant(!!pool);

    expectSwapOutput(pool, oldPool, quote);
  });

  it("swaps right across a tick array", async () => {
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

    const { tokenMintB, poolAddress } = await initPoolWithLiquidity(
      client,
      orcaAdmin,
      provider,
      toX64(new Decimal(1.0005)),
      [
        {
          tickLowerIndex: -128,
          tickUpperIndex: 128,
          isTokenMintA: true,
          tokenAmount: new BN("100000000"),
        },
        {
          tickLowerIndex: -22400,
          tickUpperIndex: 22400,
          isTokenMintA: true,
          tokenAmount: new BN("100000000"),
        },
      ]
    );

    let quote;
    try {
      quote = await client.pool.getSwapQuote({
        poolAddress,
        tokenMint: tokenMintB,
        tokenAmount: new BN("150000000"),
        isInput: true,
        slippageTolerance: zeroSlippage,
        refresh: true,
      });
    } catch (e) {
      console.error("Failed to get swap quote", e);
      return;
    }

    const oldPool = await client.getPool(poolAddress, true);
    invariant(!!oldPool);

    const tx = await client.pool.getSwapTx({ provider, quote });

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    invariant(!!pool);

    expectSwapOutput(pool, oldPool, quote);
  });

  it("swaps left across a tick array with output", async () => {
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

    const { tokenMintB, poolAddress } = await initPoolWithLiquidity(
      client,
      orcaAdmin,
      provider,
      toX64(new Decimal(1.0005)),
      [
        {
          tickLowerIndex: -128,
          tickUpperIndex: 128,
          isTokenMintA: true,
          tokenAmount: new BN("100000000"),
        },
        {
          tickLowerIndex: -22400,
          tickUpperIndex: 22400,
          isTokenMintA: true,
          tokenAmount: new BN("100000000"),
        },
      ]
    );

    let quote;
    try {
      quote = await client.pool.getSwapQuote({
        poolAddress,
        tokenMint: tokenMintB,
        tokenAmount: new BN("150000000"),
        isInput: false,
        slippageTolerance: zeroSlippage,
        refresh: true,
      });
    } catch (e) {
      console.error("Failed to get swap quote", e);
      return;
    }

    const oldPool = await client.getPool(poolAddress, true);
    invariant(!!oldPool);

    const tx = await client.pool.getSwapTx({ provider, quote });

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    invariant(!!pool);

    expectSwapOutput(pool, oldPool, quote);
  });

  it("swaps left across a tick array", async () => {
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

    const { tokenMintA, poolAddress } = await initPoolWithLiquidity(
      client,
      orcaAdmin,
      provider,
      toX64(new Decimal(1.0005)),
      [
        {
          tickLowerIndex: -128,
          tickUpperIndex: 128,
          isTokenMintA: true,
          tokenAmount: new BN("100000000"),
        },
        {
          tickLowerIndex: -22400,
          tickUpperIndex: 22400,
          isTokenMintA: true,
          tokenAmount: new BN("100000000"),
        },
      ]
    );

    let quote;
    try {
      quote = await client.pool.getSwapQuote({
        poolAddress,
        tokenMint: tokenMintA,
        tokenAmount: new BN("150000000"),
        isInput: true,
        slippageTolerance: zeroSlippage,
        refresh: true,
      });
    } catch (e) {
      console.error("Failed to get swap quote", e);
      return;
    }

    const oldPool = await client.getPool(poolAddress, true);
    invariant(!!oldPool);

    const tx = await client.pool.getSwapTx({ provider, quote });

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    invariant(!!pool);

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

    const { tokenMintB, poolAddress } = await initStandardPoolWithLiquidity(
      client,
      orcaAdmin,
      provider
    );

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

    const oldPool = await client.getPool(poolAddress, true);
    invariant(!!oldPool);

    const tx = await client.pool.getSwapTx({ provider, quote });

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    invariant(!!pool);

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

    const { tokenMintB, poolAddress } = await initStandardPoolWithLiquidity(
      client,
      orcaAdmin,
      provider
    );

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

    const oldPool = await client.getPool(poolAddress, true);
    invariant(!!oldPool);

    const tx = await client.pool.getSwapTx({ provider, quote });

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    invariant(!!pool);

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

    const { tokenMintA, poolAddress } = await initStandardPoolWithLiquidity(
      client,
      orcaAdmin,
      provider
    );

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

    const oldPool = await client.getPool(poolAddress, true);
    invariant(!!oldPool);

    const tx = await client.pool.getSwapTx({ provider, quote });

    await tx.buildAndExecute();

    const pool = await client.getPool(poolAddress, true);
    invariant(!!pool);

    expectSwapOutput(pool, oldPool, quote);
  });
});

function expectSwapOutput(pool: PoolData, oldPool: PoolData, quote: SwapQuote) {
  if (quote.aToB) {
    expect(oldPool.tokenVaultAmountA.add(quote.amountIn).eq(pool.tokenVaultAmountA)).toBeTruthy();
    expect(oldPool.tokenVaultAmountB.sub(quote.amountOut).eq(pool.tokenVaultAmountB)).toBeTruthy();
  } else {
    expect(oldPool.tokenVaultAmountB.add(quote.amountIn).eq(pool.tokenVaultAmountB)).toBeTruthy();
    expect(oldPool.tokenVaultAmountA.sub(quote.amountOut).eq(pool.tokenVaultAmountA)).toBeTruthy();
  }
}
