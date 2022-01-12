// import invariant from "tiny-invariant";
// import { OrcaDAL } from "../dal/orca-dal";

import {
  ClosePositionQuote,
  ClosePositionQuoteParam,
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
import { OrcaDAL } from "../dal/orca-dal";

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
    TODO();
  }

  /** 2. Close position quote **/
  public async getClosePositionQuote(param: ClosePositionQuoteParam): Promise<ClosePositionQuote> {
    TODO();
  }

  /** 3. Swap quote **/
  public async getSwapQuote(param: SwapQuoteParam): Promise<SwapQuote> {
    TODO();
  }

  /*** Helpers (private) ***/
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
