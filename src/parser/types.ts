// Schema types
export interface ParsedColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  defaultValue: string | null;
}

export interface ParsedForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete: string | null;
  onUpdate: string | null;
}

export interface ParsedIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
  primaryKey: string[];
  foreignKeys: ParsedForeignKey[];
  indexes: ParsedIndex[];
}

export interface ParsedSchema {
  tables: ParsedTable[];
}

// Function types
export interface ParsedParam {
  name: string;
  type: string;
}

export interface ExtractedQuery {
  sql: string;
  type: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";
}

export interface ParsedFunction {
  name: string;
  params: ParsedParam[];
  returnType: string;
  sqlQueries: ExtractedQuery[];
  tablesUsed: string[];
  isExported: boolean;
}

export interface ParsedFunctions {
  functions: ParsedFunction[];
}
