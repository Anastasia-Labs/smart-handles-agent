import * as packageJson from "../package.json";
import { Command } from "commander";
import kleur from "kleur";

const program = new Command();

program
  .version(packageJson.version)
  .description(packageJson.description);

program
  .command("echo <text>")
  .alias("e")
  .description("Echo the provided text")
  .action((text) => {
    console.log("");
    console.log(kleur.green(text));
    console.log("");
  });

program.parse();
