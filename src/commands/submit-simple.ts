import { Assets, RouteRequest } from "@anastasia-labs/smart-handles-offchain";
import { handleRouteRequest, handleRouterConfigPromise } from "../utils.js";
import { RouterConfig } from "../types/index.js";

export async function submitSimple({
  routerConfig: routerConfigPromise,
  lovelace,
  asset: nonAdaAssets,
}: {
  routerConfig?: Promise<RouterConfig>;
  lovelace: bigint;
  asset: Assets;
}) {
  const routerConfig = await handleRouterConfigPromise(routerConfigPromise);
  const assets = { ...nonAdaAssets, lovelace: lovelace };
  const simpleRouteRequest: RouteRequest = {
    kind: "simple",
    data: { valueToLock: assets },
  };
  await handleRouteRequest(routerConfig, simpleRouteRequest);
}
