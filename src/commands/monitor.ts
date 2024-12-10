import {
  BatchReclaimConfig,
  BatchRouteConfig,
  Network,
  Result,
  SingleReclaimConfig,
  SingleRouteConfig,
  TxSignBuilder,
  UTxO,
  batchReclaim,
  batchRoute,
  errorToString,
  fetchBatchRequestUTxOs,
  fetchSingleRequestUTxOs,
  getBatchVAs,
  getSingleValidatorVA,
  singleReclaim,
  singleRoute,
} from "@anastasia-labs/smart-handles-offchain";
import { Config } from "../types.js";
import {
  chalk,
  handleTxRes,
  logAbort,
  logDim,
  logNoneFound,
  logWarning,
  matchTarget,
  setupLucid,
  showOutRef,
  showShortOutRef,
} from "../utils.js";
import { getRoutedUTxOs } from "../global.js";
import {
  BUILDING_TX_MSG,
  MISSING_ADVANCED_RECLAIM_CONFIG_ERROR,
} from "../constants.js";

async function setIntervalAsync(
  callback: () => Promise<void>,
  interval: number
): Promise<() => void> {
  let isRunning = true;

  const run = async () => {
    while (isRunning) {
      await callback();
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  };

  run();

  return () => {
    isRunning = false;
  };
}

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

const renderUTxOs = (utxos: UTxO[]): string => {
  if (utxos.length < 1) {
    return "";
  } else if (utxos.length === 1) {
    return showOutRef({ ...utxos[0] });
  } else {
    const outRefsRendered: string[] = utxos.map((u) =>
      showShortOutRef({ ...u })
    );
    return outRefsRendered.join(", ");
  }
};

export function monitor(config: Config & { reclaim?: true }) {
  return async () => {
    const network: Network = config.network ?? "Mainnet";
    const pollingInterval = config.pollingInterval ?? 10_000;
    // ------- CONFIG REPORT ---------------------------------------------------
    console.log("");
    console.log(
      chalk.bold(
        `Monitoring ${config.label} smart handles script for ${chalk.blue(
          `${config.scriptTarget}`.toUpperCase()
        )} requests on ${chalk.blue(`${config.network}`.toUpperCase())}${
          config.reclaim ? ` to ${chalk.blue("RECLAIM")}` : ""
        }`
      )
    );
    console.log(chalk.dim(`Polling every ${pollingInterval}ms`));
    console.log("");

    try {
      // ------- POLLING -------------------------------------------------------
      const lucid = await setupLucid(network, config.provider);
      const monitorAddress =
        config.scriptTarget === "Single"
          ? getSingleValidatorVA(config.scriptCBOR, network).address
          : getBatchVAs(config.scriptCBOR, network).spendVA.address;
      console.log("Querying:");
      console.log(chalk.whiteBright(monitorAddress));
      console.log("");
      setIntervalAsync(async () => {
        matchTarget(
          config.scriptTarget,
          async () => {
            // {{{
            try {
              const initSingleUTxOs = await fetchSingleRequestUTxOs(
                lucid,
                network,
                config.scriptCBOR
              );
              const singleUTxOs = filterAlreadyRoutedUTxOs(initSingleUTxOs);
              if (singleUTxOs.length > 0) {
                logDim(`Found ${singleUTxOs.length} UTxO(s):
${renderUTxOs(singleUTxOs)}`);
                try {
                  await Promise.all(
                    singleUTxOs.map(async (u: UTxO) => {
                      const handleTxHelper = (
                        txRes: Result<TxSignBuilder>,
                        label: string
                      ) =>
                        handleTxRes(
                          lucid,
                          [u],
                          txRes,
                          label,
                          showShortOutRef({ ...u }),
                          config.quiet
                        );
                      if (config.reclaim) {
                        if (config.advancedReclaimConfig) {
                          const reclaimConfig: SingleReclaimConfig = {
                            ...config,
                            network,
                            scriptCBOR: config.scriptCBOR,
                            requestOutRef: { ...u },
                          };
                          try {
                            logDim(BUILDING_TX_MSG);
                            const txRes = await singleReclaim(
                              lucid,
                              reclaimConfig
                            );
                            await handleTxHelper(txRes, "single reclaim");
                          } catch (e) {
                            logWarning(errorToString(e), config.quiet);
                          }
                        } else {
                          logAbort(MISSING_ADVANCED_RECLAIM_CONFIG_ERROR);
                          process.exit(1);
                        }
                      } else {
                        const routeConfig: SingleRouteConfig = {
                          ...config,
                          network,
                          scriptCBOR: config.scriptCBOR,
                          requestOutRef: { ...u },
                          routeAddress: config.routeDestination,
                        };
                        try {
                          logDim(BUILDING_TX_MSG);
                          const txRes = await singleRoute(lucid, routeConfig);
                          await handleTxHelper(txRes, "single route");
                        } catch (e) {
                          logWarning(errorToString(e), config.quiet);
                        }
                      }
                    })
                  );
                } catch (e) {
                  logWarning("Couldn't process route requests", config.quiet);
                }
              } else {
                logNoneFound("single");
              }
            } catch (e) {
              logWarning(errorToString(e), config.quiet);
            }
            // }}}
          },
          async () => {
            // {{{
            try {
              const initBatchUTxOs = await fetchBatchRequestUTxOs(
                lucid,
                network,
                config.scriptCBOR
              );
              const batchUTxOs = filterAlreadyRoutedUTxOs(initBatchUTxOs);
              if (batchUTxOs.length > 0) {
                const renderedOutRefs = renderUTxOs(batchUTxOs);
                logDim(`Found ${batchUTxOs.length} UTxO(s):
${renderedOutRefs}`);
                logDim(BUILDING_TX_MSG);
                const handleTxHelper = (
                  txRes: Result<TxSignBuilder>,
                  label: string
                ) =>
                  handleTxRes(
                    lucid,
                    batchUTxOs,
                    txRes,
                    label,
                    renderedOutRefs,
                    config.quiet
                  );
                if (config.reclaim) {
                  if (config.advancedReclaimConfig) {
                    const batchReclaimConfig: BatchReclaimConfig = {
                      ...config,
                      network,
                      stakingScriptCBOR: config.scriptCBOR,
                      requestOutRefs: { ...batchUTxOs },
                    };
                    try {
                      const txRes = await batchReclaim(
                        lucid,
                        batchReclaimConfig
                      );
                      await handleTxHelper(txRes, "batch reclaim");
                    } catch (e) {
                      logWarning(errorToString(e), config.quiet);
                    }
                  } else {
                    logAbort(MISSING_ADVANCED_RECLAIM_CONFIG_ERROR);
                    process.exit(1);
                  }
                } else {
                  const batchRouteConfig: BatchRouteConfig = {
                    ...config,
                    network,
                    stakingScriptCBOR: config.scriptCBOR,
                    requestOutRefs: { ...batchUTxOs },
                    routeAddress: config.routeDestination,
                  };
                  try {
                    const txRes = await batchRoute(lucid, batchRouteConfig);
                    await handleTxHelper(txRes, "batch route");
                  } catch (e) {
                    logWarning(errorToString(e), config.quiet);
                  }
                }
              } else {
                logNoneFound("batch");
              }
            } catch (e) {
              logWarning(errorToString(e), config.quiet);
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
