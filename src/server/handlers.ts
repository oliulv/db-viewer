import type { ServerContext, Relationship } from "./types.ts";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function handleGetSchema(context: ServerContext): Response {
  if (!context.schema) {
    return jsonResponse({ error: "No schema file configured" }, 404);
  }
  return jsonResponse(context.schema);
}

export function handleGetFunctions(context: ServerContext): Response {
  if (!context.functions) {
    return jsonResponse({ error: "No functions file configured" }, 404);
  }
  return jsonResponse(context.functions);
}

export function handleGetRelationships(context: ServerContext): Response {
  if (!context.schema) {
    return jsonResponse({ error: "No schema file configured" }, 404);
  }

  const relationships: Relationship[] = [];

  for (const table of context.schema.tables) {
    for (const fk of table.foreignKeys) {
      relationships.push({
        fromTable: table.name,
        fromColumn: fk.column,
        toTable: fk.referencesTable,
        toColumn: fk.referencesColumn,
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      });
    }
  }

  return jsonResponse({ relationships });
}

export function handleGetInfo(context: ServerContext): Response {
  return jsonResponse({
    schemaPath: context.schemaPath,
    functionsPath: context.functionsPath,
    tableCount: context.schema?.tables.length ?? 0,
    functionCount: context.functions?.functions.filter((f) => f.isExported).length ?? 0,
  });
}
