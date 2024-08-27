import {
  Assets,
  errorToString,
} from "@anastasia-labs/smart-handles-offchain";
import { Config } from "../types.js";
import { handleRouteRequest, logAbort } from "../utils.js";

export function submitAdvanced(config: Config) {
  return async (allArgs: {
    lovelace: bigint;
    asset: Assets;
    markOwner?: true;
    routerFee: bigint;
    reclaimRouterFee: bigint;
    extraConfig?: { [key: string]: any };
  }) => {
    try {
      if (config.advancedRouteRequestMaker) {
        const rRRes = await config.advancedRouteRequestMaker(allArgs);
        if (rRRes.type == "error") {
          logAbort(errorToString(rRRes.error));
          process.exit(1);
        }
        await handleRouteRequest(config, {
          kind: "advanced",
          data: rRRes.data,
        });
      } else {
        logAbort("No `extraInfo` CBOR was provided in the config file.");
        process.exit(1);
      }
    } catch (e) {
      logAbort(errorToString(e));
      process.exit(1);
    }
  };
}
