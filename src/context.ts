import * as sdk from "@orca-so/whirlpool-client-sdk";
import { Whirlpool } from "@orca-so/whirlpool-client-sdk/dist/artifacts/whirlpool";
import { Program, Provider } from "@project-serum/anchor";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider";
import { ConfirmOptions, Connection, PublicKey } from "@solana/web3.js";
import { AccountFetcher } from "./accounts/account-fetcher";
import { getWhirlpoolProgramId, getWhirlpoolsConfig } from "./constants/programs";
import { defaultNetwork, OrcaNetwork } from "./constants/public";

/**
 * Context object containing information applicable to Whirlpools
 * of a specific program & config space.
 *
 * // TODO: This class, is meant to be the same as client-sdk/WhirlpoolContext.
 * We'll merge the two when both SDKs when we are ready.
 */
export class WhirlpoolContext {
  readonly configAddress: PublicKey;
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly opts: ConfirmOptions;
  readonly program: Program<Whirlpool>;
  readonly provider: Provider;
  readonly accountFetcher: AccountFetcher;

  public constructor(
    provider: Provider,
    configAddress?: PublicKey,
    network?: OrcaNetwork, // TODO: Why custom enum? Are there other networks?
    programId?: PublicKey
  ) {
    const derivedNetwork = network || defaultNetwork;
    const derivedPid = programId || getWhirlpoolProgramId(derivedNetwork);
    const clientCtx = sdk.WhirlpoolContext.withProvider(provider, derivedPid);
    this.connection = clientCtx.connection;
    this.wallet = clientCtx.provider.wallet;
    this.opts = provider.opts;
    this.program = clientCtx.program;
    this.provider = provider;
    this.configAddress = configAddress || getWhirlpoolsConfig(derivedNetwork);
    this.accountFetcher = new AccountFetcher(this.connection);
  }
}
