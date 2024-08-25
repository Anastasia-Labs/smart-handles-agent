import { Assets, CliConfig as Config, RouteRequest } from "@anastasia-labs/smart-handles-offchain";
import { handleRouteRequest, handleConfigPromise } from "../utils.js";

export async function submitSimple({
  config: configPromise,
  lovelace,
  asset: nonAdaAssets,
}: {
  config?: Promise<Config>;
  lovelace: bigint;
  asset: Assets;
}) {
  const config = await handleConfigPromise(configPromise);
  const assets = { ...nonAdaAssets, lovelace: lovelace };
  const simpleRouteRequest: RouteRequest = {
    kind: "simple",
    data: { valueToLock: assets },
  };
  await handleRouteRequest(config, simpleRouteRequest);
}
