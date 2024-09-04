import {
  Address,
  AddressDetails,
  AdvancedReclaimConfig,
  AdvancedRouteConfig,
  AdvancedRouteRequest,
  Assets,
  CBORHex,
  Network,
  Result,
  SimpleRouteConfig,
} from "@anastasia-labs/smart-handles-offchain";

export type Target = "Single" | "Batch";

export type RequestInfo = {
  lovelace: bigint;
  asset: Assets;
  owner?: AddressDetails;
  routerFee: bigint;
  reclaimRouterFee: bigint;
  extraConfig?: { [key: string]: any };
};

export interface Config {
  label?: string;
  network?: Network;
  pollingInterval?: number;
  scriptCBOR: CBORHex;
  scriptTarget: Target;
  routeDestination: Address;
  advancedReclaimConfig?: AdvancedReclaimConfig;
  simpleRouteConfig?: SimpleRouteConfig;
  advancedRouteConfig?: AdvancedRouteConfig;
  advancedRouteRequestMaker?: (
    requestInfo: RequestInfo
  ) => Promise<Result<AdvancedRouteRequest>>;
}
