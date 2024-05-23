#!/bin/env node

import * as packageJson from "../package.json";
import { Command } from "@commander-js/extra-typings";
import * as chalk_ from "chalk";
import {
  Blockfrost,
  Lucid,
  fetchBatchRequestUTxOs,
  fetchSingleRequestUTxOs,
} from "@anastasia-labs/smart-handles-offchain";

const chalk = new chalk_.Chalk();

// UTILS
// {{{
type Target = "Single" | "Batch" | "Both";

const logAbort = (msg: string) => {
  console.log(`${chalk.red(chalk.bold("ABORT:"))} ${chalk.red(msg)}`);
};
const logNoneFound = (variant: string) => {
  const msg = `No ${variant} requests found`;
  console.log(chalk.bold(chalk.dim(msg)));
};
// }}}

const program: Command = new Command();

program.version(packageJson.version).description(packageJson.description);

program
  .command("monitor")
  .alias("m")
  .description(
    `
Start monitoring the Minswap smart handles address, and perform the routing to
collect their fees.

Make sure you've first set these 2 environment variables:

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
        console.log(
          chalk.yellow(
            `WARNING: Bad polling interval, reverting to default (${def}ms)`
          )
        );
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
        `Monitoring Minswap smart handles script for ${chalk.blue(
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
    setInterval(async () => {
      const now = new Date();
      console.log(
        `${chalk.bgGray(now.toLocaleTimeString())}\u0009 fetching\u2026`
      );
      if (target == "Single") {
        const singleUTxOs = await fetchSingleRequestUTxOs(lucid, testnet);
        if (singleUTxOs.length > 0) {
          throw new Error("TODO");
        } else {
          logNoneFound("single");
        }
      } else if (target == "Batch") {
        const batchUTxOs = await fetchBatchRequestUTxOs(lucid, testnet);
        if (batchUTxOs.length > 0) {
          throw new Error("TODO");
        } else {
          logNoneFound("batch");
        }
      } else {
        const singleUTxOs = await fetchSingleRequestUTxOs(lucid, testnet);
        const batchUTxOs = await fetchBatchRequestUTxOs(lucid, testnet);
        if (singleUTxOs.length > 0 || batchUTxOs.length > 0) {
          throw new Error("TODO");
        } else {
          logNoneFound("single or batch");
        }
      }
    }, pollingInterval);
  });

program.parse();
