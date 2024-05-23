#!/bin/env node

import * as packageJson from "../package.json";
import { Command } from "@commander-js/extra-typings";
import * as kleur from "kleur";
import { Lucid, fetchBatchRequestUTxOs } from "@anastasia-labs/smart-handles-offchain";

type Target = "Single" | "Batch" | "Both";

const program: Command = new Command();

program.version(packageJson.version).description(packageJson.description);

program
  .command("monitor")
  .alias("m")
  .description(
    "Start monitoring the Minswap smart handles address, and perform the routing to collect their fees"
  )
  .option(
    "-t, --target <VARIANT>",
    "Specify smart handle variant",
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
    "-i, --polling-interval <MILLISECONDS>",
    "Specify the polling interval in milliseconds",
    (x: string, def: number): number => {
      const parsed = parseInt(x);
      if (isNaN(parsed)) {
        console.log(kleur.yellow(`WARNING: Bad polling interval, reverting to default (${def}ms)`));
        return def;
      } else {
        return parsed;
      }
    },
    10000
  )
  .option("-t, --testnet", "Switch to preprod testnet", false)
  .action(({ target, pollingInterval, testnet }) => {
    console.log("");
    console.log(
      kleur.bold(
        `Monitoring Minswap smart handles script for ${kleur.blue(
          target == "Single"
            ? "Single"
            : target == "Both"
            ? "both Single and Batch"
            : "Batch"
        )} requests\u2026`
      )
    );
    const lucid = new Lucid();
    console.log(kleur.dim(`Polling every ${pollingInterval}`));
    setInterval(async () => {
      await fetchBatchRequestUTxOs(lucid, testnet);
    }, pollingInterval);
  });

program.parse();
