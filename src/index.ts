#!/bin/env node

// --- IMPORTS -----------------------------------------------------------------
// {{{
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
  LucidEvolution,
  Result,
  singleRequest,
  RouteRequest,
  batchRequest,
  TxSignBuilder,
} from "@anastasia-labs/smart-handles-offchain";
import {
  chalk,
  matchTarget,
  logAbort,
  logNoneFound,
  logWarning,
  showOutRef,
  showShortOutRef,
  isHexString,
  Target,
  logSuccess,
} from "./utils.js";
import { RouterConfig } from "./router.config.js";
import * as path from "path";
// }}}
// -----------------------------------------------------------------------------

// --- HELPERS & CONSTANTS -----------------------------------------------------
// {{{
const DEFAULT_ROUTER_CONFIG_NAME = "router.config.ts";
const DEFAULT_CONFIG_PATH = path.resolve(
  process.cwd(),
  DEFAULT_ROUTER_CONFIG_NAME
);

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

const ROUTER_CONFIG_OPTION_DESCRIPTION = "Path to router config file";
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

const LOVELACE_OPTION_DESCRIPTION =
  "Lovelace count to be sent. Must contain enough to cover router fee.";
function handleLovelaceOption(q: string): bigint {
  // {{{
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
  // }}}
}

const ASSET_OPTION_DESCRIPTION =
  `Additional assets to be locked. \`unit\` is the concatenation of policy ID, and
token name in hex format.`;
function handleAssetOption(unitAndQty: string, prev: Assets): Assets {
  // {{{
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
  // }}}
}

function handleFeeOption(q: string): bigint {
  // {{{
  try {
    const n = parseInt(q, 10);
    return BigInt(n);
  } catch (e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
  // }}}
}

async function handleRouteRequest(assets: Assets, routerConfig: RouterConfig, req: RouteRequest) {
  // {{{
  const network: Network = routerConfig.network ?? "Mainnet";
  const lucid = await setupLucid(network);
  const target: Target = routerConfig.scriptTarget;
  const txRes =
    target === "Single"
      ? await singleRequest(lucid, {
          scriptCBOR: routerConfig.scriptCBOR,
          routeRequest: req,
          additionalRequiredLovelaces: BigInt(0),
        })
      : await batchRequest(lucid, {
          stakingScriptCBOR: routerConfig.scriptCBOR,
          routeRequests: [req],
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
  // }}}
}

async function handleRouteTxRes(
  txRes: Result<TxSignBuilder>,
  txLabel: string,
  renderedUTxOs: string
) {
  // {{{
  if (txRes.type === "error") {
    logWarning(`Failed to build the ${txLabel} transaction for ${renderedUTxOs}`);
  } else {
    const signedTx = await txRes.data.sign.withWallet().complete();
    const txHash = await signedTx.submit();
    logSuccess(`Route tx hash: ${txHash}`);
  }
  // }}}
}
// }}}
// -----------------------------------------------------------------------------

const program: Command = new Command();
program.version(packageJson.version).description(packageJson.description);

// === SUBMIT-SIMPLE ===========================================================
// {{{
program
  .command("submit-simple")
  .description(
    `
Submit a simple route request to later be handled by a routing agent monitoring
the script address.
${ENV_VARS_GUIDE}
`
  )
  .option(
    "--router-config <path>",
    ROUTER_CONFIG_OPTION_DESCRIPTION,
    loadRouterConfig
  )
  .requiredOption(
    "-l, --lovelace <quantity>",
    LOVELACE_OPTION_DESCRIPTION,
    handleLovelaceOption
  )
  .option(
    "-a, --asset <unit,quantity>",
    ASSET_OPTION_DESCRIPTION,
    handleAssetOption,
    {} as Assets
  )
  .action(
    async ({
      routerConfig: routerConfigPromise,
      lovelace,
      asset: nonAdaAssets,
    }) => {
      // {{{
      const routerConfig = await handleRouterConfigPromise(routerConfigPromise);
      const assets = { ...nonAdaAssets, lovelace: lovelace };
      const simpleRouteRequest: RouteRequest = {
        kind: "simple",
        data: { valueToLock: assets },
      };
      await handleRouteRequest(assets, routerConfig, simpleRouteRequest);
      // }}}
    }
  );
// }}}
// =============================================================================

// === SUBMIT-ADVANCED =========================================================
// {{{
program
  .command("submit-advanced")
  .description(
    `
Submit an advanced route request to later be handled by a routing agent
monitoring the script address.
${ENV_VARS_GUIDE}
`
  )
  .option(
    "--router-config <path>",
    ROUTER_CONFIG_OPTION_DESCRIPTION,
    loadRouterConfig
  )
  .requiredOption(
    "-l, --lovelace <quantity>",
    LOVELACE_OPTION_DESCRIPTION,
    handleLovelaceOption
  )
  .option(
    "-a, --asset <unit,quantity>",
    ASSET_OPTION_DESCRIPTION,
    handleAssetOption,
    {} as Assets
  )
  .option("--mark-owner", "Mark this wallet as the owner of the UTxO")
  .requiredOption(
    "--router-fee <lovelaces>",
    "Lovelaces collectable by the routing agent for handling this request",
    handleFeeOption
  )
  .requiredOption(
    "--reclaim-router-fee <lovelaces>",
`Lovelaces collectable by the routing agent for canceling this request and
sending it back to its owner. Note that if no owner is specified, the request
won't be reclaimable.`,
    handleFeeOption
  )
  .action(
    async ({
      routerConfig: routerConfigPromise,
      lovelace,
      asset: nonAdaAssets,
      markOwner,
      routerFee,
      reclaimRouterFee,
    }) => {
      // {{{
      const routerConfig = await handleRouterConfigPromise(routerConfigPromise);
      if (routerConfig.extraInfoForAdvancedRequest) {
        const assets = { ...nonAdaAssets, lovelace: lovelace };
        const advancedRouteRequest: RouteRequest = {
          kind: "advanced",
          data: {
            valueToLock: assets,
            markWalletAsOwner: markOwner ?? false,
            routerFee,
            reclaimRouterFee,
            extraInfo: routerConfig.extraInfoForAdvancedRequest,
          },
        };
        await handleRouteRequest(assets, routerConfig, advancedRouteRequest);
      } else {
        logAbort("No `extraInfo` CBOR was provided in the config file.");
        process.exit(1);
      }
      // }}}
    }
  );
// }}}
// =============================================================================

// === MONITOR =================================================================
// {{{
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
    ROUTER_CONFIG_OPTION_DESCRIPTION,
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
                        await handleRouteTxRes(txRes, "single route", showOutRef({ ...u }));
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
                  await handleRouteTxRes(txRes, "batch route", outRefsRendered.join(", "));
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
// }}}
// =============================================================================

program.parse();
