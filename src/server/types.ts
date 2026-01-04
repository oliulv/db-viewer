import type { ParsedSchema, ParsedFunctions } from "../parser/types.ts";

export interface ServerConfig {
  schemaPath: string;
  functionsPath: string;
  port: number;
  openBrowser: boolean;
}

export interface ServerContext {
  schema: ParsedSchema | null;
  functions: ParsedFunctions | null;
  schemaPath: string;
  functionsPath: string;
}

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  onDelete: string | null;
  onUpdate: string | null;
}
