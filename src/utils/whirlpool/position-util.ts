export enum PositionStatus {
  BelowRange,
  InRange,
  AboveRange,
}

export class PositionUtil {
  private constructor() {}

  public static getPositionStatus(
    tickCurrentIndex: number,
    tickLowerIndex: number,
    tickUpperIndex: number
  ): PositionStatus {
    if (tickCurrentIndex < tickLowerIndex) {
      return PositionStatus.BelowRange;
    } else if (tickCurrentIndex <= tickUpperIndex) {
      return PositionStatus.InRange;
    } else {
      return PositionStatus.AboveRange;
    }
  }
}
