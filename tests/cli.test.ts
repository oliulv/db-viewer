import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { detectDbFiles } from "../src/cli/detect.ts";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/db-viewer-test";

describe("detectDbFiles", () => {
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(join(TEST_DIR, "src/db"), { recursive: true });
    writeFileSync(join(TEST_DIR, "src/db/schema.ts"), "// schema");
    writeFileSync(join(TEST_DIR, "src/db/index.ts"), "// index");
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should detect schema.ts in src/db", () => {
    const result = detectDbFiles(TEST_DIR);
    expect(result.schemaPath).toBe(join(TEST_DIR, "src/db/schema.ts"));
  });

  it("should detect index.ts in src/db", () => {
    const result = detectDbFiles(TEST_DIR);
    expect(result.functionsPath).toBe(join(TEST_DIR, "src/db/index.ts"));
  });

  it("should return null for non-existent directory", () => {
    const result = detectDbFiles("/non/existent/path");
    expect(result.schemaPath).toBeNull();
    expect(result.functionsPath).toBeNull();
  });
});

describe("detectDbFiles with root files", () => {
  const ROOT_TEST_DIR = "/tmp/db-viewer-test-root";

  beforeAll(() => {
    mkdirSync(ROOT_TEST_DIR, { recursive: true });
    writeFileSync(join(ROOT_TEST_DIR, "schema.ts"), "// schema");
    writeFileSync(join(ROOT_TEST_DIR, "index.ts"), "// index");
  });

  afterAll(() => {
    rmSync(ROOT_TEST_DIR, { recursive: true, force: true });
  });

  it("should detect files in root directory", () => {
    const result = detectDbFiles(ROOT_TEST_DIR);
    expect(result.schemaPath).toBe(join(ROOT_TEST_DIR, "schema.ts"));
    expect(result.functionsPath).toBe(join(ROOT_TEST_DIR, "index.ts"));
  });
});
