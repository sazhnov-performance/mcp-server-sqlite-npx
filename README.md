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

## Testing with Claude Desktop

Add the following to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/index.js",
        "/absolute/path/to/database.db"
      ]
    }
  }
}
```

Examples:

- `/absolute/path/to/node`: `/Users/johnny/.nvm/versions/node/v20.18.1/bin/node`
- `/absolute/path/to/index.js`: `/Users/johnny/projects/mcp-server-sqlite-npx/dist/index.js`
- `/absolute/path/to/database.db`: `/Users/johnny/projects/database.db`

## Publish

- Bump version in package.json
- `npm install`
- Commit with message: `Release {version, e.g. 0.1.6}`

## Use Released Version

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "/absolute/path/to/npx",
      "args": [
        "-y",
        "mcp-server-sqlite-npx",
        "/absolute/path/to/database.db"
      ]
    }
  }
}
```
