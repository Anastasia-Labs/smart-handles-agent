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
import { Config } from "../types.js";
import {
  chalk,
  handleRouteTxRes,
  logAbort,
  logNoneFound,
  logWarning,
  matchTarget,
  setupLucid,
  showOutRef,
  showShortOutRef,
} from "../utils.js";
import { getRoutedUTxOs } from "../global.js";

const filterAlreadyRoutedUTxOs = (initUTxOs: UTxO[]): UTxO[] => {
  const cache = getRoutedUTxOs();
  const filtered = initUTxOs.filter(
    (u) =>
      !cache.some(
        (routed) =>
          routed.txHash === u.txHash && routed.outputIndex === u.outputIndex
      )
  );
  return filtered;
};

export function monitor(config: Config) {
  return async () => {
    const network: Network = config.network ?? "Mainnet";
    const pollingInterval = config.pollingInterval ?? 10_000;
    // ------- CONFIG REPORT -----------------------------------------------------
    console.log("");
    console.log(
      chalk.bold(
        `Monitoring ${config.label} smart handles script for ${chalk.blue(
          `${config.scriptTarget}`.toUpperCase()
        )} requests on ${chalk.blue(`${config.network}`.toUpperCase())}`
      )
    );
    console.log(chalk.dim(`Polling every ${pollingInterval}ms`));
    console.log("");

    try {
      // ------- POLLING ---------------------------------------------------------
      const lucid = await setupLucid(network);
      const monitorAddress =
        config.scriptTarget === "Single"
          ? getSingleValidatorVA(config.scriptCBOR, network).address
          : getBatchVAs(config.scriptCBOR, network).spendVA.address;
      console.log("Querying:");
      console.log(chalk.whiteBright(monitorAddress));
      console.log("");
      setInterval(async () => {
        matchTarget(
          config.scriptTarget,
          async () => {
            // {{{
            try {
              const initSingleUTxOs = await fetchSingleRequestUTxOs(
                lucid,
                config.scriptCBOR,
                network
              );
              const singleUTxOs = filterAlreadyRoutedUTxOs(initSingleUTxOs);
              if (singleUTxOs.length > 0) {
                try {
                  await Promise.all(
                    singleUTxOs.map(async (u: UTxO) => {
                      const routeConfig: SingleRouteConfig = {
                        ...config,
                        scriptCBOR: config.scriptCBOR,
                        requestOutRef: { ...u },
                        routeAddress: config.routeDestination,
                      };
                      try {
                        const txRes = await singleRoute(lucid, routeConfig);
                        await handleRouteTxRes(
                          [u],
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
              logWarning(errorToString(e));
            }
            // }}}
          },
          async () => {
            // {{{
            try {
              const initBatchUTxOs = await fetchBatchRequestUTxOs(
                lucid,
                config.scriptCBOR,
                network
              );
              const batchUTxOs = filterAlreadyRoutedUTxOs(initBatchUTxOs);
              if (batchUTxOs.length > 0) {
                const batchRouteConfig: BatchRouteConfig = {
                  stakingScriptCBOR: config.scriptCBOR,
                  requestOutRefs: { ...batchUTxOs },
                  routeAddress: config.routeDestination,
                  simpleRouteConfig: config.simpleRouteConfig,
                  advancedRouteConfig: config.advancedRouteConfig,
                };
                try {
                  const txRes = await batchRoute(lucid, batchRouteConfig);
                  const outRefsRendered: string[] = batchUTxOs.map((u) =>
                    showShortOutRef({ ...u })
                  );
                  await handleRouteTxRes(
                    batchUTxOs,
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
              logWarning(errorToString(e));
            }
            // }}}
          }
        );
      }, pollingInterval);
    } catch (e) {
      logAbort(errorToString(e));
      process.exit(1);
    }
  };
}
