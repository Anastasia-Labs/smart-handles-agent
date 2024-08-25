import { Assets, RouteRequest } from "@anastasia-labs/smart-handles-offchain";
import {
  handleRouteRequest,
  handleRouterConfigPromise,
  logAbort,
} from "../utils.js";
import { RouterConfig } from "../types/index.js";

export async function submitAdvanced({
  routerConfig: routerConfigPromise,
  lovelace,
  asset: nonAdaAssets,
  markOwner,
  routerFee,
  reclaimRouterFee,
}: {
  routerConfig?: Promise<RouterConfig>;
  lovelace: bigint;
  asset: Assets;
  markOwner?: true;
  routerFee: bigint;
  reclaimRouterFee: bigint;
}) {
  const routerConfig = await handleRouterConfigPromise(routerConfigPromise);
  if (routerConfig.extraInfoBuilderForAdvancedRequest) {
    const assets = { ...nonAdaAssets, lovelace: lovelace };
    const advancedRouteRequest: RouteRequest = {
      kind: "advanced",
      data: {
        valueToLock: assets,
        markWalletAsOwner: markOwner ?? false,
        routerFee,
        reclaimRouterFee,
        extraInfoDataBuilder: routerConfig.extraInfoBuilderForAdvancedRequest,
      },
    };
    await handleRouteRequest(routerConfig, advancedRouteRequest);
  } else {
    logAbort("No `extraInfo` CBOR was provided in the config file.");
    process.exit(1);
  }
}
