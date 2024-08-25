import {
  BatchRouteConfig,
  Network,
  SingleRouteConfig,
  UTxO,
  batchRoute,
  errorToString,
  fetchBatchRequestUTxOs,
  fetchSingleRequestUTxOs,
  getBatchVAs,
  getSingleValidatorVA,
  singleRoute,
} from "@anastasia-labs/smart-handles-offchain";
import { RouterConfig } from "../types/index.js";
import {
  chalk,
  handleRouteTxRes,
  handleRouterConfigPromise,
  logAbort,
  logNoneFound,
  logWarning,
  matchTarget,
  setupLucid,
  showOutRef,
  showShortOutRef,
} from "../utils.js";

export async function monitor({
  routerConfig: routerConfigPromise,
}: {
  routerConfig?: Promise<RouterConfig>;
}) {
  const routerConfig: RouterConfig = await handleRouterConfigPromise(
    routerConfigPromise
  );
  const network: Network = routerConfig.network ?? "Mainnet";
  const pollingInterval = routerConfig.pollingInterval ?? 10_000;
  // ------- CONFIG REPORT -----------------------------------------------------
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
    // ------- POLLING ---------------------------------------------------------
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
                      await handleRouteTxRes(
                        txRes,
                        "single route",
                        showOutRef({ ...u })
                      );
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
                await handleRouteTxRes(
                  txRes,
                  "batch route",
                  outRefsRendered.join(", ")
                );
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
}
