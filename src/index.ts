#!/bin/env node

import * as packageJson from "../package.json";
import { Command } from "@commander-js/extra-typings";
import {
  ROUTER_FEE,
  Blockfrost,
  Lucid,
  Network,
  SingleRouteConfig,
  errorToString,
  fetchBatchRequestUTxOs,
  fetchSingleRequestUTxOs,
  getBatchVAs,
  getSingleValidatorVA,
  UTxO,
  singleRoute,
  BatchRouteConfig,
  batchRoute,
  Assets,
  SimpleRouteRequest,
  LucidEvolution,
  Result,
  singleRequest,
  RouteRequest,
  batchRequest,
  // } from "@anastasia-labs/smart-handles-offchain";
} from "../../smart-handles-offchain/src/index";
import {
  chalk,
  matchTarget,
  logAbort,
  logNoneFound,
  logWarning,
  showOutRef,
  handleTxRes,
  showShortOutRef,
  isHexString,
  Target,
  logSuccess,
} from "./utils";
import { RouterConfig } from "../router.config";
import * as path from "path";

const program: Command = new Command();

program.version(packageJson.version).description(packageJson.description);

const DEFAULT_ROUTER_CONFIG_NAME = "router.config.ts";
const DEFAULT_CONFIG_PATH = path.resolve(
  process.cwd(),
  DEFAULT_ROUTER_CONFIG_NAME
);

async function loadRouterConfig(specifiedPath?: string): Promise<RouterConfig> {
  // {{{
  const fullPath = specifiedPath
    ? path.resolve(specifiedPath)
    : DEFAULT_CONFIG_PATH;
  const extension = path.extname(fullPath);

  if (extension === ".ts") {
    // Only TypeScript is expected.
    try {
      const tsNode = await import("ts-node");
      tsNode.register({
        transpileOnly: true,
        compilerOptions: {
          module: "commonjs",
        },
      });

      const config = await import(fullPath);
      return config.default || config;
    } catch (error) {
      logAbort(`Error loading TypeScript config: ${errorToString}`);
      process.exit(1);
    }
  } else {
    logAbort("Please provide a TypeScript file for config");
    process.exit(1);
  }
  // }}}
}

async function setupLucid(network: Network): Promise<LucidEvolution> {
  // {{{
  const blockfrostKey = process.env.BLOCKFROST_KEY;
  const seedPhrase = process.env.SEED_PHRASE;
  if (!blockfrostKey) {
    logAbort("No Blockfrost API key was found (BLOCKFROST_KEY)");
    process.exit(1);
  }
  if (!seedPhrase) {
    logAbort("No wallet seed phrase found (SEED_PHRASE)");
    process.exit(1);
  }
  try {
    const lucid = await Lucid(
      new Blockfrost(
        `https://cardano-${`${network}`.toLowerCase()}.blockfrost.io/api/v0`,
        blockfrostKey
      ),
      network
    );
    lucid.selectWallet.fromSeed(seedPhrase);
    return lucid;
  } catch (e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
  // }}}
}

async function handleRouterConfigPromise(
  rcp: Promise<RouterConfig> | undefined
): Promise<RouterConfig> {
  // {{{
  let routerConfig: RouterConfig;
  try {
    if (rcp) {
      routerConfig = await rcp;
    } else {
      logAbort("Failed to fetch the config");
      process.exit(1);
    }
  } catch (e) {
    logAbort("Failed to fetch the config");
    process.exit(1);
  }
  return routerConfig;
  // }}}
}

const ENV_VARS_GUIDE = `
Make sure you first have set these 2 environment variables:

\u0009${chalk.bold("BLOCKFROST_KEY")}\u0009 Your Blockfrost API key
\u0009${chalk.bold("SEED_PHRASE")}   \u0009 Your wallet's seed phrase
`;

function addScriptOption(cmd: Command) {
  return cmd.option(
    "--router-config <path>",
    "Path to router config file",
    loadRouterConfig
  );
}

program
  .command("submit-simple")
  .alias("s")
  .description(
    `
Submit a simple route request to later be handled by a routing agent monitoring
the script address.
${ENV_VARS_GUIDE}
`
  )
  .option(
    "--router-config <path>",
    "Path to router config file",
    loadRouterConfig
  )
  .requiredOption(
    "-l, --lovelace <quantity>",
    "Lovelace count to be sent. Must contain enough to cover router fee.",
    (q: string): bigint => {
      try {
        const n = parseInt(q, 10);
        if (n >= ROUTER_FEE) {
          return BigInt(n);
        } else {
          logAbort("Insufficient Lovelaces.");
          process.exit(1);
        }
      } catch (e) {
        logAbort(errorToString(e));
        process.exit(1);
      }
    }
  )
  .option(
    "-a, --asset <unit,quantity>",
    `Additional assets to be locked. \`unit\` is the concatenation of policy ID, and
token name in hex format.`,
    (unitAndQty, prev): Assets => {
      try {
        const [initUnit, qtyStr] = unitAndQty.split(",");
        const unit = initUnit.toLowerCase();
        const qty = parseInt(qtyStr, 10);
        if (isHexString(unit) && unit.length >= 56) {
          prev[unit] = (prev[unit] ?? BigInt(0)) + BigInt(qty);
          return prev;
        } else {
          logAbort("Invalid unit provided.");
          process.exit(1);
        }
      } catch (e) {
        logAbort(errorToString(e));
        process.exit(1);
      }
    },
    {} as Assets
  )
  .action(
    async ({
      routerConfig: routerConfigPromise,
      lovelace,
      asset: nonAdaAssets,
    }) => {
      const routerConfig = await handleRouterConfigPromise(routerConfigPromise);
      const network: Network = routerConfig.network ?? "Mainnet";
      const target: Target = routerConfig.scriptTarget;
      const assets = { ...nonAdaAssets, lovelace: lovelace };
      const simpleRouteRequest: RouteRequest = {
        kind: "simple",
        data: { valueToLock: assets },
      };
      const lucid = await setupLucid(network);
      const txRes =
        target === "Single"
          ? await singleRequest(lucid, {
              scriptCBOR: routerConfig.scriptCBOR,
              routeRequest: simpleRouteRequest,
              additionalRequiredLovelaces: BigInt(0),
            })
          : await batchRequest(lucid, {
              stakingScriptCBOR: routerConfig.scriptCBOR,
              routeRequests: [simpleRouteRequest],
              additionalRequiredLovelaces: BigInt(0),
            });
      if (txRes.type === "error") {
        logAbort(errorToString(txRes.error));
        process.exit(1);
      } else {
        try {
          const signedTx = await txRes.data.sign.withWallet().complete();
          const txHash = await signedTx.submit();
          logSuccess(`Request tx hash: ${txHash}`);
          process.exit(0);
        } catch(e) {
          logAbort(errorToString(e));
          process.exit(1);
        }
      }
    }
  );

program
  .command("monitor")
  .alias("m")
  .description(
    `
Start monitoring the provided smart handles instance, and perform the routing to
collect their fees.
${ENV_VARS_GUIDE}`
  )
  .option(
    "--router-config <path>",
    "Path to router config file",
    loadRouterConfig
  )
  .option(
    "--router-config <path>",
    "Path to router config file",
    loadRouterConfig
  )
  .action(async ({ routerConfig: routerConfigPromise }) => {
    const routerConfig: RouterConfig = await handleRouterConfigPromise(
      routerConfigPromise
    );
    const network: Network = routerConfig.network ?? "Mainnet";
    const pollingInterval = routerConfig.pollingInterval ?? 10_000;
    // ------- CONFIG REPORT ---------------------------------------------------
    console.log("");
    console.log(
      chalk.bold(
        `Monitoring Minswap V1 smart handles script for ${chalk.blue(
          `${routerConfig.scriptTarget}`.toUpperCase()
        )} requests on ${chalk.blue(`${routerConfig.network}`.toUpperCase())}`
      )
    );
    console.log(chalk.dim(`Polling every ${pollingInterval}ms`));
    console.log("");

    const lucid = await setupLucid(network);

    try {
      // ------- POLLING -------------------------------------------------------
      const monitorAddress =
        routerConfig.scriptTarget === "Single"
          ? getSingleValidatorVA(routerConfig.scriptCBOR, network).address
          : getBatchVAs(routerConfig.scriptCBOR, network).spendVA.address;
      console.log("Querying:");
      console.log(chalk.whiteBright(monitorAddress));
      console.log("");
      setInterval(async () => {
        matchTarget(
          routerConfig.scriptTarget,
          async () => {
            // {{{
            try {
              const singleUTxOs = await fetchSingleRequestUTxOs(
                lucid,
                routerConfig.scriptCBOR,
                network
              );
              if (singleUTxOs.length > 0) {
                try {
                  await Promise.all(
                    singleUTxOs.map(async (u: UTxO) => {
                      const routeConfig: SingleRouteConfig = {
                        scriptCBOR: routerConfig.scriptCBOR,
                        requestOutRef: { ...u },
                        routeAddress: routerConfig.routeDestination,
                        simpleRouteConfig: routerConfig.simpleRouteConfig,
                        advancedRouteConfig: routerConfig.advancedReclaimConfig,
                      };
                      try {
                        const txRes = await singleRoute(lucid, routeConfig);
                        await handleTxRes(txRes, "single route", showOutRef({ ...u }));
                      } catch (e) {
                        logWarning(errorToString(e));
                      }
                    })
                  );
                } catch (e) {
                  logWarning("Couldn't process route requests");
                }
              } else {
                logNoneFound("single");
              }
            } catch (e) {
              logWarning(e.toString());
            }
            // }}}
          },
          async () => {
            // {{{
            try {
              const batchUTxOs = await fetchBatchRequestUTxOs(
                lucid,
                routerConfig.scriptCBOR,
                network
              );
              if (batchUTxOs.length > 0) {
                const batchRouteConfig: BatchRouteConfig = {
                  stakingScriptCBOR: routerConfig.scriptCBOR,
                  requestOutRefs: { ...batchUTxOs },
                  routeAddress: routerConfig.routeDestination,
                  simpleRouteConfig: routerConfig.simpleRouteConfig,
                  advancedRouteConfig: routerConfig.advancedRouteConfig,
                };
                try {
                  const txRes = await batchRoute(lucid, batchRouteConfig);
                  const outRefsRendered: string[] = batchUTxOs.map((u) =>
                    showShortOutRef({ ...u })
                  );
                  await handleTxRes(txRes, "batch route", outRefsRendered.join(", "));
                } catch (e) {
                  logWarning(errorToString(e));
                }
              } else {
                logNoneFound("batch");
              }
            } catch (e) {
              logWarning(e.toString());
            }
            // }}}
          }
        );
      }, pollingInterval);
    } catch (e) {
      logAbort(errorToString(e));
      process.exit(1);
    }
  });

program.parse();
