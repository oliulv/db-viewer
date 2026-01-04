import { parseArgs } from "util";
import type { CliConfig } from "./types.ts";
import { detectDbFiles } from "./detect.ts";
import { resolve } from "path";

const HELP_TEXT = `
db-viewer - Visualize your SQLite schema and query functions

Usage:
  db-viewer [options] [path]

Options:
  -s, --schema <path>     Path to schema.ts file
  -f, --functions <path>  Path to index.ts (db functions file)
  -p, --port <number>     Server port (default: 3456)
  -o, --open              Open browser automatically
  -h, --help              Show this help message
  -v, --version           Show version

Examples:
  db-viewer                                     # Auto-detect in ./src/db/
  db-viewer ./src/db                            # Specify a directory
  db-viewer -s ./db/schema.ts -f ./db/index.ts  # Explicit paths
  db-viewer -p 4000 -o                          # Custom port, auto-open
`;

const VERSION = "1.0.0";

export function parseCliArgs(args: string[]): CliConfig {
  const { values, positionals } = parseArgs({
    args,
    options: {
      schema: { type: "string", short: "s" },
      functions: { type: "string", short: "f" },
      port: { type: "string", short: "p", default: "3456" },
      open: { type: "boolean", short: "o", default: false },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (values.version) {
    console.log(`db-viewer v${VERSION}`);
    process.exit(0);
  }

  const port = parseInt(values.port as string, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error("Error: Invalid port number");
    process.exit(1);
  }

  let schemaPath = values.schema as string | undefined;
  let functionsPath = values.functions as string | undefined;

  // If paths not explicitly provided, try to detect them
  if (!schemaPath || !functionsPath) {
    const searchDir = positionals[0] || ".";
    const detected = detectDbFiles(searchDir);

    if (!schemaPath && detected.schemaPath) {
      schemaPath = detected.schemaPath;
    }
    if (!functionsPath && detected.functionsPath) {
      functionsPath = detected.functionsPath;
    }
  }

  // Validate we have at least one file
  if (!schemaPath && !functionsPath) {
    console.error("Error: Could not find schema.ts or index.ts files.");
    console.error("Please specify paths with --schema and --functions options,");
    console.error("or run from a directory containing these files.");
    process.exit(1);
  }

  return {
    schemaPath: schemaPath ? resolve(schemaPath) : "",
    functionsPath: functionsPath ? resolve(functionsPath) : "",
    port,
    openBrowser: values.open as boolean,
  };
}
