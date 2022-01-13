// import invariant from "tiny-invariant";
// import { OrcaDAL } from "../dal/orca-dal";

import { WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { MintInfo, u64 } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  ClosePositionTransactionParam,
  ClosePositoinTransaction,
  OpenPositionQuote,
  OpenPositionQuoteParam,
  OpenPositionTransaction,
  OpenPositionTransactionParam,
  SwapQuote,
  SwapQuoteParam,
  SwapTransaction,
  SwapTransactionParam,
} from "..";
import { defaultSlippagePercentage } from "../constants/defaults";
import { OrcaDAL } from "../dal/orca-dal";
import {
  getAddLiquidityQuoteWhenPositionIsAboveRange,
  getAddLiquidityQuoteWhenPositionIsBelowRange,
  getAddLiquidityQuoteWhenPositionIsInRange,
  InternalAddLiquidityQuoteParam,
} from "../position/quotes/add-liquidity";
import { PositionStatus, PositionUtil } from "../utils/whirlpool/position-util";

function TODO(): never {
  throw new Error("TODO: Implement");
}

export class OrcaWhirlpool {
  constructor(private readonly dal: OrcaDAL) {}

  /*** Transactions (public) ***/

  /** 1. Open position tx **/
  public async getOpenPositionTransaction(
    param: OpenPositionTransactionParam
  ): Promise<OpenPositionTransaction> {
    TODO();
  }

  /** 2. Close position tx **/
  public async getClosePositionTransaction(
    param: ClosePositionTransactionParam
  ): Promise<ClosePositoinTransaction> {
    TODO();
  }

  /** 3. Swap tx **/
  public async getSwapTransaction(param: SwapTransactionParam): Promise<SwapTransaction> {
    TODO();
  }

  /*** Quotes (public) ***/

  /** 1. Open position quote **/
  public async getOpenPositionQuote(param: OpenPositionQuoteParam): Promise<OpenPositionQuote> {
    const {
      whirlpoolAddress,
      tokenMint,
      tokenAmount,
      tickLowerIndex,
      tickUpperIndex,
      slippageTolerence = defaultSlippagePercentage,
      refresh,
    } = param;

    const dummyPosition = {
      whirlpool: whirlpoolAddress,
      positionMint: Keypair.generate().publicKey,
      liquidity: new u64(0),
      tickLowerIndex,
      tickUpperIndex,
      // TODO(atamari): Make sure these values make sense (or we just treat this is a dummy value and ignore)
      feeGrowthCheckpointA: new u64(0),
      feeOwedA: new u64(0),
      feeGrowthCheckpointB: new u64(0),
      feeOwedB: new u64(0),
      rewardInfos: [],
    };

    const whirlpool = await this.getWhirlpool(whirlpoolAddress, refresh);
    const [tokenAMintInfo, tokenBMintInfo] = await this.getTokenMintInfos(whirlpool, refresh);

    const addLiquidityParams: InternalAddLiquidityQuoteParam = {
      whirlpool,
      position: dummyPosition,
      tokenAMintInfo,
      tokenBMintInfo,
      tokenMint,
      tokenAmount,
      slippageTolerence,
    };

    switch (PositionUtil.getPositionStatus(whirlpool, dummyPosition)) {
      case PositionStatus.BelowRange:
        return getAddLiquidityQuoteWhenPositionIsBelowRange(addLiquidityParams);
      case PositionStatus.InRange:
        return getAddLiquidityQuoteWhenPositionIsInRange(addLiquidityParams);
      case PositionStatus.AboveRange:
        return getAddLiquidityQuoteWhenPositionIsAboveRange(addLiquidityParams);
    }
  }

  /** 2. Swap quote **/
  public async getSwapQuote(param: SwapQuoteParam): Promise<SwapQuote> {
    TODO();
  }

  /*** Helpers (private) ***/
  private async getWhirlpool(address: PublicKey, refresh = false): Promise<WhirlpoolData> {
    const whirlpool = await this.dal.getPool(address, refresh);
    invariant(!!whirlpool, "OrcaWhirlpool - whirlpool does not exist");
    return whirlpool;
  }

  private async getTokenMintInfos(
    whirlpool: WhirlpoolData,
    refresh = false
  ): Promise<[MintInfo, MintInfo]> {
    const mintInfos = await this.dal.listMintInfos(
      [whirlpool.tokenMintA, whirlpool.tokenMintB],
      refresh
    );
    invariant(!!mintInfos && mintInfos.length === 2, "OrcaWhirlpool - mint infos do not exist");
    return [mintInfos[0], mintInfos[1]];
  }
}

// /**
//  * Random notes: nft represents the authority to a specific position
//  */
// export class OrcaWhirlpool {
//   private readonly dal: OrcaDAL;

//   constructor(dal: OrcaDAL) {
//     this.dal = dal;
//   }

//   // create whirlpool and tickarray accounts
//   public async getInitPoolTransaction(
//     initialPrice: TokenPrice<A, B> | TokenPrice<B, A>
//   ): Promise<any> {
//     // TODO(atamari): Confirm that token A is base and token B is quote always

//     // from yutaro feedback:
//     // 1. Token A should always be the base and token B should always be the quote.
//     // 2. Token A should always be the base and token B should always be the quote.
//     // SCUBA-ATAMARI: we should add the token sort logic here as well

//     const normalizedInitialPrice = initialPrice.matchBaseAndQuote(this.tokenA, this.tokenB);

//     // TODO: compute the initial sqrt price from initial price
//     // TODO: get all accounts (pubkeys) needed to init this pool
//     // TODO: build the init pool ix

//     // TODO: compute initial tick array params
//     // TODO: get all accounts (pubkeys) needed to init the tick array
//     // TODO: build the init tick array ix

//     // TODO: Return one tx to init pool + init tick array

//     throw new Error("TODO - implement");
//   }

//   public async getOpenPositionQuote(
//     token: A | B,
//     tokenAmount: u64,
//     tickLowerIndex: number,
//     tickUpperIndex: number,
//     slippageTolerence = defaultSlippagePercentage
//   ): Promise<{ maxTokenA: u64; maxTokenB: u64; liquidity: u64 }> {
//     const { sqrtPriceX64: sqrtPrice } = await this.getWhirlpool();

//     const sqrtPriceLower = TickMath.sqrtPriceAtTick(tickLowerIndex);
//     const sqrtPriceUpper = TickMath.sqrtPriceAtTick(tickUpperIndex);

//     const tokenAmountX64 = BNUtils.u64ToX64(tokenAmount);

//     // 3.2.1 Example 1: Amount of assets from a range
//     const LxX64 = tokenAmountX64
//       .mul(sqrtPrice)
//       .mul(sqrtPriceUpper)
//       .div(sqrtPriceUpper.sub(sqrtPrice));
//     const yX64 = LxX64.mul(sqrtPrice.sub(sqrtPriceLower));
//     const yU64 = BNUtils.x64ToU64Floor(yX64);

//     throw new Error("TODO - implement");
//   }

//   public async getOpenPositionTransaction(
//     owner: Owner,
//     tokenAccountA: any,
//     tokenAccountB: any,
//     token: any,
//     tokenAmount: any,
//     tickLowerIndex: number,
//     tickUpperIndex: number,
//     slippageTolerence?: Percentage | undefined
//   ): Promise<any> {}

//   public async getSwapQuote(
//     swapAmount: SwapAmount<A, B>,
//     slippageTolerance = defaultSlippagePercentage
//   ): Promise<SwapQuote<A, B>> {
//     const whirlpool = await this.getWhirlpool();
//     const currentTickArray = await this.getCurrentTickArray();

//     return getSwapQuote({
//       whirlpool,
//       currentTickArray,
//       tokenA: this.tokenA,
//       tokenB: this.tokenB,
//       amount: swapAmount,
//       slippageTolerance,
//     });
//   }

//   public async getSwapTransaction(
//     owner: Owner,
//     tokenAccountA: any,
//     tokenAccountB: any,
//     amount: any,
//     slippageTolerence?: Percentage | undefined
//   ): Promise<any> {
//     throw new Error("TODO");
//   }

//   public async getLiquidityDistribution(): Promise<any> {
//     throw new Error("TODO");
//   }

//   public async getSuggestedPriceRange(conservative: boolean): Promise<any> {
//     throw new Error("TODO");
//   }

//   public async loadTickArray(tickIndex: number): Promise<TickArrayAccount> {
//     const whirlpool = await this.getWhirlpool();

//     const tickArrayAddress = TickArrayEntity.getAddressContainingTickIndex(
//       tickIndex,
//       whirlpool,
//       this.dal.programId
//     );
//     const tickArray = await this.dal.getTickArray(tickArrayAddress);
//     invariant(!!tickArray, "loadTickArray - tick_array does not exist");

//     return tickArray;
//   }

//   private async getWhirlpool(): Promise<WhirlpoolAccount> {
//     const whirlpool = await this.dal.getWhirlpool(this.address);
//     invariant(!!whirlpool, "OrcaWhirlpool - whirlpool does not exist");
//     return whirlpool;
//   }

//   private async getCurrentTickArray(): Promise<TickArrayAccount> {
//     const { tickArrayStart } = await this.getWhirlpool();
//     const tickArrayAddress = TickArrayEntity.deriveAddress(
//       this.address,
//       tickArrayStart,
//       this.dal.programId
//     );

//     const tickArray = await this.dal.getTickArray(tickArrayAddress);
//     invariant(!!tickArray, "OrcaWhirlpool - tickArray does not exist");
//     return tickArray;
//   }
// }
