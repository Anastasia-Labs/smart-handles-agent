import {
  Assets,
  CliConfig as Config,
  errorToString,
} from "@anastasia-labs/smart-handles-offchain";
import { handleRouteRequest, handleConfigPromise, logAbort } from "../utils.js";

export async function submitAdvanced(allArgs: {
  config?: Promise<Config>;
  lovelace: bigint;
  asset: Assets;
  markOwner?: true;
  routerFee: bigint;
  reclaimRouterFee: bigint;
  extraConfig?: { [key: string]: any };
}) {
  try {
    const configPromise = allArgs.config;
    const config = await handleConfigPromise(configPromise);
    if (config.advancedRouteRequestMaker) {
      const rRRes = await config.advancedRouteRequestMaker(allArgs);
      if (rRRes.type == "error") {
        logAbort(errorToString(rRRes.error));
        process.exit(1);
      }
      await handleRouteRequest(config, {kind: "advanced", data: rRRes.data});
    } else {
      logAbort("No `extraInfo` CBOR was provided in the config file.");
      process.exit(1);
    }
  } catch(e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
}
