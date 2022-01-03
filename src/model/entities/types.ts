import { Coder } from "@project-serum/anchor";

export interface ParsableEntity<T> {
  /**
   * Parse account data
   *
   * @param coder
   * @param accountData
   * @returns
   */
  parse: (coder: Coder, accountData: Buffer | undefined | null) => T | null;
}

/**
 * Class decorator to define an interface with static methods
 * Reference: https://github.com/Microsoft/TypeScript/issues/13462#issuecomment-295685298
 */
export function staticImplements<T>() {
  return <U extends T>(constructor: U) => {
    constructor;
  };
}
