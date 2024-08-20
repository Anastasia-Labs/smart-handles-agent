#!/bin/env node

import * as packageJson from "../package.json";
import { Command } from "@commander-js/extra-typings";
import {
  Blockfrost,
  Lucid,
  fetchBatchRequestUTxOs,
  fetchSingleRequestUTxOs,
  getBatchVAs,
  getSingleValidatorVA,
} from "@anastasia-labs/smart-handles-offchain";
import { chalk, Target, matchTarget, logAbort, logNoneFound, logWarning } from "./utils";

const program: Command = new Command();

program.version(packageJson.version).description(packageJson.description);

program
  .command("monitor")
  .alias("m")
  .description(
    `
Start monitoring the Minswap V1 smart handles address, and perform the routing
to collect their fees.

Make sure you first have set these 2 environment variables:

\u0009${chalk.bold("BLOCKFROST_KEY")}\u0009 Your Blockfrost API key
\u0009${chalk.bold("SEED_PHRASE")}   \u0009 Your wallet's seed phrase
`
  )
  .option(
    "-t, --target <VARIANT>",
    "Specify smart handle variant: Single, Batch, or Both",
    (initV: string): Target => {
      const v = initV.toLowerCase();
      if (v == "single") {
        return "Single";
      } else if (v == "both") {
        return "Both";
      } else {
        return "Batch";
      }
    },
    "Batch"
  )
  .option(
    "-i, --polling-interval <MS>",
    "Specify the polling interval in milliseconds",
    (x: string, def: number): number => {
      const parsed = parseInt(x);
      if (isNaN(parsed)) {
        logWarning(`Bad polling interval, reverting to default (${def}ms)`);
        return def;
      } else {
        return parsed;
      }
    },
    10000
  )
  .option("--testnet", "Switch to preprod testnet", false)
  .action(async ({ target, pollingInterval, testnet }) => {
    // ------- CONFIG REPORT --------------------------------------------------
    console.log("");
    console.log(
      chalk.bold(
        `Monitoring Minswap V1 smart handles script for ${chalk.blue(
          target == "Single"
            ? "SINGLE"
            : target == "Both"
            ? "both SINGLE and BATCH"
            : "BATCH"
        )} requests on ${chalk.blue(testnet ? "PREPROD" : "MAINNET")}`
      )
    );
    console.log(chalk.dim(`Polling every ${pollingInterval}ms`));
    console.log("");

    // ------- SETTING UP LUCID -----------------------------------------------
    const blockfrostKey = process.env.BLOCKFROST_KEY;
    const seedPhrase = process.env.SEED_PHRASE;
    if (!blockfrostKey) {
      logAbort("No Blockfrost API key was found (BLOCKFROST_KEY)");
      return 1;
    }
    if (!seedPhrase) {
      logAbort("No wallet seed phrase found (SEED_PHRASE)");
      return 1;
    }
    try {
      const lucid = await Lucid.new(
        new Blockfrost(
          `https://cardano-${
            testnet ? "preprod" : "mainnet"
          }.blockfrost.io/api/v0`,
          blockfrostKey
        ),
        testnet ? "Preprod" : "Mainnet"
      );
      lucid.selectWalletFromSeed(seedPhrase);

      // ------- POLLING --------------------------------------------------------
      const singleVARes = getSingleValidatorVA(lucid, testnet);
      const batchVAsRes = getBatchVAs(lucid, testnet);
      const singleAddr =
        singleVARes.type === "error" ? "" : singleVARes.data.address;
      const batchAddr =
        batchVAsRes.type === "error" ? "" : batchVAsRes.data.spendVA.address;
      console.log("Querying:");
      matchTarget(
        target,
        () => console.log(chalk.whiteBright(singleAddr)),
        () => console.log(chalk.whiteBright(batchAddr)),
        () => {
          console.log(chalk.whiteBright(singleAddr));
          console.log("&");
          console.log(chalk.whiteBright(batchAddr));
        }
      );
      console.log("");
      setInterval(async () => {
        matchTarget(
          target,
          async () => {
            try {
              const singleUTxOs = await fetchSingleRequestUTxOs(lucid, testnet);
              if (singleUTxOs.length > 0) {
                throw new Error("TODO: ROUTE SINGLE");
              } else {
                logNoneFound("single");
              }
            } catch(e) {
              logWarning(e.toString());
            }
          },
          async () => {
            try {
              const batchUTxOs = await fetchBatchRequestUTxOs(lucid, testnet);
              if (batchUTxOs.length > 0) {
                throw new Error("TODO: ROUTE BATCH");
              } else {
                logNoneFound("batch");
              }
            } catch(e) {
              logWarning(e.toString());
            }
          },
          async () => {
            try {
              const singleUTxOs = await fetchSingleRequestUTxOs(lucid, testnet);
              const batchUTxOs = await fetchBatchRequestUTxOs(lucid, testnet);
              if (singleUTxOs.length > 0 || batchUTxOs.length > 0) {
                throw new Error("TODO: ROUTE SINGLE & BATCH");
              } else {
                logNoneFound("single or batch");
              }
            } catch(e) {
              logWarning(e.toString());
            }
          }
        );
      }, pollingInterval);
    } catch (e) {
      logAbort(e.toString());
      return 1;
    }
  });

program.parse();
