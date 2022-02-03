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

    try {
      return parseWhirlpoolsConfig(data);
    } catch (e) {
      console.error(`error while parsing WhirlpoolsConfig: ${e}`);
      return null;
    }
  }
}

@staticImplements<ParsableEntity<WhirlpoolData>>()
export class ParsableWhirlpool {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): WhirlpoolData | null {
    if (!data) {
      return null;
    }

    try {
      return parseWhirlpool(data);
    } catch (e) {
      console.error(`error while parsing Whirlpool: ${e}`);
      return null;
    }
  }
}

@staticImplements<ParsableEntity<PositionData>>()
export class ParsablePosition {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): PositionData | null {
    if (!data) {
      return null;
    }

    try {
      return parsePosition(data);
    } catch (e) {
      console.error(`error while parsing Position: ${e}`);
      return null;
    }
  }
}

@staticImplements<ParsableEntity<TickArrayData>>()
export class ParsableTickArray {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): TickArrayData | null {
    if (!data) {
      return null;
    }

    try {
      return parseTickArray(data);
    } catch (e) {
      console.error(`error while parsing TickArray: ${e}`);
      return null;
    }
  }
}

@staticImplements<ParsableEntity<AccountInfo>>()
export class ParsableTokenInfo {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): AccountInfo | null {
    if (!data) {
      return null;
    }

    try {
      return deserializeTokenAccount(data);
    } catch (e) {
      console.error(`error while parsing TokenAccount: ${e}`);
      return null;
    }
  }
}

@staticImplements<ParsableEntity<MintInfo>>()
export class ParsableMintInfo {
  private constructor() {}

  public static parse(data: Buffer | undefined | null): MintInfo | null {
    if (!data) {
      return null;
    }

    try {
      const buffer = MintLayout.decode(data);
      const mintInfo: MintInfo = {
        mintAuthority:
          buffer.mintAuthorityOption === 0 ? null : new PublicKey(buffer.mintAuthority),
        supply: u64.fromBuffer(buffer.supply),
        decimals: buffer.decimals,
        isInitialized: buffer.isInitialized !== 0,
        freezeAuthority:
          buffer.freezeAuthority === 0 ? null : new PublicKey(buffer.freezeAuthority),
      };

      return mintInfo;
    } catch (e) {
      console.error(`error while parsing MintInfo: ${e}`);
      return null;
    }
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
