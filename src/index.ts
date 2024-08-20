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
  // } from "@anastasia-labs/smart-handles-offchain";
} from "../../smart-handles-offchain/src/index";
import {
  chalk,
  Result,
  Target,
  matchTarget,
  logAbort,
  logNoneFound,
  logWarning,
  ok,
} from "./utils";
import { existsSync, readFileSync } from "fs";
import { Network } from "@anastasia-labs/smart-handles-offchain";

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
  .requiredOption(
    "--script <file>",
    `Path to your script's JSON file. Its content must look similar to this (triple
backticks indicate start and end of the file):
${chalk.dim("```json")}
{
    "cborHex": "5906...0101",
    "description": "Smart Handle Router",
    "type": "PlutusScriptV2"
}
${chalk.dim("```")}
Only the "cborHex" matters here. It is assumed the version is Plutus V2.
`,
    (filePath: string): string => {
      if (!existsSync(filePath)) {
        logAbort(`Error: File '${filePath}' does not exist`);
        process.exit(1);
      }
      const jsonContent = readFileSync(filePath, "utf-8");
      try {
        const parsed: { cborHex: string } & { [key: string]: any } =
          JSON.parse(jsonContent);
        if (parsed && "cborHex" in parsed) {
          return parsed.cborHex;
        } else {
          logAbort('Provided JSON doesn\'t have a "cborHex" field');
          process.exit(1);
        }
      } catch (e) {
        logAbort("Failed to parse the provided JSON file");
        process.exit(1);
      }
    }
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
  .action(async ({ script: scriptCBOR, target, pollingInterval, testnet }) => {
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

    // ------- SETTING UP LUCID ------------------------------------------------
    const network: Network = testnet ? "Preprod" : "Mainnet";
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
          `https://cardano-${
            testnet ? "preprod" : "mainnet"
          }.blockfrost.io/api/v0`,
          blockfrostKey
        ),
        network
      );
      lucid.selectWallet.fromSeed(seedPhrase);

      // ------- POLLING -------------------------------------------------------
      const singleVA = getSingleValidatorVA(scriptCBOR, network);
      const batchVAs = getBatchVAs(scriptCBOR, network);
      const singleAddr = singleVA.address;
      const batchAddr = batchVAs.spendVA.address;
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
        const fsru = async () => {
          return await fetchSingleRequestUTxOs(lucid, scriptCBOR, network);
        };
        const fbru = async () => {
          return await fetchBatchRequestUTxOs(lucid, scriptCBOR, network);
        };
        matchTarget(
          target,
          async () => {
            try {
              const singleUTxOs = await fsru();
              if (singleUTxOs.length > 0) {
                throw new Error("TODO: ROUTE SINGLE");
              } else {
                logNoneFound("single");
              }
            } catch (e) {
              logWarning(e.toString());
            }
          },
          async () => {
            try {
              const batchUTxOs = await fbru();
              if (batchUTxOs.length > 0) {
                throw new Error("TODO: ROUTE BATCH");
              } else {
                logNoneFound("batch");
              }
            } catch (e) {
              logWarning(e.toString());
            }
          },
          async () => {
            try {
              const singleUTxOs = await fsru();
              const batchUTxOs = await fbru();
              if (singleUTxOs.length > 0 || batchUTxOs.length > 0) {
                throw new Error("TODO: ROUTE SINGLE & BATCH");
              } else {
                logNoneFound("single or batch");
              }
            } catch (e) {
              logWarning(e.toString());
            }
          }
        );
      }, pollingInterval);
    } catch (e) {
      logAbort(e.toString());
      process.exit(1);
    }
  });

program.parse();
