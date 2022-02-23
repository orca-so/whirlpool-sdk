import { toX64, WhirlpoolClient } from "@orca-so/whirlpool-client-sdk";
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

export async function initPool(orcaAdmin: OrcaAdmin, provider: Provider, initSqrtPrice: BN) {
  const [tokenMintA, tokenMintB] = await createInOrderMints(provider);
  await createAndMintToTokenAccount(provider, tokenMintA, new u64("1000000000"));
  await createAndMintToTokenAccount(provider, tokenMintB, new u64("1000000000"));

  const { tx, address } = orcaAdmin.getInitPoolTx({
    provider,
    initSqrtPrice,
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

export type PoolLiquidityParam = {
  tickLowerIndex: number;
  tickUpperIndex: number;
  isTokenMintA: true;
  tokenAmount: BN;
};

export async function initStandardPoolWithLiquidity(
  client: OrcaWhirlpoolClient,
  orcaAdmin: OrcaAdmin,
  provider: Provider
) {
  return initPoolWithLiquidity(client, orcaAdmin, provider, toX64(new Decimal(1.0005)), [
    {
      tickLowerIndex: -128,
      tickUpperIndex: 128,
      isTokenMintA: true,
      tokenAmount: new BN("100000000"),
    },
  ]);
}

export async function initPoolWithLiquidity(
  client: OrcaWhirlpoolClient,
  orcaAdmin: OrcaAdmin,
  provider: Provider,
  initSqrtPrice: BN,
  poolLiquidityParams: PoolLiquidityParam[]
) {
  const { tokenMintA, tokenMintB, poolAddress } = await initPool(
    orcaAdmin,
    provider,
    initSqrtPrice
  );

  const positionMints = [];

  for (let i = 0; i < poolLiquidityParams.length; i++) {
    const { tickLowerIndex, tickUpperIndex, isTokenMintA, tokenAmount } = poolLiquidityParams[i];

    const quote = await client.pool.getOpenPositionQuote({
      tickLowerIndex,
      tickUpperIndex,
      poolAddress,
      tokenMint: isTokenMintA ? tokenMintA : tokenMintB,
      tokenAmount,
      slippageTolerance: zeroSlippage,
      refresh: true,
    });

    const openTx = await client.pool.getOpenPositionTx({ provider, quote });

    const { tx, mint } = openTx;

    await tx.buildAndExecute();

    positionMints.push(mint);
  }

  return {
    poolAddress,
    tokenMintA,
    tokenMintB,
    positionMints,
  };
}
