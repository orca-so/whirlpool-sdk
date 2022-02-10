import Decimal from "decimal.js";
import { Provider, BN } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getInitWhirlpoolConfigsTx, OrcaNetwork, OrcaWhirlpoolClient, Percentage } from "../../src";
import { OrcaAdmin } from "../../src/admin/orca-admin";
import { OrcaDAL } from "../../src/dal/orca-dal";
import { createAndMintToTokenAccount, createInOrderMints, mintToByAuthority } from "../utils/token";
import { getDefaultOffchainDataURI } from "../../src/constants/defaults";
import {
  getPositionPda,
  getTickArrayPda,
  getWhirlpoolPda,
  TickSpacing,
} from "@orca-so/whirlpool-client-sdk";
import { ZERO } from "../../src/utils/web3/math-utils";
import { u64 } from "@solana/spl-token";

const NETWORK_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("123aHGsUDPaH5tLM8HFZMeMjHgJJXPq9eSEk32syDw6k");
const DEFAULT_FEE_RATE = 3000;
const DEFAULT_PROTOCOL_FEE_RATE = 300;
const offchainDataURI = getDefaultOffchainDataURI(OrcaNetwork.DEVNET);
const zeroSlippage = new Percentage(ZERO, new BN(100));

jest.setTimeout(10_000);

describe("Add liquidity", () => {
  const provider = Provider.local(NETWORK_URL);
  const owner = provider.wallet.publicKey;

  it("Adds liquidity", async () => {
    // deploy config
    const whirlpoolsConfigKeypair = Keypair.generate();
    const whirlpoolsConfig = whirlpoolsConfigKeypair.publicKey;

    await getInitWhirlpoolConfigsTx({
      programId: PROGRAM_ID,
      provider,
      whirlpoolConfigKeypair: whirlpoolsConfigKeypair,
      feeAuthority: owner,
      collectProtocolFeesAuthority: owner,
      rewardEmissionsSuperAuthority: owner,
      defaultFeeRate: DEFAULT_FEE_RATE,
      defaultProtocolFeeRate: DEFAULT_PROTOCOL_FEE_RATE,
    }).buildAndExecute();

    // initialize pool
    const dal = new OrcaDAL(whirlpoolsConfig, PROGRAM_ID, provider.connection);
    const orcaAdmin = new OrcaAdmin(dal);

    const [tokenMintA, tokenMintB] = await createInOrderMints(provider);
    await createAndMintToTokenAccount(provider, tokenMintA, new u64("1000000000"));
    await createAndMintToTokenAccount(provider, tokenMintB, new u64("1000000000"));

    await orcaAdmin
      .getInitPoolTx({
        provider,
        initialPrice: new Decimal(1.0005),
        tokenMintA,
        tokenMintB,
        stable: false,
      })
      .buildAndExecute();

    const whirlpoolPda = getWhirlpoolPda(
      PROGRAM_ID,
      whirlpoolsConfig,
      tokenMintA,
      tokenMintB,
      TickSpacing.Standard
    );

    // initialize client
    const client = new OrcaWhirlpoolClient({
      network: OrcaNetwork.DEVNET,
      connection: provider.connection,
      whirlpoolConfig: whirlpoolsConfig,
      programId: PROGRAM_ID,
      offchainDataURI,
    });

    // initialize tick arrays
    const lowerStartTick = -128 * 88;
    const tickArrayLowerPda = getTickArrayPda(PROGRAM_ID, whirlpoolPda.publicKey, lowerStartTick);
    (
      await client.pool.getInitTickArrayTx(provider, {
        whirlpool: whirlpoolPda.publicKey,
        tickArrayPda: tickArrayLowerPda,
        startTick: lowerStartTick,
        funder: provider.wallet.publicKey,
      })
    ).buildAndExecute();

    const tickArrayUpperPda = getTickArrayPda(PROGRAM_ID, whirlpoolPda.publicKey, 0);
    (
      await client.pool.getInitTickArrayTx(provider, {
        whirlpool: whirlpoolPda.publicKey,
        tickArrayPda: tickArrayUpperPda,
        startTick: 0,
        funder: provider.wallet.publicKey,
      })
    ).buildAndExecute();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // add liquidity
    const quote = await client.pool.getOpenPositionQuote({
      tickLowerIndex: -128,
      tickUpperIndex: 128,
      poolAddress: whirlpoolPda.publicKey,
      tokenMint: tokenMintA,
      tokenAmount: new BN("100000000"),
      slippageTolerance: zeroSlippage,
    });

    console.log(quote.maxTokenA.toString(), quote.maxTokenB.toString());

    const { tx, mint } = await client.pool.getOpenPositionTx({
      provider,
      quote,
    });

    await tx.buildAndExecute();

    console.log("mint", mint.toBase58());
    const positionPda = getPositionPda(PROGRAM_ID, mint);

    const closeQuote = await client.pool.getClosePositionQuote({
      positionAddress: positionPda.publicKey,
      slippageTolerance: zeroSlippage,
    });

    console.log(closeQuote.minTokenA.toString(), closeQuote.minTokenB.toString());

    await (await client.pool.getClosePositionTx({ provider, quote: closeQuote })).buildAndExecute();
  });
});
