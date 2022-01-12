import {
  PositionData,
  TickData,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";
import { MintInfo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import invariant from "tiny-invariant";
import {
  AddLiquidityQuote,
  AddLiquidityQuoteParam,
  CollectFeesQuote,
  CollectFeesQuoteParam,
  CollectRewardsQuote,
  CollectRewardsQuoteParam,
  PositionStatus,
  RemoveLiquidityQuote,
  RemoveLiquidityQuoteParam,
} from "..";
import { defaultSlippagePercentage } from "../constants/defaults";
import { OrcaDAL } from "../dal/orca-dal";
import { TransactionPayload } from "../utils/instruction";
import { TickUtil } from "../utils/tick-util";
import {
  getAddLiquidityQuoteWhenPositionIsAboveRange,
  getAddLiquidityQuoteWhenPositionIsBelowRange,
  getAddLiquidityQuoteWhenPositionIsInRange,
  InternalAddLiquidityQuoteParam,
} from "./quotes/add-liquidity";
import { getCollectFeesQuoteInternal } from "./quotes/collect-fees";
import { getCollectRewardsQuoteInternal } from "./quotes/collect-rewards";
import {
  getRemoveLiquidityQuoteWhenPositionIsAboveRange,
  getRemoveLiquidityQuoteWhenPositionIsBelowRange,
  getRemoveLiquidityQuoteWhenPositionIsInRange,
  InternalRemoveLiquidityQuoteParam,
} from "./quotes/remove-liquidity";

export class OrcaPosition {
  private readonly dal: OrcaDAL;

  constructor(dal: OrcaDAL) {
    this.dal = dal;
  }

  /*** Transactions ***/

  public async getAddLiquidityTransaction(
    payer: PublicKey,
    quote: AddLiquidityQuote
  ): Promise<TransactionPayload> {
    throw new Error("Method not implemented.");
  }

  public async getRemoveLiquidityTransaction(
    payer: PublicKey,
    quote: RemoveLiquidityQuote
  ): Promise<TransactionPayload> {
    throw new Error("Method not implemented.");
  }

  public async getCollectFeesAndRewardsTransaction(payer: PublicKey): Promise<TransactionPayload> {
    // 1. update state
    // 2. get fees
    // 3. get reward 1
    // 4. get reward 2
    // 5. get reward 3
    throw new Error("Method not implemented.");
  }

  /*** Quotes ***/

  public async getAddLiquidityQuote(param: AddLiquidityQuoteParam): Promise<AddLiquidityQuote> {
    const { address, tokenMint, tokenAmount, refresh, slippageTolerence } = param;

    const position = await this.getPosition(address, refresh);
    const whirlpool = await this.getWhirlpool(position, refresh);
    const positionStatus = OrcaPosition.getPositionStatus(whirlpool, position);
    const [tokenAMintInfo, tokenBMintInfo] = await this.getTokenMintInfos(whirlpool);

    const quoteParam: InternalAddLiquidityQuoteParam = {
      whirlpool,
      position,
      tokenAMintInfo,
      tokenBMintInfo,
      tokenMint,
      tokenAmount,
      slippageTolerence: slippageTolerence || defaultSlippagePercentage,
    };

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        return getAddLiquidityQuoteWhenPositionIsBelowRange(quoteParam);
      case PositionStatus.InRange:
        return getAddLiquidityQuoteWhenPositionIsInRange(quoteParam);
      case PositionStatus.AboveRange:
        return getAddLiquidityQuoteWhenPositionIsAboveRange(quoteParam);
      default:
        throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
    }
  }

  public async getRemoveLiquidityQuote(
    param: RemoveLiquidityQuoteParam
  ): Promise<RemoveLiquidityQuote> {
    const { address, liquidity, refresh, slippageTolerence } = param;

    const position = await this.getPosition(address, refresh);
    const whirlpool = await this.getWhirlpool(position, refresh);
    const positionStatus = OrcaPosition.getPositionStatus(whirlpool, position);
    const [tokenAMintInfo, tokenBMintInfo] = await this.getTokenMintInfos(whirlpool);

    const quoteParam: InternalRemoveLiquidityQuoteParam = {
      whirlpool,
      position,
      tokenAMintInfo,
      tokenBMintInfo,
      liquidity,
      slippageTolerence: slippageTolerence || defaultSlippagePercentage,
    };

    switch (positionStatus) {
      case PositionStatus.BelowRange:
        return getRemoveLiquidityQuoteWhenPositionIsBelowRange(quoteParam);
      case PositionStatus.InRange:
        return getRemoveLiquidityQuoteWhenPositionIsInRange(quoteParam);
      case PositionStatus.AboveRange:
        return getRemoveLiquidityQuoteWhenPositionIsAboveRange(quoteParam);
      default:
        throw new Error(`type ${positionStatus} is an unknown PositionStatus`);
    }
  }

  public async getCollectFeesQuote(param: CollectFeesQuoteParam): Promise<CollectFeesQuote> {
    const { address, refresh } = param;

    const position = await this.getPosition(address, refresh);
    const whirlpool = await this.getWhirlpool(position, refresh);
    const [tickLower, tickUpper] = await this.getTickData(position, refresh);

    return getCollectFeesQuoteInternal({ whirlpool, position, tickLower, tickUpper });
  }

  public async getCollectRewardsQuote(
    param: CollectRewardsQuoteParam
  ): Promise<CollectRewardsQuote> {
    const { address, refresh } = param;

    const position = await this.getPosition(address, refresh);
    const whirlpool = await this.getWhirlpool(position, refresh);
    const [tickLower, tickUpper] = await this.getTickData(position, refresh);

    return getCollectRewardsQuoteInternal({ whirlpool, position, tickLower, tickUpper });
  }

  /*** Helpers ***/

  private async getPosition(address: PublicKey, refresh = false): Promise<PositionData> {
    const position = await this.dal.getPosition(address, refresh);
    invariant(!!position, "OrcaPosition - position does not exist");
    return position;
  }

  private async getWhirlpool(position: PositionData, refresh = false): Promise<WhirlpoolData> {
    const whirlpool = await this.dal.getPool(position.whirlpool, refresh);
    invariant(!!whirlpool, "OrcaPosition - whirlpool does not exist");
    return whirlpool;
  }

  private async getTokenMintInfos(whirlpool: WhirlpoolData): Promise<[MintInfo, MintInfo]> {
    const mintInfos = await this.dal.listMintInfos([whirlpool.tokenMintA, whirlpool.tokenMintB]);
    invariant(!!mintInfos && mintInfos.length === 2, "OrcaPosition - mint infos do not exist");
    return [mintInfos[0], mintInfos[1]];
  }

  private async getTickData(
    position: PositionData,
    refresh = false
  ): Promise<[TickData, TickData]> {
    const { tickLowerIndex, tickUpperIndex, whirlpool } = position;

    const tickLowerAddress = TickUtil.getAddressContainingTickIndex(
      tickLowerIndex,
      whirlpool,
      this.dal.programId
    );
    const tickUpperAddress = TickUtil.getAddressContainingTickIndex(
      tickUpperIndex,
      whirlpool,
      this.dal.programId
    );

    const [tickArrayLower, tickArrayUpper] = await this.dal.listTickArrays(
      [tickLowerAddress, tickUpperAddress],
      refresh
    );
    invariant(!!tickArrayLower, "OrcaPosition - tickArrayLower does not exist");
    invariant(!!tickArrayUpper, "OrcaPosition - tickArrayUpper does not exist");

    return [
      TickUtil.getTick(tickArrayLower, tickLowerIndex),
      TickUtil.getTick(tickArrayUpper, tickUpperIndex),
    ];
  }

  private static getPositionStatus(
    whirlpool: WhirlpoolData,
    position: PositionData
  ): PositionStatus {
    const { tickCurrentIndex } = whirlpool;
    const { tickLowerIndex, tickUpperIndex } = position;

    if (tickCurrentIndex < tickLowerIndex) {
      return PositionStatus.BelowRange;
    } else if (tickCurrentIndex <= tickUpperIndex) {
      return PositionStatus.InRange;
    } else {
      return PositionStatus.AboveRange;
    }
  }
}
