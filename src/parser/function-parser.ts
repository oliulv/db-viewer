import { readFileSync } from "fs";
import * as ts from "typescript";
import type { ParsedFunction, ParsedParam, ExtractedQuery, ParsedFunctions } from "./types.ts";

// Extract SQL strings from a function body
function extractSqlFromNode(node: ts.Node, sourceFile: ts.SourceFile): string[] {
  const sqlStrings: string[] = [];

  function visit(n: ts.Node) {
    // Template literals
    if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const text = n.getText(sourceFile);
      // Remove backticks and clean up
      const sql = text.slice(1, -1).trim();
      if (looksLikeSql(sql)) {
        sqlStrings.push(sql);
      }
    }

    // String literals
    if (ts.isStringLiteral(n)) {
      const text = n.text;
      if (looksLikeSql(text)) {
        sqlStrings.push(text);
      }
    }

    ts.forEachChild(n, visit);
  }

  visit(node);
  return sqlStrings;
}

// Check if a string looks like SQL
function looksLikeSql(str: string): boolean {
  const sqlKeywords = /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA)/i;
  return sqlKeywords.test(str);
}

// Determine the type of SQL query
function getSqlType(sql: string): ExtractedQuery["type"] {
  const normalized = sql.trim().toUpperCase();
  if (normalized.startsWith("SELECT")) return "SELECT";
  if (normalized.startsWith("INSERT")) return "INSERT";
  if (normalized.startsWith("UPDATE")) return "UPDATE";
  if (normalized.startsWith("DELETE")) return "DELETE";
  return "OTHER";
}

// Extract table names from SQL
function extractTablesFromSql(sql: string): string[] {
  const tables: Set<string> = new Set();

  // FROM tablename
  const fromMatches = sql.matchAll(/FROM\s+(\w+)/gi);
  for (const match of fromMatches) {
    if (match[1]) tables.add(match[1]);
  }

  // JOIN tablename
  const joinMatches = sql.matchAll(/JOIN\s+(\w+)/gi);
  for (const match of joinMatches) {
    if (match[1]) tables.add(match[1]);
  }

  // INSERT INTO tablename
  const insertMatches = sql.matchAll(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/gi);
  for (const match of insertMatches) {
    if (match[1]) tables.add(match[1]);
  }

  // UPDATE tablename
  const updateMatches = sql.matchAll(/UPDATE\s+(\w+)/gi);
  for (const match of updateMatches) {
    if (match[1]) tables.add(match[1]);
  }

  // DELETE FROM tablename
  const deleteMatches = sql.matchAll(/DELETE\s+FROM\s+(\w+)/gi);
  for (const match of deleteMatches) {
    if (match[1]) tables.add(match[1]);
  }

  return Array.from(tables);
}

// Get parameter info from a function declaration
function getParams(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile): ParsedParam[] {
  return node.parameters.map((param) => {
    const name = param.name.getText(sourceFile);
    const type = param.type ? param.type.getText(sourceFile) : "unknown";
    return { name, type };
  });
}

// Get return type from a function declaration
function getReturnType(node: ts.FunctionDeclaration, sourceFile: ts.SourceFile): string {
  if (node.type) {
    return node.type.getText(sourceFile);
  }
  return "void";
}

// Check if a function is exported
function isExported(node: ts.FunctionDeclaration): boolean {
  return node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

// Get JSDoc comment for a function
function getJsDocComment(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile
): string | undefined {
  const jsDocTags = ts.getJSDocTags(node);
  if (jsDocTags.length > 0) {
    const fullText = sourceFile.getFullText();
    const nodeStart = node.getFullStart();
    const commentRanges = ts.getLeadingCommentRanges(fullText, nodeStart);
    if (commentRanges && commentRanges.length > 0) {
      const lastComment = commentRanges[commentRanges.length - 1];
      if (lastComment) {
        const commentText = fullText.slice(lastComment.pos, lastComment.end);
        // Extract description from JSDoc
        const match = commentText.match(/\/\*\*\s*\n?\s*\*?\s*([^@\n]+)/);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }
  }
  return undefined;
}

export function parseFunctionsFile(filePath: string): ParsedFunctions {
  const content = readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const functions: ParsedFunction[] = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const exported = isExported(node);

      // Extract SQL strings from function body
      const sqlStrings: string[] = [];
      if (node.body) {
        sqlStrings.push(...extractSqlFromNode(node.body, sourceFile));
      }

      // Create query objects and collect tables
      const tablesUsed: Set<string> = new Set();
      const sqlQueries: ExtractedQuery[] = sqlStrings.map((sql) => {
        extractTablesFromSql(sql).forEach((t) => tablesUsed.add(t));
        return {
          sql: sql.replace(/\s+/g, " ").trim(),
          type: getSqlType(sql),
        };
      });

      functions.push({
        name,
        params: getParams(node, sourceFile),
        returnType: getReturnType(node, sourceFile),
        sqlQueries,
        tablesUsed: Array.from(tablesUsed),
        isExported: exported,
        description: getJsDocComment(node, sourceFile),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { functions };
}
