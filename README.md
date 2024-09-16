# Talbe of Contents

<!-- vim-markdown-toc GFM -->

* [CLI Application Generator for Smart Handles](#cli-application-generator-for-smart-handles)
    * [Sample Run of Minswap V1 Instance](#sample-run-of-minswap-v1-instance)
    * [Interface](#interface)
    * [How to Use](#how-to-use)
        * [1. Install this package along with `smart-handles-offchain`:](#1-install-this-package-along-with-smart-handles-offchain)
        * [2. Configure your `package.json` and `tsconfig.js`](#2-configure-your-packagejson-and-tsconfigjs)
        * [3. Define your `Config`](#3-define-your-config)
        * [4. Implement your executable source](#4-implement-your-executable-source)
        * [5. Build your application](#5-build-your-application)
        * [6. Run your CLI](#6-run-your-cli)

<!-- vim-markdown-toc -->

# CLI Application Generator for Smart Handles

Given a `Config` value, this package's `main` generates a CLI interface for
interacting with your instance of [`smart-handles`](https://github.com/Anastasia-Labs/smart-handles).
```ts
export interface Config {
  label?: string;
  quiet?: true;
  network?: Network;
  pollingInterval?: number;
  scriptCBOR: CBORHex;
  scriptTarget: "Single" | "Batch";
  routeDestination: Address;
  advancedReclaimConfig?: AdvancedReclaimConfig;
  simpleRouteConfig?: SimpleRouteConfig;
  advancedRouteConfig?: AdvancedRouteConfig;
  advancedRouteRequestMaker?: (
    requestInfo: RequestInfo
  ) => Promise<Result<AdvancedRouteRequest>>;
}
```


## Sample Run of [Minswap V1 Instance](https://github.com/Anastasia-Labs/smart-handles-offchain/tree/main/example)

![demo.gif](/assets/images/demo.gif)


## Interface

The generated CLI application offers 3 endpoints:
- `monitor` for querying the instance's address and performing routes to collect
  their fees
- `submit-simple` for submitting a simple route request (i.e. attaching a datum
  that only carries owner's address)
- `submit-advanced` for submitting an advanced route request. This
  requires `advancedRouteRequestMaker` to be defined in the given `Config`


## How to Use

### 1. Install this package along with [`smart-handles-offchain`](https://github.com/Anastasia-Labs/smart-handles-offchain):
```sh
pnpm install                             \
  @anastasia-labs/smart-handles-offchain \
  @anastasia-labs/smart-handles-agent    \
  @commander-js/extra-typings # optional
```

### 2. Configure your `package.json` and `tsconfig.js`

[Minswap V1 instance](https://github.com/Anastasia-Labs/smart-handles-offchain/tree/main/example)
is a good reference in case you faced some issues.

### 3. Define your `Config`

- `label`: An optional name for your instance of Smart Handles
- `quiet`: Optional flag to suppress warning logs
- `network`: This can be one of `"Mainnet"`, `"Preprod"`, `"Preview"`,
  or `"Custom"` (defaults to `"Mainnet"`)
- `pollingInterval`: Length of time in milliseconds between each query of
  instance's address for the `monitor` endpoint
- `scriptCBOR`: Hex formatted CBOR of the fully applied Smart Handles instance
- `scriptTarget`: Whether the provided `scriptCBOR` is a spend script that can
  only allow single routes per transaction, or it's a staking script capable of
  supporting a batch of routes in one transaction
- `routeDestination`: The address where routes should go to, this is a parameter
  that should already be applied to your instance
- `advancedReclaimConfig`: If your instance supports advanced reclaims, you
  should provide its config (read more at [`smart-handles-offchain`](https://github.com/Anastasia-Labs/smart-handles-offchain))
- `simpleRouteConfig`: This config is what Smart Handles is primarily intended
  for, e.g. an ADA-to-MIN via Minswap instance would expect simple datums with
  owners' addresses, and this config would provide the application with proper
  logic for producing the correct UTxO at Minswap's address (this only applies
  to instances that do support simple routes)
- `advancedRouteConfig`: Similar to other two configs, depending on your
  instance, you might be required to provide this config
- `advancedRouteRequestMaker`: The `submit-advanced` endpoint requires a few
  values to be provided:
    - `--lovelace` is the Lovelace count you intend to lock with your request
    - `--asset` is any additional assets you want locked (can be specified
      multiple times)
    - `--owner` optional address to be specified as the owner
    - `--router-fee` Lovelace count a router agent collects for carrying out the
      routing
    - `--reclaim-router-fee` is a sperate fee for router agents in case they
      invoke the advanced reclaim endpoint (instead of routing)
    - `--extra-config` path to a `.json` file carrying any additional values
      your instance might need

  These are all collected as a `RequestInfo` and passed to
  your `advancedRouteRequestMaker`:
```ts
export type RequestInfo = {
  lovelace: bigint;
  asset: Assets;
  owner?: AddressDetails;
  routerFee: bigint;
  reclaimRouterFee: bigint;
  extraConfig?: { [key: string]: any };
};
```

### 4. Implement your executable source

This is mostly boilerplate, but can be customized:
```ts
#!/usr/bin/env node

import { main, Config, RequestInfo } from "@anastasia-labs/smart-handles-agent";
import { Command } from "@commander-js/extra-typings";
import config from "./config.js";

const program: Command = main(config);

await program
  .parseAsync(process.argv)
  .catch(console.log);
```

### 5. Build your application

We recommend `tsup`:
```sh
tsup src/index.ts --minify --format esm
```
Note that `src/index.ts` is the path to the executable source you implemented in
previous step.

### 6. Run your CLI

Use the `-h` or `--help` flag to learn more about each of the 3 endpoints
(`monitor`, `submit-simple`, and `submit-advanced`).

```sh
node dist/index.js --help

# or e.g.

node dist/index.js monitor --help
```
