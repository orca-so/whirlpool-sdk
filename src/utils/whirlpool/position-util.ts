import { PositionData, WhirlpoolData } from "@orca-so/whirlpool-client-sdk/dist/types/anchor-types";

export enum PositionStatus {
  BelowRange,
  InRange,
  AboveRange,
}

export class PositionUtil {
  private constructor() {}

  public static getPositionStatus(
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
