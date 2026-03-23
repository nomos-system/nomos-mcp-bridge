# nomos MCP Bridge

A local MCP proxy that manages connections to one or more [nomos](https://nomos-system.com) system controllers. Instead of configuring each controller individually in your Claude Desktop config, the bridge lets you register multiple controllers and switch between them via natural language.

## How It Works

```
Claude Desktop ──stdio──► nomos-mcp-bridge ──Streamable HTTP──► nomos Controller A
                          (local proxy)    ──Streamable HTTP──► nomos Controller B
                                           ──Streamable HTTP──► nomos Controller C
```

The bridge runs as a local MCP server (via stdio) and connects to nomos controllers over the network using the MCP Streamable HTTP transport. All tools, resources, and prompts from the connected controller are dynamically proxied — the bridge stays lightweight and always exposes exactly the capabilities the controller supports.

## Prerequisites

- **Node.js** 18 or later
- A **nomos system controller** with MCP enabled (Settings > MCP) and a configured token
- **Network access** to the controller from your machine

## Installation

```bash
# Clone the repository
git clone https://github.com/nomos-system/nomos-mcp-bridge.git
cd nomos-mcp-bridge

# Install dependencies and build
npm install
npm run build
```

## Claude Desktop Configuration

Add the bridge to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nomos": {
      "command": "node",
      "args": ["/path/to/nomos-mcp-bridge/dist/index.js"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "nomos": {
      "command": "nomos-mcp-bridge"
    }
  }
}
```

## Adding Controllers

### Option 1: Via the Setup Web Page

Tell Claude to **open the setup page**:

> "Open the nomos setup page"

This opens a local web UI in your browser where you can enter the controller name, URL, and MCP token.

### Option 2: Via Claude

Tell Claude to add a controller:

> "Add my nomos controller 'Wohnhaus' at 192.168.1.100 with token abc123"

Claude will use the `add_controller` tool to register it.

### Option 3: Manually

Edit `~/.config/nomos-mcp/controllers.json`:

```json
{
  "controllers": [
    {
      "id": "some-uuid",
      "name": "Wohnhaus",
      "url": "https://192.168.1.100/mcp",
      "token": "your-mcp-token"
    }
  ],
  "activeControllerId": "some-uuid"
}
```

## Usage

Once controllers are registered, simply tell Claude which one to use:

> "Connect to controller Wohnhaus"

> "Switch to Büro controller"

> "Show me all my controllers"

After connecting, all nomos tools are available as if Claude were directly connected to the controller. You can:

- Control devices ("Turn off the living room lights")
- Create scenes and automations
- Check system status
- Configure the smart home

## Bridge Tools

The bridge provides these management tools:

| Tool | Description |
|------|-------------|
| `list_controllers` | List all registered controllers |
| `select_controller` | Connect to a controller by name |
| `add_controller` | Register a new controller |
| `remove_controller` | Remove a registered controller |
| `open_setup` | Open the setup web page in the browser |
| `connection_status` | Show current connection status |

## Configuration

Controller credentials are stored in `~/.config/nomos-mcp/controllers.json`. The setup web server runs on `http://localhost:18900` (auto-increments if the port is in use).

## Security Notes

- Tokens are stored in plain text in the config file. Ensure appropriate file permissions.
- The setup web server only listens on `127.0.0.1` (localhost) and is not accessible from the network.
- nomos controllers use HTTPS with self-signed certificates by default. Node.js may reject these — set `NODE_TLS_REJECT_UNAUTHORIZED=0` in the Claude Desktop config if needed:

```json
{
  "mcpServers": {
    "nomos": {
      "command": "node",
      "args": ["/path/to/nomos-mcp-bridge/dist/index.js"],
      "env": {
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

## Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript to dist/
npm run start      # Run the compiled bridge
npm run dev        # Build and run in one step
```

## License

MIT
