import {
  Address,
  AdvancedReclaimConfig,
  AdvancedRouteConfig,
  CBORHex,
  Network,
  SimpleRouteConfig,
} from "../smart-handles-offchain/src/index";
import {Target} from "./src/utils";

export interface RouterConfig {
  network?: Network;
  pollingInterval?: number;
  scriptCBOR: CBORHex;
  scriptTarget: Target;
  routeDestination: Address;
  advancedReclaimConfig?: AdvancedReclaimConfig;
  simpleRouteConfig?: SimpleRouteConfig;
  advancedRouteConfig?: AdvancedRouteConfig;
}
