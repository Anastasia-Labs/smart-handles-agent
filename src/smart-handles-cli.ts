#!/usr/bin/env node

// === IMPORTS =================================================================
import * as packageJson from "../package.json";
import { Command } from "@commander-js/extra-typings";
import { monitor } from "./commands/monitor.js";
import { submitAdvanced } from "./commands/submit-advanced.js";
import { submitSimple } from "./commands/submit-simple.js";
import {
  ASSET_OPTION_DESCRIPTION,
  ENV_VARS_GUIDE,
  EXTRA_SUBMIT_CONFIG_OPTION_DESCRIPTION,
  LOVELACE_OPTION_DESCRIPTION,
  ROUTER_CONFIG_OPTION_DESCRIPTION,
} from "./constants.js";
import {
  handleLovelaceOption,
  handleAssetOption,
  loadConfig,
  handleFeeOption,
  chalk,
  loadJSONFile,
} from "./utils.js";
// =============================================================================

const program: Command = new Command();
program.version(packageJson.version).description(
  `
${chalk.red(
  `                        @#
                       @@%#
                      %@@@%#
                     %%%%%%##
                    %%%%%%%%%#
                   %%%%%%%%%%%#
                  %%%%%%%%%%####
                 %%%%%%%%%#######
                %%%%%%%%  ########
               %%%%%%%%%  #########
              %%%%%%%%%%  ##########
             %%%%%%%%%%    ##########
            %%%%%%%%%%      ##########
           %%%%%%%%%%        ##########
          %%%%%%%%%%          ##########
         %%%%%%%%%%            ##########
        ###%%%%%%%              ##########
       #########                  #########

 ${chalk.bgGray(
   "    " +
     chalk.bold(
       chalk.whiteBright("A  N  A  S  T  A  S  I  A") +
         "     " +
         chalk.redBright("L  A  B  S")
     ) +
     "    "
 )}
`
)}
${packageJson.description}
${ENV_VARS_GUIDE}`
);

// === SUBMIT-SIMPLE ===========================================================
program
  .command("submit-simple")
  .description(
    `Submit a simple route request to later be handled by a routing agent monitoring
the script address.`
  )
  .option("--config <path>", ROUTER_CONFIG_OPTION_DESCRIPTION, loadConfig)
  .requiredOption(
    "-l, --lovelace <quantity>",
    LOVELACE_OPTION_DESCRIPTION,
    handleLovelaceOption
  )
  .option(
    "-a, --asset <unit,quantity>",
    ASSET_OPTION_DESCRIPTION,
    handleAssetOption,
    {}
  )
  .action(submitSimple);
// =============================================================================

// === SUBMIT-ADVANCED =========================================================
program
  .command("submit-advanced")
  .description(
    `Submit an advanced route request to later be handled by a routing agent
monitoring the script address.`
  )
  .option("--config <path>", ROUTER_CONFIG_OPTION_DESCRIPTION, loadConfig)
  .requiredOption(
    "-l, --lovelace <quantity>",
    LOVELACE_OPTION_DESCRIPTION,
    handleLovelaceOption
  )
  .option(
    "-a, --asset <unit,quantity>",
    ASSET_OPTION_DESCRIPTION,
    handleAssetOption,
    {}
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
  .option(
    "--extra-config <path>",
    EXTRA_SUBMIT_CONFIG_OPTION_DESCRIPTION,
    loadJSONFile
  )
  .action(submitAdvanced);
// =============================================================================

// === MONITOR =================================================================
program
  .command("monitor")
  .alias("m")
  .description(
    `Start monitoring the provided smart handles instance, and perform the routing to
collect their fees.`
  )
  .option("--config <path>", ROUTER_CONFIG_OPTION_DESCRIPTION, loadConfig)
  .action(monitor);
// =============================================================================

program.parse();
