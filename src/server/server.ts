import { parseSchemaFile } from "../parser/schema-parser.ts";
import { parseFunctionsFile } from "../parser/function-parser.ts";
import type { ServerConfig, ServerContext } from "./types.ts";
import {
  handleGetSchema,
  handleGetFunctions,
  handleGetRelationships,
  handleGetInfo,
} from "./handlers.ts";
import { existsSync } from "fs";
import { join, dirname } from "path";

function getWebDir(): string {
  // Resolve relative to this file's location
  const currentDir = dirname(new URL(import.meta.url).pathname);
  return join(currentDir, "..", "web");
}

function serveStaticFile(filePath: string): Response | null {
  const webDir = getWebDir();
  const fullPath = join(webDir, filePath);

  if (!existsSync(fullPath)) {
    return null;
  }

  const file = Bun.file(fullPath);
  const contentType = getContentType(filePath);

  return new Response(file, {
    headers: { "Content-Type": contentType },
  });
}

function getContentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "text/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  return "text/plain";
}

export function startServer(config: ServerConfig): void {
  // Parse files
  const context: ServerContext = {
    schema: null,
    functions: null,
    schemaPath: config.schemaPath,
    functionsPath: config.functionsPath,
  };

  if (config.schemaPath && existsSync(config.schemaPath)) {
    try {
      context.schema = parseSchemaFile(config.schemaPath);
      console.log(`Parsed schema: ${context.schema.tables.length} tables`);
    } catch (error) {
      console.error(`Error parsing schema: ${error}`);
    }
  }

  if (config.functionsPath && existsSync(config.functionsPath)) {
    try {
      context.functions = parseFunctionsFile(config.functionsPath);
      const exported = context.functions.functions.filter((f) => f.isExported);
      console.log(`Parsed functions: ${exported.length} exported functions`);
    } catch (error) {
      console.error(`Error parsing functions: ${error}`);
    }
  }

  const server = Bun.serve({
    port: config.port,
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      // API routes
      if (path === "/api/schema") {
        return handleGetSchema(context);
      }
      if (path === "/api/functions") {
        return handleGetFunctions(context);
      }
      if (path === "/api/relationships") {
        return handleGetRelationships(context);
      }
      if (path === "/api/info") {
        return handleGetInfo(context);
      }

      // Static files
      if (path === "/" || path === "/index.html") {
        const response = serveStaticFile("index.html");
        if (response) return response;
      }

      if (path.startsWith("/")) {
        const response = serveStaticFile(path.slice(1));
        if (response) return response;
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`\ndb-viewer running at http://localhost:${server.port}`);

  if (config.openBrowser) {
    const openCommand =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";

    Bun.spawn([openCommand, `http://localhost:${server.port}`]);
  }
}
