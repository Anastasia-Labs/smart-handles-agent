import { Assets, CliConfig as Config, RouteRequest } from "@anastasia-labs/smart-handles-offchain";
import {
  handleRouteRequest,
  handleConfigPromise,
  logAbort,
} from "../utils.js";

export async function submitAdvanced({
  config: configPromise,
  lovelace,
  asset: nonAdaAssets,
  markOwner,
  routerFee,
  reclaimRouterFee,
}: {
  config?: Promise<Config>;
  lovelace: bigint;
  asset: Assets;
  markOwner?: true;
  routerFee: bigint;
  reclaimRouterFee: bigint;
}) {
  const config = await handleConfigPromise(configPromise);
  if (config.extraInfoBuilderForAdvancedRequest) {
    const assets = { ...nonAdaAssets, lovelace: lovelace };
    const advancedRouteRequest: RouteRequest = {
      kind: "advanced",
      data: {
        valueToLock: assets,
        markWalletAsOwner: markOwner ?? false,
        routerFee,
        reclaimRouterFee,
        extraInfoDataBuilder: config.extraInfoBuilderForAdvancedRequest,
      },
    };
    await handleRouteRequest(config, advancedRouteRequest);
  } else {
    logAbort("No `extraInfo` CBOR was provided in the config file.");
    process.exit(1);
  }
}
