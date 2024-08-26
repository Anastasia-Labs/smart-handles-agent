import * as chalk_ from "chalk";
import * as path from "path";

const chalk = new chalk_.Chalk();

export const DEFAULT_ROUTER_CONFIG_NAME = "router.config.ts";
export const DEFAULT_CONFIG_PATH = path.resolve(
  process.cwd(),
  DEFAULT_ROUTER_CONFIG_NAME
);

export const ENV_VARS_GUIDE = `
Make sure you first have set these 2 environment variables:

\u0009${chalk.bold("BLOCKFROST_KEY")}\u0009 Your Blockfrost API key
\u0009${chalk.bold("SEED_PHRASE")}   \u0009 Your wallet's seed phrase
`;

export const ROUTER_CONFIG_OPTION_DESCRIPTION = "Path to router config file";

export const EXTRA_SUBMIT_CONFIG_OPTION_DESCRIPTION =
  "Path to extra config JSON file to provide more values for submitting a request";

export const LOVELACE_OPTION_DESCRIPTION =
  "Lovelace count to be sent. Must be large enough to cover router fee.";

export const ASSET_OPTION_DESCRIPTION = `Additional assets to be locked. \`unit\` is the concatenation of policy ID, and
token name in hex format.`;
