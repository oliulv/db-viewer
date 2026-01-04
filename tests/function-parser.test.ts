import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { parseFunctionsFile } from "../src/parser/function-parser.ts";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/db-viewer-function-test";
const TEST_FUNCTIONS_PATH = join(TEST_DIR, "index.ts");

const SAMPLE_FUNCTIONS = `
import { Database } from "bun:sqlite";

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(":memory:");
  }
  return db;
}

export function getUser(userId: string): User | null {
  const db = getDb();
  const row = db.query("SELECT * FROM users WHERE id = ?").get(userId);
  return row ? rowToUser(row) : null;
}

export function getAllUsers(): User[] {
  const db = getDb();
  const rows = db.query("SELECT * FROM users").all();
  return rows.map(rowToUser);
}

export function createUser(name: string, email: string): void {
  const db = getDb();
  db.run(\`
    INSERT INTO users (name, email, created_at)
    VALUES (?, ?, datetime('now'))
  \`, [name, email]);
}

export function updateUser(userId: string, name: string): void {
  const db = getDb();
  db.run("UPDATE users SET name = ? WHERE id = ?", [name, userId]);
}

export function deleteUser(userId: string): void {
  const db = getDb();
  db.run("DELETE FROM users WHERE id = ?", [userId]);
}

/**
 * Get posts with their authors using a JOIN
 */
export function getPostsWithAuthors(limit: number = 10): PostWithAuthor[] {
  const db = getDb();
  const rows = db.query(\`
    SELECT p.*, u.name as author_name
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT ?
  \`).all(limit);
  return rows.map(rowToPostWithAuthor);
}

function rowToUser(row: unknown): User {
  return row as User;
}

function rowToPostWithAuthor(row: unknown): PostWithAuthor {
  return row as PostWithAuthor;
}

type User = { id: string; name: string; email: string };
type PostWithAuthor = { id: string; title: string; author_name: string };
`;

describe("parseFunctionsFile", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FUNCTIONS_PATH, SAMPLE_FUNCTIONS);
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should parse exported functions", () => {
    const result = parseFunctionsFile(TEST_FUNCTIONS_PATH);
    const exportedFunctions = result.functions.filter((f) => f.isExported);
    expect(exportedFunctions.length).toBe(7);
  });

  it("should parse function parameters", () => {
    const result = parseFunctionsFile(TEST_FUNCTIONS_PATH);
    const createUser = result.functions.find((f) => f.name === "createUser");

    expect(createUser).toBeDefined();
    expect(createUser!.params.length).toBe(2);
    expect(createUser!.params[0]!.name).toBe("name");
    expect(createUser!.params[0]!.type).toBe("string");
    expect(createUser!.params[1]!.name).toBe("email");
    expect(createUser!.params[1]!.type).toBe("string");
  });

  it("should parse return types", () => {
    const result = parseFunctionsFile(TEST_FUNCTIONS_PATH);

    const getUser = result.functions.find((f) => f.name === "getUser");
    expect(getUser!.returnType).toBe("User | null");

    const getAllUsers = result.functions.find((f) => f.name === "getAllUsers");
    expect(getAllUsers!.returnType).toBe("User[]");

    const createUser = result.functions.find((f) => f.name === "createUser");
    expect(createUser!.returnType).toBe("void");
  });

  it("should extract SQL queries from functions", () => {
    const result = parseFunctionsFile(TEST_FUNCTIONS_PATH);

    const getUser = result.functions.find((f) => f.name === "getUser");
    expect(getUser!.sqlQueries.length).toBe(1);
    expect(getUser!.sqlQueries[0]!.type).toBe("SELECT");

    const createUser = result.functions.find((f) => f.name === "createUser");
    expect(createUser!.sqlQueries.length).toBe(1);
    expect(createUser!.sqlQueries[0]!.type).toBe("INSERT");

    const updateUser = result.functions.find((f) => f.name === "updateUser");
    expect(updateUser!.sqlQueries.length).toBe(1);
    expect(updateUser!.sqlQueries[0]!.type).toBe("UPDATE");

    const deleteUser = result.functions.find((f) => f.name === "deleteUser");
    expect(deleteUser!.sqlQueries.length).toBe(1);
    expect(deleteUser!.sqlQueries[0]!.type).toBe("DELETE");
  });

  it("should extract tables used in queries", () => {
    const result = parseFunctionsFile(TEST_FUNCTIONS_PATH);

    const getUser = result.functions.find((f) => f.name === "getUser");
    expect(getUser!.tablesUsed).toContain("users");

    const getPostsWithAuthors = result.functions.find((f) => f.name === "getPostsWithAuthors");
    expect(getPostsWithAuthors!.tablesUsed).toContain("posts");
    expect(getPostsWithAuthors!.tablesUsed).toContain("users");
  });

  it("should identify non-exported functions", () => {
    const result = parseFunctionsFile(TEST_FUNCTIONS_PATH);

    const rowToUser = result.functions.find((f) => f.name === "rowToUser");
    expect(rowToUser!.isExported).toBe(false);
  });
});

describe("parseFunctionsFile with conflict-guard", () => {
  it("should parse the real conflict-guard functions", () => {
    const result = parseFunctionsFile("/Users/oliulv/Code/startups/conflict-guard/src/db/index.ts");

    const exportedFunctions = result.functions.filter((f) => f.isExported);
    expect(exportedFunctions.length).toBeGreaterThan(10);

    // Check specific functions
    const registerAgent = result.functions.find((f) => f.name === "registerAgent");
    expect(registerAgent).toBeDefined();
    expect(registerAgent!.isExported).toBe(true);
    expect(registerAgent!.tablesUsed).toContain("agents");

    const getUncommittedChanges = result.functions.find((f) => f.name === "getUncommittedChanges");
    expect(getUncommittedChanges).toBeDefined();
    expect(getUncommittedChanges!.tablesUsed).toContain("file_changes");
  });
});
