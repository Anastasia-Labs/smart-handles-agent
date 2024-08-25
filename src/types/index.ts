import {
  Address,
  AdvancedReclaimConfig,
  AdvancedRouteConfig,
  CBORHex,
  Data,
  Network,
  SimpleRouteConfig,
} from "@anastasia-labs/smart-handles-offchain";

export type Target = "Single" | "Batch";

export interface RouterConfig {
  network?: Network;
  pollingInterval?: number;
  scriptCBOR: CBORHex;
  scriptTarget: Target;
  routeDestination: Address;
  advancedReclaimConfig?: AdvancedReclaimConfig;
  simpleRouteConfig?: SimpleRouteConfig;
  advancedRouteConfig?: AdvancedRouteConfig;
  extraInfoBuilderForAdvancedRequest?: () => Data;
}
