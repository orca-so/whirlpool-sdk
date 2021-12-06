import { utils } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

export class PDA {
  public readonly publicKey: PublicKey;
  public readonly bump: number;

  private constructor(publicKey: PublicKey, bump: number) {
    this.publicKey = publicKey;
    this.bump = bump;
  }

  public static derive(programId: PublicKey, seeds: (string | PublicKey)[]) {
    const seedsAsBuffers = seeds.map(PDA.toBuffer);
    const [publicKey, bump] = utils.publicKey.findProgramAddressSync(seedsAsBuffers, programId);
    return new PDA(publicKey, bump);
  }

  public static isPDA(maybePDA: any): maybePDA is PDA {
    return PDA.isPubkey((maybePDA as PDA).publicKey) && typeof (maybePDA as PDA).bump === "number";
  }

  private static toBuffer(stringOrPubkey: string | PublicKey): Buffer {
    if (PDA.isPubkey(stringOrPubkey)) {
      return stringOrPubkey.toBuffer();
    } else if (PDA.isString(stringOrPubkey)) {
      return Buffer.from(stringOrPubkey);
    }

    throw new Error(`seed ${stringOrPubkey} is neither a string nor a pubkey`);
  }

  private static isString(maybeString: string | PublicKey): maybeString is string {
    return typeof maybeString === "string";
  }

  private static isPubkey(maybePubkey: string | PublicKey): maybePubkey is PublicKey {
    return !!(maybePubkey as PublicKey).toBase58;
  }
}
