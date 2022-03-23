import { TransactionBuilder, InitFeeTierParams } from "@orca-so/whirlpool-client-sdk";
import { Address } from "@project-serum/anchor";
import {
  InitWhirlpoolConfigsTxParam,
  SetCollectProtocolFeesAuthorityTxParam,
} from "./admin/public";
import { WhirlpoolAdminImpl } from "./admin/whirlpool-admin-impl";
import { WhirlpoolContext } from "./context";

// TODO: Add comments
export type WhirlpoolAdmin = {
  initConfig(params: InitWhirlpoolConfigsTxParam): TransactionBuilder;

  initFeeTier(params: InitFeeTierParams): TransactionBuilder;
  setFeeAuthority(newFeeAuthority: Address): TransactionBuilder;

  setCollectProtocolFeeAuthority(param: SetCollectProtocolFeesAuthorityTxParam): TransactionBuilder;
  setRewardEmissionsBySuperAuthority(
    rewardEmissionsSuperAuthority: Address,
    newRewardEmissionsSuperAuthority: Address
  ): TransactionBuilder;
};

export class WhirlpoolAdminInstance {
  public static from(ctx: WhirlpoolContext): WhirlpoolAdmin {
    return new WhirlpoolAdminImpl(ctx);
  }
}
