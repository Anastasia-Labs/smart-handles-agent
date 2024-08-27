import { Assets, RouteRequest } from "@anastasia-labs/smart-handles-offchain";
import { Config } from "../types.js";
import { handleRouteRequest } from "../utils.js";

export function submitSimple(config: Config) {
  return async ({
    lovelace,
    asset: nonAdaAssets,
  }: {
    config?: Promise<Config>;
    lovelace: bigint;
    asset: Assets;
  }) => {
    const assets = { ...nonAdaAssets, lovelace: lovelace };
    const simpleRouteRequest: RouteRequest = {
      kind: "simple",
      data: { valueToLock: assets },
    };
    await handleRouteRequest(config, simpleRouteRequest);
  };
}
