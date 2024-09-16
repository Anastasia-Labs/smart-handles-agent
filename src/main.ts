// === IMPORTS =================================================================
import { Command } from "@commander-js/extra-typings";
import { monitor } from "./commands/monitor.js";
import { submitAdvanced } from "./commands/submit-advanced.js";
import { submitSimple } from "./commands/submit-simple.js";
import {
  ASSET_OPTION_DESCRIPTION,
  ENV_VARS_GUIDE,
  EXTRA_SUBMIT_CONFIG_OPTION_DESCRIPTION,
  LOVELACE_OPTION_DESCRIPTION,
} from "./constants.js";
import { Config } from "./types.js";
import {
  handleLovelaceOption,
  handleAssetOption,
  handleFeeOption,
  chalk,
  loadJSONFile,
  handleAddressOption,
} from "./utils.js";
// =============================================================================

export const main = (config: Config): Command => {
  const program: Command = new Command();
  program.version("0.1.0").description(
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
  ${"Provider for making CLI application for submitting and routing requests to a smart handles script on Cardano"}
  ${ENV_VARS_GUIDE}`
  );

  // === SUBMIT-SIMPLE =========================================================
  program
    .command("submit-simple")
    .description(
      `Submit a simple route request to later be handled by a routing agent monitoring
  the script address.`
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
      {}
    )
    .action(submitSimple(config));
  // ===========================================================================

  // === SUBMIT-ADVANCED =======================================================
  program
    .command("submit-advanced")
    .description(
      `Submit an advanced route request to later be handled by a routing agent
  monitoring the script address.`
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
      {}
    )
    .option(
      "--owner <bech32-address>",
      "Optional address to be recorded as owner of the UTxO",
      handleAddressOption
    )
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
    .action(submitAdvanced(config));
  // ===========================================================================

  // === MONITOR ===============================================================
  program
    .command("monitor")
    .alias("m")
    .description(
      `Start monitoring the provided smart handles instance, and perform the routing to
  collect their fees.`
    )
    .option("-q, --quiet", "Suppress warning logs.")
    .option("--reclaim", "Only perform advanced reclaims.")
    .action(({ quiet, reclaim }) =>
      monitor({ ...config, quiet: quiet ?? config.quiet, reclaim })()
    );
  // ===========================================================================

  return program;
  // return await program.parseAsync(process.argv);
};
