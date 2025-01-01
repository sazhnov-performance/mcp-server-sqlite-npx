#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from '@modelcontextprotocol/sdk/types.js';
import sqlite3 from 'sqlite3';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import path from 'path';

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: mcp-server-sqlite-npx <database-path>');
  process.exit(1);
}

const dbPath = path.resolve(args[0]);

// Schema definitions
const ReadQueryArgsSchema = z.object({
  query: z.string().describe('SELECT SQL query to execute'),
});

const WriteQueryArgsSchema = z.object({
  query: z
    .string()
    .describe('INSERT, UPDATE, or DELETE SQL query to execute'),
});

const CreateTableArgsSchema = z.object({
  query: z.string().describe('CREATE TABLE SQL statement'),
});

const DescribeTableArgsSchema = z.object({
  table_name: z.string().describe('Name of the table to describe'),
});

interface RunResult {
  affectedRows: number;
}

/**
 * Wrapper for sqlite3.Database that bridges CommonJS and ESM modules.
 * This abstraction is necessary because:
 * 1. sqlite3 is a CommonJS module while we're using ESM (type: "module")
 * 2. The module interop requires careful handling of the Database import
 * 3. We need to promisify the callback-based API to work better with async/await
 */
class DatabaseWrapper {
  private readonly db: sqlite3.Database;

  constructor(filename: string) {
    this.db = new sqlite3.Database(filename);
  }

  query(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  execute(sql: string, params: any[] = []): Promise<RunResult[]> {
    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        params,
        function (this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve([{ affectedRows: this.changes }]);
        },
      );
    });
  }
}

class SqliteDatabase {
  private readonly db: DatabaseWrapper;

  constructor(dbPath: string) {
    this.db = new DatabaseWrapper(dbPath);
  }

  private async query<T>(
    sql: string,
    params: any[] = [],
  ): Promise<T[]> {
    return this.db.query(sql, params);
  }

  async listTables(): Promise<any[]> {
    return this.query(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
  }

  async describeTable(tableName: string): Promise<any[]> {
    return this.query(`PRAGMA table_info(${tableName})`);
  }

  async executeReadQuery(query: string): Promise<any[]> {
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error(
        'Only SELECT queries are allowed for read_query',
      );
    }
    return this.query(query);
  }

  async executeWriteQuery(query: string): Promise<any[]> {
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error(
        'SELECT queries are not allowed for write_query',
      );
    }
    return this.query(query);
  }

  async createTable(query: string): Promise<any[]> {
    if (!query.trim().toUpperCase().startsWith('CREATE TABLE')) {
      throw new Error('Only CREATE TABLE statements are allowed');
    }
    return this.query(query);
  }
}

// Server setup
const server = new Server(
  {
    name: 'sqlite-manager',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const db = new SqliteDatabase(dbPath);

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_query',
        description: 'Execute a SELECT query on the SQLite database',
        inputSchema: zodToJsonSchema(
          ReadQueryArgsSchema,
        ) as ToolInput,
      },
      {
        name: 'write_query',
        description:
          'Execute an INSERT, UPDATE, or DELETE query on the SQLite database',
        inputSchema: zodToJsonSchema(
          WriteQueryArgsSchema,
        ) as ToolInput,
      },
      {
        name: 'create_table',
        description: 'Create a new table in the SQLite database',
        inputSchema: zodToJsonSchema(
          CreateTableArgsSchema,
        ) as ToolInput,
      },
      {
        name: 'list_tables',
        description: 'List all tables in the SQLite database',
        inputSchema: { type: 'object', properties: {} } as ToolInput,
      },
      {
        name: 'describe_table',
        description:
          'Get the schema information for a specific table',
        inputSchema: zodToJsonSchema(
          DescribeTableArgsSchema,
        ) as ToolInput,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'read_query': {
        const parsed = ReadQueryArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(
            `Invalid arguments for read_query: ${parsed.error}`,
          );
        }
        const results = await db.executeReadQuery(parsed.data.query);
        return {
          content: [
            { type: 'text', text: JSON.stringify(results, null, 2) },
          ],
        };
      }

      case 'write_query': {
        const parsed = WriteQueryArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(
            `Invalid arguments for write_query: ${parsed.error}`,
          );
        }
        const results = await db.executeWriteQuery(parsed.data.query);
        return {
          content: [
            { type: 'text', text: JSON.stringify(results, null, 2) },
          ],
        };
      }

      case 'create_table': {
        const parsed = CreateTableArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(
            `Invalid arguments for create_table: ${parsed.error}`,
          );
        }
        await db.createTable(parsed.data.query);
        return {
          content: [
            { type: 'text', text: 'Table created successfully' },
          ],
        };
      }

      case 'list_tables': {
        const tables = await db.listTables();
        return {
          content: [
            { type: 'text', text: JSON.stringify(tables, null, 2) },
          ],
        };
      }

      case 'describe_table': {
        const parsed = DescribeTableArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(
            `Invalid arguments for describe_table: ${parsed.error}`,
          );
        }
        const schema = await db.describeTable(parsed.data.table_name);
        return {
          content: [
            { type: 'text', text: JSON.stringify(schema, null, 2) },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use console.error to show error output.
  // console.log results in JSon exception.
  console.error('SQLite MCP Server running on stdio');
  console.error('Database path:', dbPath);
}

runServer().catch(error => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
