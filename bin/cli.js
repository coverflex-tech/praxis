#!/usr/bin/env node

import { createRequire } from "node:module";
import { program } from "commander";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

program
  .name("praxis")
  .description(
    "Install, update, and manage Praxis agent skills in your project"
  )
  .version(version);

program
  .command("init")
  .description("Initialize Praxis in the current project")
  .option("--cursor", "Add Cursor tool support (.cursor/)")
  .option("--claude", "Add Claude tool support (.claude/)")
  .option("--opencode", "Add OpenCode support (not yet supported)")
  .option("--force", "Overwrite existing tool dirs if present")
  .action(async (opts) => {
    const { init } = await import("../src/commands/init.js");
    await init(opts);
  });

program
  .command("update")
  .description("Update Praxis files to the latest version")
  .option("--cursor", "Add or refresh Cursor tool support (.cursor/)")
  .option("--claude", "Add or refresh Claude tool support (.claude/)")
  .option("--opencode", "Add OpenCode support (not yet supported)")
  .option("--force", "Overwrite existing tool dirs if present")
  .action(async (opts) => {
    const { update } = await import("../src/commands/update.js");
    await update(opts);
  });

program
  .command("status")
  .description("Show the status of managed Praxis files")
  .action(async () => {
    const { status } = await import("../src/commands/status.js");
    await status();
  });

program.parseAsync().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
