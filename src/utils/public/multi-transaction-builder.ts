import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk";
import { Provider } from "@project-serum/anchor";

/**
 * Collection of TransactionBuilders for grouping multiple transactions together for sendAll.
 */
export class MultiTransactionBuilder {
  private readonly provider: Provider;
  private readonly txBuilders: TransactionBuilder[];

  constructor(provider: Provider, txBuilders: TransactionBuilder[]) {
    this.provider = provider;
    this.txBuilders = txBuilders;
  }

  async buildAndExecute(): Promise<string[]> {
    const txRequest = await Promise.all(
      this.txBuilders.map(async (txBuilder) => {
        const { transaction, signers } = await txBuilder.build();
        return { tx: transaction, signers };
      })
    );
    return await this.provider.sendAll(txRequest);
  }
}
