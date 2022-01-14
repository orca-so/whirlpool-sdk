import WhirlpoolClient from "@orca-so/whirlpool-client-sdk/dist/client";
import WhirlpoolContext from "@orca-so/whirlpool-client-sdk/dist/context";
import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { Provider } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

export type InitWhirlpoolConfigsTransactionParam = {
  programId: PublicKey;
  provider: Provider;
  whirlpoolConfigKeypair: Keypair;
  feeAuthority: PublicKey;
  collectProtocolFeesAuthority: PublicKey;
  rewardEmissionsSuperAuthority: PublicKey;
  defaultFeeRate: number;
  defaultProtocolFeeRate: number;
};

export function getInitWhirlpoolConfigsTransaction({
  programId,
  provider,
  whirlpoolConfigKeypair,
  feeAuthority,
  collectProtocolFeesAuthority,
  rewardEmissionsSuperAuthority,
  defaultFeeRate,
  defaultProtocolFeeRate,
}: InitWhirlpoolConfigsTransactionParam): TransactionBuilder {
  const ctx = WhirlpoolContext.withProvider(provider, programId);
  const client = new WhirlpoolClient(ctx);

  return client.initConfigTx({
    whirlpoolConfigKeypair,
    feeAuthority,
    collectProtocolFeesAuthority,
    rewardEmissionsSuperAuthority,
    defaultFeeRate,
    defaultProtocolFeeRate,
  });
}
