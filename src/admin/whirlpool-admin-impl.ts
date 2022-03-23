import {
  TransactionBuilder,
  InitFeeTierParams,
  WhirlpoolClient,
  getFeeTierPda,
} from "@orca-so/whirlpool-client-sdk";
import { Address, translateAddress } from "@project-serum/anchor";
import { WhirlpoolAdmin } from "../admin";
import { WhirlpoolContext } from "../context";
import { toPubKey } from "../utils/address";
import { SetCollectProtocolFeesAuthorityTxParam, InitWhirlpoolConfigsTxParam } from "./public";

export class WhirlpoolAdminImpl implements WhirlpoolAdmin {
  constructor(readonly ctx: WhirlpoolContext) {}

  // TODO: Context dictates that we are current in an existing configAddress space.
  // So it's a bit weird to have a WhirlpoolAdmin of a certain context initing another config
  // Maybe place this in WhirlpoolAdminInstance?
  initConfig(params: InitWhirlpoolConfigsTxParam): TransactionBuilder {
    const {
      whirlpoolConfigKeypair,
      feeAuthority,
      collectProtocolFeesAuthority,
      rewardEmissionsSuperAuthority,
      defaultProtocolFeeRate,
    } = params;
    const client = new WhirlpoolClient(this.ctx);

    return client.initConfigTx({
      whirlpoolConfigKeypair,
      feeAuthority: toPubKey(feeAuthority),
      collectProtocolFeesAuthority: toPubKey(collectProtocolFeesAuthority),
      rewardEmissionsSuperAuthority: toPubKey(rewardEmissionsSuperAuthority),
      defaultProtocolFeeRate,
      funder: this.ctx.provider.wallet.publicKey,
    });
  }

  initFeeTier(params: InitFeeTierParams): TransactionBuilder {
    const { whirlpoolConfigKey, tickSpacing, feeAuthority, defaultFeeRate } = params;
    const client = new WhirlpoolClient(this.ctx);
    const feeTierPda = getFeeTierPda(
      toPubKey(this.ctx.program.programId),
      toPubKey(whirlpoolConfigKey),
      tickSpacing
    );

    return client.initFeeTierTx({
      whirlpoolConfigKey: toPubKey(whirlpoolConfigKey),
      feeAuthority: toPubKey(feeAuthority),
      feeTierPda,
      tickSpacing,
      defaultFeeRate,
      funder: this.ctx.provider.wallet.publicKey,
    });
  }

  setFeeAuthority(newFeeAuthority: Address): TransactionBuilder {
    const client = new WhirlpoolClient(this.ctx);
    return client.setFeeAuthorityTx({
      whirlpoolsConfig: translateAddress(this.ctx.configAddress),
      feeAuthority: this.ctx.provider.wallet.publicKey,
      newFeeAuthority: toPubKey(newFeeAuthority),
    });
  }

  setCollectProtocolFeeAuthority(
    param: SetCollectProtocolFeesAuthorityTxParam
  ): TransactionBuilder {
    const { newCollectProtocolFeesAuthority } = param;
    const client = new WhirlpoolClient(this.ctx);

    return client.setCollectProtocolFeesAuthorityTx({
      whirlpoolsConfig: this.ctx.configAddress,
      collectProtocolFeesAuthority: this.ctx.provider.wallet.publicKey,
      newCollectProtocolFeesAuthority: toPubKey(newCollectProtocolFeesAuthority),
    });
  }

  setRewardEmissionsBySuperAuthority(
    rewardEmissionsSuperAuthority: Address,
    newRewardEmissionsSuperAuthority: Address
  ): TransactionBuilder {
    const client = new WhirlpoolClient(this.ctx);

    return client.setRewardEmissionsSuperAuthorityTx({
      whirlpoolsConfig: this.ctx.configAddress,
      rewardEmissionsSuperAuthority: toPubKey(rewardEmissionsSuperAuthority),
      newRewardEmissionsSuperAuthority: toPubKey(newRewardEmissionsSuperAuthority),
    });
  }
}
