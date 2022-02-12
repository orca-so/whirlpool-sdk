import { getTickArrayPda, getWhirlpoolPda, TickSpacing } from "@orca-so/whirlpool-client-sdk";
import Decimal from "@orca-so/whirlpool-client-sdk/node_modules/decimal.js";
import { BN, Provider } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getInitWhirlpoolConfigsTx, OrcaNetwork, OrcaWhirlpoolClient, Percentage } from "../../src";
import { OrcaAdmin } from "../../src/admin/orca-admin";
import { getDefaultOffchainDataURI } from "../../src/constants/defaults";
import { OrcaDAL } from "../../src/dal/orca-dal";
import { ZERO } from "../../src/utils/web3/math-utils";
import { initPool, initPoolWithLiquidity, initWhirlpoolsConfig } from "../utils/setup";
import { createAndMintToTokenAccount, createInOrderMints } from "../utils/token";

const NETWORK_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("123aHGsUDPaH5tLM8HFZMeMjHgJJXPq9eSEk32syDw6k");
const DEFAULT_FEE_RATE = 3000;
const DEFAULT_PROTOCOL_FEE_RATE = 300;
const offchainDataURI = getDefaultOffchainDataURI(OrcaNetwork.DEVNET);
const zeroSlippage = new Percentage(ZERO, new BN(100));

describe("Swap", () => {
  const provider = Provider.local(NETWORK_URL);
  const owner = provider.wallet.publicKey;

  it("Swaps", async () => {
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

    const { tokenMintA, tokenMintB, whirlpool, positionMint } = await initPoolWithLiquidity(
      client,
      orcaAdmin,
      provider,
      PROGRAM_ID
    );

    const quote = await client.pool.getSwapQuote({
      poolAddress: whirlpool,
      tokenMint: tokenMintA,
      tokenAmount: new BN("1000"),
      isOutput: false,
      slippageTolerance: zeroSlippage,
      refresh: true,
    });

    if (!quote) {
      throw Error("pool not found");
    }

    console.log(quote);

    const tx = await client.pool.getSwapTx({ provider, quote });

    if (!tx) {
      throw Error("pool not found");
    }

    await tx.buildAndExecute();
  });
});
