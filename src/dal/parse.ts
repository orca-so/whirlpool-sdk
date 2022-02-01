import {
  parsePosition,
  parseTickArray,
  parseWhirlpool,
  parseWhirlpoolsConfig,
  PositionData,
  TickArrayData,
  WhirlpoolConfigAccount,
  WhirlpoolData,
} from "@orca-so/whirlpool-client-sdk";
import { AccountInfo, MintInfo, MintLayout, u64 } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { deserializeTokenAccount } from "../utils/web3/deserialize-token-account";

@staticImplements<ParsableEntity<WhirlpoolConfigAccount>>()
export class ParsableWhirlpoolsConfig {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): WhirlpoolConfigAccount | null {
    if (!data) {
      return null;
    }

    return parseWhirlpoolsConfig(data);
  }
}

@staticImplements<ParsableEntity<WhirlpoolData>>()
export class ParsableWhirlpool {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): WhirlpoolData | null {
    if (!data) {
      return null;
    }

    return parseWhirlpool(data);
  }
}

@staticImplements<ParsableEntity<PositionData>>()
export class ParsablePosition {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): PositionData | null {
    if (!data) {
      return null;
    }

    return parsePosition(data);
  }
}

@staticImplements<ParsableEntity<TickArrayData>>()
export class ParsableTickArray {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): TickArrayData | null {
    if (!data) {
      return null;
    }

    return parseTickArray(data);
  }
}

@staticImplements<ParsableEntity<AccountInfo>>()
export class ParsableTokenInfo {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): AccountInfo | null {
    if (!data) {
      return null;
    }

    return deserializeTokenAccount(data);
  }
}

@staticImplements<ParsableEntity<MintInfo>>()
export class ParsableMintInfo {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): MintInfo | null {
    if (!data) {
      return null;
    }

    const buffer = MintLayout.decode(data);
    const mintInfo: MintInfo = {
      mintAuthority: buffer.mintAuthorityOption === 0 ? null : new PublicKey(buffer.mintAuthority),
      supply: u64.fromBuffer(buffer.supply),
      decimals: buffer.decimals,
      isInitialized: buffer.isInitialized !== 0,
      freezeAuthority: buffer.freezeAuthority === 0 ? null : new PublicKey(buffer.freezeAuthority),
    };

    return mintInfo;
  }
}

/**
 * Static abstract class definition
 */
export interface ParsableEntity<T> {
  /**
   * Parse account data
   *
   * @param accountData
   * @returns
   */
  parse: (accountData: Buffer | undefined | null) => T | null;
}

/**
 * Class decorator to define an interface with static methods
 * Reference: https://github.com/Microsoft/TypeScript/issues/13462#issuecomment-295685298
 */
function staticImplements<T>() {
  return <U extends T>(constructor: U) => {
    constructor;
  };
}
