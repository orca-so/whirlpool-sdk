import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk/dist/utils/transactions/transactions-builder";
import { Provider } from "@project-serum/anchor";

export class TransactionExecutable {
  private readonly provider: Provider;
  private readonly txBuilders: TransactionBuilder[];

  constructor(provider: Provider, txBuilders: TransactionBuilder[]) {
    this.provider = provider;
    this.txBuilders = txBuilders;
  }

  async executeAll(): Promise<string[]> {
    const txRequest = await Promise.all(
      this.txBuilders.map(async (txBuilder) => {
        const { transaction, signers } = await txBuilder.build();
        return { tx: transaction, signers };
      })
    );
    return await this.provider.sendAll(txRequest);
  }
}
