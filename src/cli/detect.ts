import { existsSync } from "fs";
import { join } from "path";
import type { DetectedFiles } from "./types.ts";

const SCHEMA_FILENAMES = ["schema.ts", "schema.js"];
const FUNCTIONS_FILENAMES = ["index.ts", "index.js", "queries.ts", "queries.js", "db.ts", "db.js"];

const SEARCH_DIRS = [
  ".", // Current directory
  "src/db",
  "src/database",
  "db",
  "database",
  "lib/db",
  "lib/database",
];

function findFile(baseDir: string, filenames: string[]): string | null {
  for (const searchDir of SEARCH_DIRS) {
    for (const filename of filenames) {
      const filePath = join(baseDir, searchDir, filename);
      if (existsSync(filePath)) {
        return filePath;
      }
    }
  }
  return null;
}

export function detectDbFiles(baseDir: string): DetectedFiles {
  return {
    schemaPath: findFile(baseDir, SCHEMA_FILENAMES),
    functionsPath: findFile(baseDir, FUNCTIONS_FILENAMES),
  };
}
