import * as chalk_ from "chalk";
import * as path from "path";
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
} from "@anastasia-labs/smart-handles-offchain";
import {RouterConfig, Target} from "./types";
import {DEFAULT_CONFIG_PATH} from "./constants";

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

export const logSuccess = (msg: string) => {
  console.log(`${chalk.green(chalk.bold("SUCCESS!"))} ${chalk.green(msg)}`);
};

export const logWarning = (msg: string) => {
  console.log(`${chalk.yellow(chalk.bold("WARNING:"))} ${chalk.yellow(msg)}`);
};

export const logAbort = (msg: string) => {
  console.log(`${chalk.red(chalk.bold("ABORT:"))} ${chalk.red(msg)}`);
};

export const logInfo = (msg: string) => {
  console.log(`${chalk.blue(chalk.bold("INFO:"))} ${chalk.blue(msg)}`);
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

export const isHexString = (str: string): boolean => {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  return hexRegex.test(str);
};

export const logNoneFound = (variant: string) => {
  const now = new Date();
  const msg = `No ${variant} requests found`;
  const timeStr = showTime(now);
  console.log(chalk.dim(`${chalk.bold(timeStr)}\u0009${msg}`));
};

export async function setupLucid(network: Network): Promise<LucidEvolution> {
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
}

export async function handleRouterConfigPromise(
  rcp: Promise<RouterConfig> | undefined
): Promise<RouterConfig> {
  // {{{
  let routerConfig: RouterConfig;
  try {
    if (rcp) {
      routerConfig = await rcp;
    } else {
      logAbort("Failed to fetch the config");
      process.exit(1);
    }
  } catch (e) {
    logAbort("Failed to fetch the config");
    process.exit(1);
  }
  return routerConfig;
  // }}}
}

export function handleAssetOption(unitAndQty: string, prev: Assets): Assets {
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
}

export function handleFeeOption(q: string): bigint {
  // {{{
  try {
    const n = parseInt(q, 10);
    return BigInt(n);
  } catch (e) {
    logAbort(errorToString(e));
    process.exit(1);
  }
  // }}}
}

export async function handleRouteRequest(routerConfig: RouterConfig, req: RouteRequest) {
  // {{{
  const network: Network = routerConfig.network ?? "Mainnet";
  const lucid = await setupLucid(network);
  const target: Target = routerConfig.scriptTarget;
  const txRes =
    target === "Single"
      ? await singleRequest(lucid, {
          scriptCBOR: routerConfig.scriptCBOR,
          routeRequest: req,
          additionalRequiredLovelaces: BigInt(0),
        })
      : await batchRequest(lucid, {
          stakingScriptCBOR: routerConfig.scriptCBOR,
          routeRequests: [req],
          additionalRequiredLovelaces: BigInt(0),
        });
  if (txRes.type === "error") {
    logAbort(errorToString(txRes.error));
    process.exit(1);
  } else {
    try {
      const signedTx = await txRes.data.sign.withWallet().complete();
      const txHash = await signedTx.submit();
      logSuccess(`Request tx hash: ${txHash}`);
      process.exit(0);
    } catch(e) {
      logAbort(errorToString(e));
      process.exit(1);
    }
  }
  // }}}
}

export async function handleRouteTxRes(
  txRes: Result<TxSignBuilder>,
  txLabel: string,
  renderedUTxOs: string
) {
  // {{{
  if (txRes.type === "error") {
    logWarning(`Failed to build the ${txLabel} transaction for ${renderedUTxOs}`);
  } else {
    const signedTx = await txRes.data.sign.withWallet().complete();
    const txHash = await signedTx.submit();
    logSuccess(`Route tx hash: ${txHash}`);
  }
  // }}}
}

export async function loadRouterConfig(specifiedPath?: string): Promise<RouterConfig> {
  // {{{
  const fullPath = specifiedPath
    ? path.resolve(specifiedPath)
    : DEFAULT_CONFIG_PATH;
  const extension = path.extname(fullPath);

  if (extension === ".ts") {
    // Only TypeScript is expected.
    try {
      const tsNode = await import("ts-node");
      tsNode.register({
        transpileOnly: true,
        compilerOptions: {
          module: "commonjs",
        },
      });

      const config = await import(fullPath);
      return config.default || config;
    } catch (error) {
      logAbort(`Error loading TypeScript config: ${errorToString}`);
      process.exit(1);
    }
  } else {
    logAbort("Please provide a TypeScript file for config");
    process.exit(1);
  }
  // }}}
}
