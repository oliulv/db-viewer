#!/usr/bin/env bun

import { parseCliArgs } from "../src/cli/args.ts";
import { startServer } from "../src/server/server.ts";

const config = parseCliArgs(process.argv.slice(2));

console.log("db-viewer starting...");
console.log("Schema file:", config.schemaPath || "(not found)");
console.log("Functions file:", config.functionsPath || "(not found)");

startServer(config);
