import { OrcaCache } from "../cache";
import { OrcaPositionImpl } from "./orca-position";
import { OrcaWhirpoolImpl } from "./orca-whirpool";

export class OrcaFactory {
  getWhirlpool(cache: OrcaCache, args: any) {
    return new OrcaWhirpoolImpl(cache, args);
  }

  getPosition(cache: OrcaCache, args: any) {
    return new OrcaPositionImpl(cache, args);
  }
}
