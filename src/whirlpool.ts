import { Address, translateAddress } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { ClosePositionQuote, OpenPositionQuote, SwapQuote } from "./pool/public/types";
import { MultiTransactionBuilder } from "./utils/public/multi-transaction-builder";
import {
  TransactionBuilder,
  WhirlpoolData,
  getWhirlpoolPda,
  TickSpacing,
} from "@orca-so/whirlpool-client-sdk";
import { WhirlpoolContext } from "./context";
import {
  InitPoolTxParam,
  InitRewardTxParam,
  SetRewardAuthorityTxParam,
  SetRewardEmissionsTxParam,
} from "./admin/public";
import { WhirlpoolImpl } from "./pool/whirlpool-impl";
import { toPubKey } from "./utils/address";
import { PoolUtil } from "./utils/whirlpool/pool-util";
import { LiquidityDistribution } from "./pool/ux/liquidity-distribution";

// TODO: Add comments
export type Whirlpool = {
  getAddress(): PublicKey;
  getAccount(refresh: boolean): Promise<WhirlpoolData | null>;
  getLiquidityDistribution(
    tickLower: number,
    tickUpper: number,
    refresh: boolean
  ): Promise<LiquidityDistribution>;

  init(param: InitPoolTxParam): { tx: TransactionBuilder; address: PublicKey };

  openPosition(quote: OpenPositionQuote): Promise<{ tx: MultiTransactionBuilder; mint: PublicKey }>;
  closePosition(quote: ClosePositionQuote): Promise<TransactionBuilder>;
  swap(quote: SwapQuote): Promise<MultiTransactionBuilder>;

  initTickArray(startTick: number): Promise<TransactionBuilder>;
  initTickArrayGap(): Promise<MultiTransactionBuilder>;

  setFeeRate(feeRate: number): Promise<TransactionBuilder>;
  setProtocolFeeRate(protocolFeeRate: number): Promise<TransactionBuilder>;
  collectProtocolFee(): Promise<TransactionBuilder>;

  initReward(param: InitRewardTxParam): {
    tx: TransactionBuilder;
    rewardVault: PublicKey;
  };
  setRewardAuthority(param: SetRewardAuthorityTxParam): TransactionBuilder;
  setRewardEmissions(param: SetRewardEmissionsTxParam): Promise<TransactionBuilder>;
  setRewardAuthorityBySuperAuthority(
    newRewardAuthority: Address,
    rewardIndex: number
  ): TransactionBuilder;
};

export class WhirlpoolInstance {
  public static fromAddress(ctx: WhirlpoolContext, address: Address): Whirlpool {
    return new WhirlpoolImpl(ctx, translateAddress(address));
  }

  public static fromTokens(
    ctx: WhirlpoolContext,
    tokenMintA: Address,
    tokenMintB: Address,
    tickSpacing: TickSpacing
  ): Whirlpool {
    // TODO: Ordering should be done by client-sdk
    const [_tokenMintA, _tokenMintB] = PoolUtil.orderMints(tokenMintA, tokenMintB);
    const address = getWhirlpoolPda(
      ctx.program.programId,
      ctx.configAddress,
      toPubKey(_tokenMintA),
      toPubKey(_tokenMintB),
      tickSpacing
    ).publicKey;
    return new WhirlpoolImpl(ctx, address);
  }
}
