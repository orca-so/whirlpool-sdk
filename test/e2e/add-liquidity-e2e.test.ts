import Decimal from "decimal.js";
import { Provider, BN } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { OrcaNetwork, OrcaWhirlpoolClient, Percentage } from "../../src";
import { OrcaAdmin } from "../../src/admin/orca-admin";
import { OrcaDAL } from "../../src/dal/orca-dal";
import { getDefaultOffchainDataURI } from "../../src/constants/public/defaults";
import { getPositionPda, toX64 } from "@orca-so/whirlpool-client-sdk";
import { initPool, initWhirlpoolsConfig, zeroSlippage } from "../utils/setup";

const NETWORK_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("123aHGsUDPaH5tLM8HFZMeMjHgJJXPq9eSEk32syDw6k");
const offchainDataURI = getDefaultOffchainDataURI(OrcaNetwork.DEVNET);

jest.setTimeout(10_000);

describe.skip("Add liquidity", () => {
  let provider: Provider;
  let owner: PublicKey;
  beforeEach(() => {
    provider = Provider.local(NETWORK_URL);
    owner = provider.wallet.publicKey;
  });

  test("Adds liquidity", async () => {
    // deploy config
    const whirlpoolsConfig = await initWhirlpoolsConfig(provider, PROGRAM_ID, owner);

    // initialize pool
    const dal = new OrcaDAL(whirlpoolsConfig, PROGRAM_ID, provider.connection);
    const orcaAdmin = new OrcaAdmin(dal);

    const { tokenMintA, poolAddress } = await initPool(
      orcaAdmin,
      provider,
      toX64(new Decimal(1.0005)),
      64
    );

    // initialize client
    const client = new OrcaWhirlpoolClient({
      network: OrcaNetwork.DEVNET,
      connection: provider.connection,
      whirlpoolConfig: whirlpoolsConfig,
      programId: PROGRAM_ID,
      offchainDataURI,
    });

    // add liquidity
    const quote = await client.pool.getOpenPositionQuote({
      tickLowerIndex: -128,
      tickUpperIndex: 128,
      poolAddress,
      tokenMint: tokenMintA,
      tokenAmount: new BN("100000000"),
      slippageTolerance: zeroSlippage,
      refresh: true,
    });

    console.log(quote.maxTokenA.toString(), quote.maxTokenB.toString());

    const openTx = await client.pool.getOpenPositionTx({ provider, quote });

    const { tx, mint } = openTx;

    await tx.buildAndExecute();

    console.log("mint", mint.toBase58());
    const positionPda = getPositionPda(PROGRAM_ID, mint);

    const closeQuote = await client.pool.getClosePositionQuote({
      positionAddress: positionPda.publicKey,
      slippageTolerance: zeroSlippage,
      refresh: true,
    });

    console.log(closeQuote.minTokenA.toString(), closeQuote.minTokenB.toString());

    const closeTx = await client.pool.getClosePositionTx({ provider, quote: closeQuote });

    await closeTx.buildAndExecute();
  });
});
