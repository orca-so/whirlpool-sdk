import WhirlpoolClient from "@orca-so/whirlpool-client-sdk/dist/client";
import WhirlpoolContext from "@orca-so/whirlpool-client-sdk/dist/context";
import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { Wallet } from "@project-serum/anchor";
import { Commitment, Connection, Keypair, PublicKey } from "@solana/web3.js";

export type InitWhirlpoolConfigsTransactionParam = {
  connection: Connection;
  commitment: Commitment;
  programId: PublicKey;
  wallet: Wallet;
  whirlpoolConfigKeypair: Keypair;
  feeAuthority: PublicKey;
  collectProtocolFeesAuthority: PublicKey;
  rewardEmissionsSuperAuthority: PublicKey;
  defaultFeeRate: number;
  defaultProtocolFeeRate: number;
};

export function getInitWhirlpoolConfigsTransaction({
  connection,
  commitment,
  programId,
  wallet,
  whirlpoolConfigKeypair,
  feeAuthority,
  collectProtocolFeesAuthority,
  rewardEmissionsSuperAuthority,
  defaultFeeRate,
  defaultProtocolFeeRate,
}: InitWhirlpoolConfigsTransactionParam): TransactionBuilder {
  const ctx = WhirlpoolContext.from(connection, wallet, programId, {
    commitment,
  });
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
