#!/usr/bin/env bun

import { parseCliArgs } from "../src/cli/args.ts";

const config = parseCliArgs(process.argv.slice(2));

console.log("db-viewer starting...");
console.log("Schema file:", config.schemaPath || "(not found)");
console.log("Functions file:", config.functionsPath || "(not found)");
console.log("Port:", config.port);

// TODO: Start the server (Phase 5)
console.log("\nServer not yet implemented. Coming soon!");
