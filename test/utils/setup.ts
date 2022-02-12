import { WhirlpoolClient } from "@orca-so/whirlpool-client-sdk";
import { BN, Provider } from "@project-serum/anchor";
import { u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { getInitWhirlpoolConfigsTx, OrcaWhirlpoolClient, Percentage } from "../../src";
import { OrcaAdmin } from "../../src/admin/orca-admin";
import { ZERO } from "../../src/utils/web3/math-utils";
import { createAndMintToTokenAccount, createInOrderMints } from "./token";

export const DEFAULT_FEE_RATE = 3000;
export const DEFAULT_PROTOCOL_FEE_RATE = 300;
export const zeroSlippage = new Percentage(ZERO, new BN(100));

export async function initWhirlpoolsConfig(
  provider: Provider,
  programId: PublicKey,
  owner: PublicKey
) {
  const whirlpoolsConfigKeypair = Keypair.generate();
  const whirlpoolsConfig = whirlpoolsConfigKeypair.publicKey;

  await getInitWhirlpoolConfigsTx({
    programId,
    provider,
    whirlpoolConfigKeypair: whirlpoolsConfigKeypair,
    feeAuthority: owner,
    collectProtocolFeesAuthority: owner,
    rewardEmissionsSuperAuthority: owner,
    defaultFeeRate: DEFAULT_FEE_RATE,
    defaultProtocolFeeRate: DEFAULT_PROTOCOL_FEE_RATE,
  }).buildAndExecute();

  return whirlpoolsConfig;
}

export async function initPool(orcaAdmin: OrcaAdmin, provider: Provider) {
  const [tokenMintA, tokenMintB] = await createInOrderMints(provider);
  await createAndMintToTokenAccount(provider, tokenMintA, new u64("1000000000"));
  await createAndMintToTokenAccount(provider, tokenMintB, new u64("1000000000"));

  const { tx, address } = orcaAdmin.getInitPoolTx({
    provider,
    initialPrice: new Decimal(1.0005),
    tokenMintA,
    tokenMintB,
    stable: false,
  });

  await tx.buildAndExecute();
  return {
    poolAddress: address,
    tokenMintA,
    tokenMintB,
  };
}

export async function initPoolWithLiquidity(
  client: OrcaWhirlpoolClient,
  orcaAdmin: OrcaAdmin,
  provider: Provider
) {
  const { tokenMintA, tokenMintB, poolAddress } = await initPool(orcaAdmin, provider);

  const quote = await client.pool.getOpenPositionQuote({
    tickLowerIndex: -128,
    tickUpperIndex: 128,
    poolAddress,
    tokenMint: tokenMintA,
    tokenAmount: new BN("100000000"),
    slippageTolerance: zeroSlippage,
    refresh: true,
  });

  if (!quote) {
    throw Error("No pool found");
  }

  const openTx = await client.pool.getOpenPositionTx({
    provider,
    quote,
  });

  if (!openTx) {
    throw Error("No pool found");
  }

  const { tx, mint } = openTx;

  await tx.buildAndExecute();

  return {
    poolAddress,
    tokenMintA,
    tokenMintB,
    positionMint: mint,
  };
}
