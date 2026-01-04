import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { parseSchemaFile } from "../src/parser/schema-parser.ts";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/db-viewer-schema-test";
const TEST_SCHEMA_PATH = join(TEST_DIR, "schema.ts");

const SAMPLE_SCHEMA = `
import { Database } from "bun:sqlite";

export function initializeSchema(db: Database): void {
  db.run(\`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  \`);

  db.run(\`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  \`);

  db.run(\`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email)
  \`);

  db.run(\`
    CREATE INDEX IF NOT EXISTS idx_posts_user_id
    ON posts(user_id)
  \`);
}
`;

describe("parseSchemaFile", () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_SCHEMA_PATH, SAMPLE_SCHEMA);
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should parse tables correctly", () => {
    const schema = parseSchemaFile(TEST_SCHEMA_PATH);
    expect(schema.tables.length).toBe(2);
  });

  it("should parse users table columns", () => {
    const schema = parseSchemaFile(TEST_SCHEMA_PATH);
    const users = schema.tables.find((t) => t.name === "users");

    expect(users).toBeDefined();
    expect(users!.columns.length).toBe(4);

    const idCol = users!.columns.find((c) => c.name === "id");
    expect(idCol?.type).toBe("INTEGER");
    expect(idCol?.isPrimaryKey).toBe(true);
    expect(idCol?.isAutoIncrement).toBe(true);

    const emailCol = users!.columns.find((c) => c.name === "email");
    expect(emailCol?.type).toBe("TEXT");
    expect(emailCol?.nullable).toBe(false);

    const nameCol = users!.columns.find((c) => c.name === "name");
    expect(nameCol?.nullable).toBe(true);
  });

  it("should parse foreign keys", () => {
    const schema = parseSchemaFile(TEST_SCHEMA_PATH);
    const posts = schema.tables.find((t) => t.name === "posts");

    expect(posts).toBeDefined();
    expect(posts!.foreignKeys.length).toBe(1);

    const fk = posts!.foreignKeys[0]!;
    expect(fk.column).toBe("user_id");
    expect(fk.referencesTable).toBe("users");
    expect(fk.referencesColumn).toBe("id");
    expect(fk.onDelete).toBe("CASCADE");
  });

  it("should parse indexes", () => {
    const schema = parseSchemaFile(TEST_SCHEMA_PATH);

    const users = schema.tables.find((t) => t.name === "users")!;
    expect(users.indexes.length).toBe(1);
    expect(users.indexes[0]!.name).toBe("idx_users_email");
    expect(users.indexes[0]!.isUnique).toBe(true);
    expect(users.indexes[0]!.columns).toEqual(["email"]);

    const posts = schema.tables.find((t) => t.name === "posts")!;
    expect(posts.indexes.length).toBe(1);
    expect(posts.indexes[0]!.name).toBe("idx_posts_user_id");
    expect(posts.indexes[0]!.isUnique).toBe(false);
  });

  it("should parse primary keys", () => {
    const schema = parseSchemaFile(TEST_SCHEMA_PATH);

    const users = schema.tables.find((t) => t.name === "users");
    expect(users!.primaryKey).toEqual(["id"]);

    const posts = schema.tables.find((t) => t.name === "posts");
    expect(posts!.primaryKey).toEqual(["id"]);
  });
});
