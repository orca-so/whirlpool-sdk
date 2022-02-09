import { TransactionBuilder } from "@orca-so/whirlpool-client-sdk";
import { Provider } from "@project-serum/anchor";
import invariant from "tiny-invariant";

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

  public async buildAndExecute(): Promise<string[]> {
    const txRequest = await Promise.all(
      this.txBuilders.map(async (txBuilder) => {
        const { transaction, signers } = await txBuilder.build();
        return { tx: transaction, signers };
      })
    );
    return await this.provider.sendAll(txRequest);
  }

  public merge(multiTxBuilder: MultiTransactionBuilder): MultiTransactionBuilder {
    return new MultiTransactionBuilder(this.provider, [
      ...this.txBuilders,
      ...multiTxBuilder.txBuilders,
    ]);
  }

  public static mergeAll(
    multiTxBuilders: MultiTransactionBuilder[]
  ): MultiTransactionBuilder | null {
    const provider = multiTxBuilders[0]?.provider;
    if (!provider) {
      return null;
    }

    const combinedTxBuilders: TransactionBuilder[] = [];
    multiTxBuilders.forEach(({ txBuilders }) => combinedTxBuilders.push(...txBuilders));

    return new MultiTransactionBuilder(provider, combinedTxBuilders);
  }
}
