import {
  BatchRouteConfig,
  CliConfig as Config,
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
import {
  chalk,
  handleRouteTxRes,
  handleConfigPromise,
  logAbort,
  logNoneFound,
  logWarning,
  matchTarget,
  setupLucid,
  showOutRef,
  showShortOutRef,
} from "../utils.js";

export async function monitor({
  config: configPromise,
}: {
  config?: Promise<Config>;
}) {
  const config: Config = await handleConfigPromise(
    configPromise
  );
  const network: Network = config.network ?? "Mainnet";
  const pollingInterval = config.pollingInterval ?? 10_000;
  // ------- CONFIG REPORT -----------------------------------------------------
  console.log("");
  console.log(
    chalk.bold(
      `Monitoring Minswap V1 smart handles script for ${chalk.blue(
        `${config.scriptTarget}`.toUpperCase()
      )} requests on ${chalk.blue(`${config.network}`.toUpperCase())}`
    )
  );
  console.log(chalk.dim(`Polling every ${pollingInterval}ms`));
  console.log("");

  const lucid = await setupLucid(network);

  try {
    // ------- POLLING ---------------------------------------------------------
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
            const singleUTxOs = await fetchSingleRequestUTxOs(
              lucid,
              config.scriptCBOR,
              network
            );
            if (singleUTxOs.length > 0) {
              try {
                await Promise.all(
                  singleUTxOs.map(async (u: UTxO) => {
                    const routeConfig: SingleRouteConfig = {
                      scriptCBOR: config.scriptCBOR,
                      requestOutRef: { ...u },
                      routeAddress: config.routeDestination,
                      simpleRouteConfig: config.simpleRouteConfig,
                      advancedRouteConfig: config.advancedReclaimConfig,
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
            logWarning(errorToString(e));
          }
          // }}}
        },
        async () => {
          // {{{
          try {
            const batchUTxOs = await fetchBatchRequestUTxOs(
              lucid,
              config.scriptCBOR,
              network
            );
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
}
