import * as chalk_ from "chalk";
import * as path from "path";
import fs from "fs";
import {
  Assets,
  Blockfrost,
  Lucid,
  LucidEvolution,
  Network,
  OutRef,
  Result,
  RouteRequest,
  TxSignBuilder,
  batchRequest,
  errorToString,
  singleRequest,
  ROUTER_FEE,
  getSingleValidatorVA,
  getBatchVAs,
  getAddressDetails,
  AddressDetails,
  UTxO,
} from "@anastasia-labs/smart-handles-offchain";
import { Config, Target } from "./types.js";
import {getRoutedUTxOs} from "./global.js";
import {AWAITING_TX_MSG, BUILDING_TX_MSG, SIGNING_TX_MSG, SUBMITTING_TX_MSG, TX_BUILT_MSG} from "./constants.js";

export const chalk = new chalk_.Chalk();

export function ok<T>(x: T): Result<T> {
  return {
    type: "ok",
    data: x,
  };
}

export const matchTarget = (
  target: Target,
  onSingle: () => void,
  onBatch: () => void
) => {
  if (target == "Single") {
    onSingle();
  } else {
    onBatch();
  }
};

export const showOutRef = (outRef: OutRef): string => {
  return `${outRef.txHash}#${outRef.outputIndex}`;
};

export const showShortOutRef = (outRef: OutRef): string => {
  return `${outRef.txHash.slice(0, 4)}…${outRef.txHash.slice(60)}#${
    outRef.outputIndex
  }`;
};

export const showTime = (d: Date): string => {
  return d
    .toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(/\//g, ".");
};

const logWithTime = (
  color: chalk_.ChalkInstance,
  label: string,
  msg: string
) => {
  const now = new Date();
  const timeStr = showTime(now);
  console.log(
    `${color(chalk.bold(`${timeStr}\u0009${label}`))}${
      label === "" ? "" : " "
    }${color(msg)}`
  );
};

export const logSuccess = (msg: string) => {
  logWithTime(chalk.green, "SUCCESS!", msg);
};

export const logWarning = (msg: string, quiet?: true) => {
  if (!quiet) {
    logWithTime(chalk.yellow, "WARNING", `
${msg}`);
  }
};

export const logAbort = (msg: string) => {
  logWithTime(chalk.red, "ABORT", `
${msg}`);
};

export const logDim = (msg: string) => {
  logWithTime(chalk.dim, "", msg);
};

export const logInfo = (msg: string) => {
  logWithTime(chalk.blue, "INFO", `
${msg}`);
};

export const isHexString = (str: string): boolean => {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  return hexRegex.test(str);
};

export const logNoneFound = (variant: string) => {
  logWithTime(chalk.dim, "", `No ${variant} requests found`);
};

export const setupLucid = async (network: Network): Promise<LucidEvolution> => {
  // {{{
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
        `https://cardano-${`${network}`.toLowerCase()}.blockfrost.io/api/v0`,
        blockfrostKey
      ),
      network
    );
    lucid.selectWallet.fromSeed(seedPhrase);
    return lucid;
  } catch (e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
  // }}}
};

export const handleConfigPromise = async (
  rcp: Promise<Config> | undefined
): Promise<Config> => {
  // {{{
  let config: Config;
  try {
    if (rcp) {
      config = await rcp;
    } else {
      logAbort("Failed to fetch the config");
      process.exit(1);
    }
  } catch (e) {
    logAbort("Failed to fetch the config");
    process.exit(1);
  }
  return config;
  // }}}
};

export const handleAddressOption = (initAddr: string): AddressDetails => {
  // {{{
  try {
    return getAddressDetails(initAddr);
  } catch(e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
  // }}}
};

export const handleAssetOption = (unitAndQty: string, prev: Assets): Assets => {
  // {{{
  try {
    const [initUnit, qtyStr] = unitAndQty.split(",");
    const unit = initUnit.toLowerCase();
    const qty = parseInt(qtyStr, 10);
    if (isHexString(unit) && unit.length >= 56) {
      prev[unit] = (prev[unit] ?? BigInt(0)) + BigInt(qty);
      return prev;
    } else {
      logAbort("Invalid unit provided.");
      process.exit(1);
    }
  } catch (e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
  // }}}
};

export const handleFeeOption = (q: string): bigint => {
  // {{{
  try {
    const n = parseInt(q, 10);
    return BigInt(n);
  } catch (e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
  // }}}
};

export const handleRouteRequest = async (config: Config, req: RouteRequest) => {
  // {{{
  const network: Network = config.network ?? "Mainnet";
  const lucid = await setupLucid(network);
  const target: Target = config.scriptTarget;
  // ------- CONFIG REPORT -----------------------------------------------------
  console.log("");
  console.log(
    chalk.bold(
      `Submitting a route request to ${
        config.label ? `${config.label} ` : ""
      }smart handles script for ${chalk.blue(
        `${config.scriptTarget}`.toUpperCase()
      )} on ${chalk.blue(`${config.network}`.toUpperCase())}`
    )
  );
  console.log("");
  const scriptAddress =
    config.scriptTarget === "Single"
      ? getSingleValidatorVA(config.scriptCBOR, network).address
      : getBatchVAs(config.scriptCBOR, network).spendVA.address;
  console.log("Smart Handles Address:");
  console.log(chalk.whiteBright(scriptAddress));
  console.log("");
  console.log("Route Address:");
  console.log(chalk.whiteBright(config.routeDestination));
  console.log("");
  console.log(chalk.dim(BUILDING_TX_MSG));
  const txRes =
    target === "Single"
      ? await singleRequest(lucid, {
          scriptCBOR: config.scriptCBOR,
          routeRequest: req,
          additionalRequiredLovelaces: BigInt(0),
        })
      : await batchRequest(lucid, {
          stakingScriptCBOR: config.scriptCBOR,
          routeRequests: [req],
          additionalRequiredLovelaces: BigInt(0),
        });
  if (txRes.type === "error") {
    logAbort(errorToString(txRes.error));
    process.exit(1);
  } else {
    console.log(chalk.dim(TX_BUILT_MSG));
    try {
      console.log(chalk.dim(SIGNING_TX_MSG));
      const signedTx = await txRes.data.sign.withWallet().complete();
      console.log(chalk.dim(SUBMITTING_TX_MSG));
      const txHash = await signedTx.submit();
      logSuccess(`Request tx hash:
${txHash}`);
      process.exit(0);
    } catch (e) {
      logAbort(errorToString(e));
      process.exit(1);
    }
  }
  // }}}
};

export const handleLovelaceOption = (q: string): bigint => {
  // {{{
  try {
    const n = parseInt(q, 10);
    if (n >= ROUTER_FEE) {
      return BigInt(n);
    } else {
      logAbort("Insufficient Lovelaces.");
      process.exit(1);
    }
  } catch (e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
  // }}}
};

export const handleTxRes = async (
  lucid: LucidEvolution,
  inputUTxOs: UTxO[],
  txRes: Result<TxSignBuilder>,
  txLabel: string,
  renderedUTxOs: string,
  quiet?: true,
) => {
  // {{{
  if (txRes.type === "error") {
    logWarning(
      `Failed to build the ${txLabel} transaction for ${renderedUTxOs}, cause:
${errorToString(txRes.error)}`,
      quiet
    );
  } else {
    try {
      logDim(TX_BUILT_MSG);
      const signedTx = await txRes.data.sign.withWallet().complete();
      logDim(SUBMITTING_TX_MSG);
      const txHash = await signedTx.submit();
      // logDim(AWAITING_TX_MSG);
      // await lucid.awaitTx(txHash);
      const cache = getRoutedUTxOs();
      inputUTxOs.map(u => cache.push(u));
      logSuccess(`Tx hash:
${txHash}`);
    } catch (e) {
      logWarning(errorToString(e), quiet);
    }
  }
  // }}}
};

export const loadJSONFile = (filePath: string): { [key: string]: any } => {
  // {{{
  const absolutePath = path.resolve(filePath);
  const fileContents = fs.readFileSync(absolutePath, "utf-8");
  return JSON.parse(fileContents);
  // }}}
};
