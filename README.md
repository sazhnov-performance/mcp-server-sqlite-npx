# MCP SQLite Server

A Node.js implementation of the Model Context Protocol SQLite server, based on the [official Python reference](https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite). This version provides an npx-based alternative for environments where Python's UVX runner is not available, such as [LibreChat](https://github.com/danny-avila/LibreChat/issues/4876#issuecomment-2561363955).

## Setup

1. Install dependencies:

```bash
npm ci
```

2. Build the TypeScript code:

```bash
npm run build
```

## Testing with MCP Inspector

You can test the server using the [MCP Inspector tool](https://modelcontextprotocol.io/docs/tools/inspector):

```bash
npx @modelcontextprotocol/inspector dist/index.js
```

Enter absolute path to database in `Arguments` in MCP Inspector.
`Connect` and go to `Tools` to start using the server.
