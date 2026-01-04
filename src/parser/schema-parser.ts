import { readFileSync } from "fs";
import type {
  ParsedSchema,
  ParsedTable,
  ParsedColumn,
  ParsedForeignKey,
  ParsedIndex,
} from "./types.ts";

// Extract all SQL strings from the file content
function extractSqlStrings(content: string): string[] {
  const sqlStrings: string[] = [];

  // Match template literals: `...`
  const templateLiteralRegex = /`([^`]*)`/g;
  let match;
  while ((match = templateLiteralRegex.exec(content)) !== null) {
    const captured = match[1];
    if (captured !== undefined) {
      sqlStrings.push(captured.trim());
    }
  }

  // Match double-quoted strings: "..."
  const doubleQuoteRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  while ((match = doubleQuoteRegex.exec(content)) !== null) {
    const captured = match[1];
    if (captured !== undefined) {
      const str = captured.trim();
      // Only include if it looks like SQL
      if (/^\s*(CREATE|SELECT|INSERT|UPDATE|DELETE|ALTER|DROP|PRAGMA)/i.test(str)) {
        sqlStrings.push(str);
      }
    }
  }

  return sqlStrings;
}

// Parse a CREATE TABLE statement
function parseCreateTable(sql: string): ParsedTable | null {
  // Match CREATE TABLE [IF NOT EXISTS] tablename (...)
  const tableMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*)\)/i);

  if (!tableMatch) return null;

  const tableName = tableMatch[1];
  const columnsAndConstraints = tableMatch[2];

  if (!tableName || !columnsAndConstraints) return null;

  const columns: ParsedColumn[] = [];
  const foreignKeys: ParsedForeignKey[] = [];
  const primaryKeyColumns: string[] = [];

  // Split by comma, but handle parentheses properly
  const parts = splitByComma(columnsAndConstraints);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check for table-level constraints
    if (/^\s*FOREIGN\s+KEY/i.test(trimmed)) {
      const fk = parseForeignKey(trimmed);
      if (fk) foreignKeys.push(fk);
      continue;
    }

    if (/^\s*PRIMARY\s+KEY/i.test(trimmed)) {
      const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch && pkMatch[1]) {
        const pkCols = pkMatch[1].split(",").map((c) => c.trim());
        primaryKeyColumns.push(...pkCols);
      }
      continue;
    }

    if (/^\s*(UNIQUE|CHECK|CONSTRAINT)/i.test(trimmed)) {
      // Skip other constraints for now
      continue;
    }

    // Parse column definition
    const column = parseColumnDefinition(trimmed);
    if (column) {
      columns.push(column);
      if (column.isPrimaryKey) {
        primaryKeyColumns.push(column.name);
      }
    }
  }

  return {
    name: tableName,
    columns,
    primaryKey: primaryKeyColumns,
    foreignKeys,
    indexes: [],
  };
}

// Split by comma, respecting parentheses
function splitByComma(str: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of str) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

// Parse a column definition
function parseColumnDefinition(def: string): ParsedColumn | null {
  // Column format: name TYPE [constraints...]
  const match = def.match(/^(\w+)\s+(\w+)(.*)$/i);
  if (!match) return null;

  const name = match[1];
  const typeStr = match[2];
  const constraintsStr = match[3];

  if (!name || !typeStr) return null;

  const type = typeStr.toUpperCase();
  const constraints = constraintsStr ? constraintsStr.toUpperCase() : "";

  const isPrimaryKey = /PRIMARY\s+KEY/i.test(constraints);
  const isAutoIncrement = /AUTOINCREMENT/i.test(constraints);
  const nullable = !(/NOT\s+NULL/i.test(constraints) || isPrimaryKey);

  let defaultValue: string | null = null;
  const defaultMatch = def.match(
    /DEFAULT\s+(.+?)(?:\s+(?:NOT\s+NULL|PRIMARY|FOREIGN|UNIQUE|CHECK|$))/i
  );
  if (defaultMatch && defaultMatch[1]) {
    defaultValue = defaultMatch[1].trim();
  } else {
    // Try simpler match for end of string defaults
    const simpleDefaultMatch = def.match(/DEFAULT\s+(\S+)\s*$/i);
    if (simpleDefaultMatch && simpleDefaultMatch[1]) {
      defaultValue = simpleDefaultMatch[1].trim();
    }
  }

  return {
    name,
    type,
    nullable,
    isPrimaryKey,
    isAutoIncrement,
    defaultValue,
  };
}

// Parse a FOREIGN KEY constraint
function parseForeignKey(constraint: string): ParsedForeignKey | null {
  const match = constraint.match(
    /FOREIGN\s+KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\s*\((\w+)\)(?:\s+ON\s+DELETE\s+(\w+))?(?:\s+ON\s+UPDATE\s+(\w+))?/i
  );

  if (!match) return null;

  const column = match[1];
  const referencesTable = match[2];
  const referencesColumn = match[3];

  if (!column || !referencesTable || !referencesColumn) return null;

  return {
    column,
    referencesTable,
    referencesColumn,
    onDelete: match[4] ?? null,
    onUpdate: match[5] ?? null,
  };
}

// Parse a CREATE INDEX statement
function parseCreateIndex(sql: string): { tableName: string; index: ParsedIndex } | null {
  const match = sql.match(
    /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\)/i
  );

  if (!match) return null;

  const isUnique = !!match[1];
  const indexName = match[2];
  const tableName = match[3];
  const columnsStr = match[4];

  if (!indexName || !tableName || !columnsStr) return null;

  const columns = columnsStr.split(",").map((c) => c.trim());

  return {
    tableName,
    index: {
      name: indexName,
      columns,
      isUnique,
    },
  };
}

export function parseSchemaFile(filePath: string): ParsedSchema {
  const content = readFileSync(filePath, "utf-8");
  const sqlStrings = extractSqlStrings(content);

  const tables: Map<string, ParsedTable> = new Map();

  for (const sql of sqlStrings) {
    // Try parsing as CREATE TABLE
    if (/CREATE\s+TABLE/i.test(sql)) {
      const table = parseCreateTable(sql);
      if (table) {
        tables.set(table.name, table);
      }
    }

    // Try parsing as CREATE INDEX
    if (/CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(sql)) {
      const indexResult = parseCreateIndex(sql);
      if (indexResult) {
        const table = tables.get(indexResult.tableName);
        if (table) {
          table.indexes.push(indexResult.index);
        }
      }
    }
  }

  return {
    tables: Array.from(tables.values()),
  };
}
