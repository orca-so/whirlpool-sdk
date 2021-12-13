export interface EntityStatic<EntityAccount> {
  /**
   *
   * @param accountData
   * @returns
   */
  parse: (accountData: Buffer | undefined | null) => EntityAccount | null;
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
