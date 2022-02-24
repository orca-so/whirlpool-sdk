import {
  TransactionBuilder,
  WhirlpoolContext,
  WhirlpoolClient,
  TickSpacing,
  InitFeeTierParams,
  getFeeTierPda,
} from "@orca-so/whirlpool-client-sdk";
import { Address, Provider } from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import { toPubKey } from "../../utils/address";

export type InitWhirlpoolConfigsTxParam = {
  programId: Address;
  provider: Provider;
  whirlpoolConfigKeypair: Keypair;
  feeAuthority: Address;
  collectProtocolFeesAuthority: Address;
  rewardEmissionsSuperAuthority: Address;
  defaultProtocolFeeRate: number;
};

export function getInitWhirlpoolConfigsTx({
  programId,
  provider,
  whirlpoolConfigKeypair,
  feeAuthority,
  collectProtocolFeesAuthority,
  rewardEmissionsSuperAuthority,
  defaultProtocolFeeRate,
}: InitWhirlpoolConfigsTxParam): TransactionBuilder {
  const ctx = WhirlpoolContext.withProvider(provider, toPubKey(programId));
  const client = new WhirlpoolClient(ctx);

  return client.initConfigTx({
    whirlpoolConfigKeypair,
    feeAuthority: toPubKey(feeAuthority),
    collectProtocolFeesAuthority: toPubKey(collectProtocolFeesAuthority),
    rewardEmissionsSuperAuthority: toPubKey(rewardEmissionsSuperAuthority),
    defaultProtocolFeeRate,
    funder: provider.wallet.publicKey,
  });
}

export type InitFeeTierConfigTxParam = {
  programId: Address;
  provider: Provider;
  whirlpoolConfigKey: Address;
  feeAuthority: Address;
  tickSpacing: TickSpacing;
  defaultFeeRate: number;
};

export function getInitFeeTierConfigTx({
  programId,
  provider,
  whirlpoolConfigKey,
  feeAuthority,
  tickSpacing,
  defaultFeeRate,
}: InitFeeTierConfigTxParam): TransactionBuilder {
  const ctx = WhirlpoolContext.withProvider(provider, toPubKey(programId));
  const client = new WhirlpoolClient(ctx);
  const feeTierPda = getFeeTierPda(toPubKey(programId), toPubKey(whirlpoolConfigKey), tickSpacing);
  const params: InitFeeTierParams = {
    whirlpoolConfigKey: toPubKey(whirlpoolConfigKey),
    feeAuthority: toPubKey(feeAuthority),
    feeTierPda,
    tickSpacing,
    defaultFeeRate,
    funder: provider.wallet.publicKey,
  };
  return client.initFeeTierTx(params);
}
