import {
  TransactionBuilder,
  WhirlpoolContext,
  WhirlpoolClient,
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
  defaultFeeRate: number;
  defaultProtocolFeeRate: number;
};

export function getInitWhirlpoolConfigsTx({
  programId,
  provider,
  whirlpoolConfigKeypair,
  feeAuthority,
  collectProtocolFeesAuthority,
  rewardEmissionsSuperAuthority,
  defaultFeeRate,
  defaultProtocolFeeRate,
}: InitWhirlpoolConfigsTxParam): TransactionBuilder {
  const ctx = WhirlpoolContext.withProvider(provider, toPubKey(programId));
  const client = new WhirlpoolClient(ctx);

  return client.initConfigTx({
    whirlpoolConfigKeypair,
    feeAuthority: toPubKey(feeAuthority),
    collectProtocolFeesAuthority: toPubKey(collectProtocolFeesAuthority),
    rewardEmissionsSuperAuthority: toPubKey(rewardEmissionsSuperAuthority),
    defaultFeeRate,
    defaultProtocolFeeRate,
    funder: provider.wallet.publicKey,
  });
}
