import * as chalk_ from "chalk";

export const chalk = new chalk_.Chalk();

export type Target = "Single" | "Batch" | "Both";

export const matchTarget = (
  target: Target,
  onSingle: () => void,
  onBatch: () => void,
  onBoth: () => void
) => {
  if (target == "Single") {
    onSingle();
  } else if (target == "Batch") {
    onBatch();
  } else {
    onBoth();
  }
};

export const logWarning = (msg: string) => {
  console.log(`${chalk.yellow(chalk.bold("WARNING:"))} ${chalk.yellow(msg)}`);
};

export const logAbort = (msg: string) => {
  console.log(`${chalk.red(chalk.bold("ABORT:"))} ${chalk.red(msg)}`);
};

export const showTime = (d: Date): string => {
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(/\//g, ".");
};

export const logNoneFound = (variant: string) => {
  const now = new Date();
  const msg = `No ${variant} requests found`;
  const timeStr = showTime(now);
  console.log(chalk.dim(`${chalk.bold(timeStr)}\u0009${msg}`));
};
