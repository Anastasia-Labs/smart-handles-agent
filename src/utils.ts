import * as chalk_ from "chalk";
import {
  OutRef,
  Result,
  TxSignBuilder,
} from "../../smart-handles-offchain/src";

export const chalk = new chalk_.Chalk();

export function ok<T>(x: T): Result<T> {
  return {
    type: "ok",
    data: x,
  };
}

export type Target = "Single" | "Batch";

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

export const handleTxRes = async (
  txRes: Result<TxSignBuilder>,
  txLabel: string,
  renderedUTxOs: string
) => {
  if (txRes.type === "error") {
    logWarning(`Failed to build the ${txLabel} transaction for ${renderedUTxOs}`);
  } else {
    const signedTx = await txRes.data.sign.withWallet().complete();
    const txHash = await signedTx.submit();
    logSuccess(`Route tx hash: ${txHash}`);
  }
};
