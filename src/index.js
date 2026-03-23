#!/usr/bin/env node

const {McpServer} = require('@modelcontextprotocol/sdk/server/mcp.js');
const {StdioServerTransport} = require('@modelcontextprotocol/sdk/server/stdio.js');
const {z} = require('zod');
const config = require('./config');
const proxy = require('./proxy');
const authServer = require('./auth/server');

// ── Stderr logging (stdout is reserved for MCP stdio transport) ──

function log(msg) {
    process.stderr.write('[nomos-mcp-bridge] ' + msg + '\n');
}

// ── Bridge MCP Server ────────────────────────

var server = new McpServer({
    name: 'nomos-mcp-bridge',
    version: '1.0.0',
    instructions: 'This is a nomos MCP Bridge that manages connections to one or more nomos smart home controllers.\n\n'
        + '## Getting Started\n'
        + '1. Use `list_controllers` to see registered controllers.\n'
        + '2. If no controllers are registered, use `add_controller` or `open_setup` to add one.\n'
        + '3. Use `select_controller` to connect to a controller by name.\n'
        + '4. Once connected, all nomos tools, resources, and prompts from that controller become available.\n\n'
        + '## Switching Controllers\n'
        + 'Call `select_controller` with a different name to disconnect from the current controller and connect to another.\n\n'
        + '## Important\n'
        + '- You must select a controller before you can use any nomos tools.\n'
        + '- After selecting a controller, the bridge dynamically exposes all tools, resources, and prompts from that controller.\n',
});

// ── Bridge Management Tools ──────────────────

server.registerTool(
    'list_controllers',
    {
        title: 'List Controllers',
        description: 'Lists all registered nomos controllers with their names, URLs, and which one is currently active.',
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        inputSchema: {},
    },
    function() {
        var controllers = config.getControllers();
        var activeId = config.getActiveControllerId();
        var connected = proxy.getConnectionInfo();

        var list = controllers.map(function(c) {
            return {
                id: c.id,
                name: c.name,
                url: c.url,
                isActive: c.id === activeId,
                isConnected: connected !== null && connected.id === c.id,
            };
        });

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({controllers: list, total: list.length}, null, 2),
            }],
        };
    }
);

server.registerTool(
    'select_controller',
    {
        title: 'Select Controller',
        description: 'Connects to a nomos controller by name. Disconnects from any previously connected controller. After connecting, all tools, resources, and prompts from that controller become available.',
        annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true},
        inputSchema: {
            name: z.string().describe('The name of the controller to connect to (as shown in list_controllers).'),
        },
    },
    async function(args) {
        var controller = config.getControllerByName(args.name);
        if(!controller) {
            return {
                content: [{type: 'text', text: 'Controller not found: "' + args.name + '". Use list_controllers to see available controllers.'}],
                isError: true,
            };
        }

        try {
            config.setActiveControllerId(controller.id);
            var info = await proxy.connect(controller);

            // Re-register proxied tools, resources, prompts
            await registerProxiedCapabilities();

            return {
                content: [{
                    type: 'text',
                    text: 'Connected to controller "' + info.name + '" at ' + info.url + '. All nomos tools, resources, and prompts are now available.',
                }],
            };
        }
        catch(e) {
            return {
                content: [{type: 'text', text: 'Failed to connect to "' + args.name + '": ' + e.message}],
                isError: true,
            };
        }
    }
);

server.registerTool(
    'add_controller',
    {
        title: 'Add Controller',
        description: 'Registers a new nomos controller. If this is the first controller, it is automatically selected.',
        annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false},
        inputSchema: {
            name: z.string().describe('A friendly name for the controller (e.g. "Wohnhaus", "Büro")'),
            url: z.string().describe('The base URL of the controller (e.g. "https://192.168.1.100"). The /mcp path is appended automatically.'),
            token: z.string().describe('The MCP Bearer token from the nomos controller settings.'),
        },
    },
    function(args) {
        var url = args.url.replace(/\/+$/, '');
        if(!url.endsWith('/mcp')) {
            url += '/mcp';
        }

        try {
            var entry = config.addController({name: args.name, url: url, token: args.token});
            return {
                content: [{
                    type: 'text',
                    text: 'Controller "' + entry.name + '" added successfully (ID: ' + entry.id + ').'
                        + (config.getControllers().length === 1 ? ' It has been automatically selected. Use select_controller to connect.' : ''),
                }],
            };
        }
        catch(e) {
            return {
                content: [{type: 'text', text: 'Error: ' + e.message}],
                isError: true,
            };
        }
    }
);

server.registerTool(
    'remove_controller',
    {
        title: 'Remove Controller',
        description: 'Removes a registered controller by name. If it is the currently connected controller, the connection is closed.',
        annotations: {readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false},
        inputSchema: {
            name: z.string().describe('The name of the controller to remove.'),
        },
    },
    async function(args) {
        var controller = config.getControllerByName(args.name);
        if(!controller) {
            return {
                content: [{type: 'text', text: 'Controller not found: "' + args.name + '".'}],
                isError: true,
            };
        }

        // If this is the connected controller, disconnect first
        var connected = proxy.getConnectionInfo();
        if(connected && connected.id === controller.id) {
            await proxy.disconnect();
        }

        try {
            config.removeController(controller.id);
            return {
                content: [{
                    type: 'text',
                    text: 'Controller "' + args.name + '" has been removed.',
                }],
            };
        }
        catch(e) {
            return {
                content: [{type: 'text', text: 'Error: ' + e.message}],
                isError: true,
            };
        }
    }
);

server.registerTool(
    'open_setup',
    {
        title: 'Open Setup Page',
        description: 'Opens the nomos MCP Bridge setup page in the default browser, where controllers can be added via a web form.',
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true},
        inputSchema: {},
    },
    async function() {
        try {
            var url = await authServer.start();
            // Dynamic import for ESM-only 'open' package
            var open = (await import('open')).default;
            await open(url);
            return {
                content: [{
                    type: 'text',
                    text: 'Setup page opened in browser at ' + url + '. Add your controller there and then use list_controllers to verify.',
                }],
            };
        }
        catch(e) {
            return {
                content: [{type: 'text', text: 'Failed to open setup page: ' + e.message}],
                isError: true,
            };
        }
    }
);

server.registerTool(
    'connection_status',
    {
        title: 'Connection Status',
        description: 'Shows the current connection status — which controller is connected and whether the connection is active.',
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        inputSchema: {},
    },
    function() {
        var connected = proxy.getConnectionInfo();
        if(!connected) {
            return {
                content: [{
                    type: 'text',
                    text: 'Not connected to any controller. Use select_controller to connect.',
                }],
            };
        }
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({connected: true, controller: connected}, null, 2),
            }],
        };
    }
);

// ── Dynamic Proxy Registration ───────────────

// Track registered proxy tool/resource/prompt names so we can avoid duplicates
var registeredProxyTools = new Set();
var registeredProxyResources = new Set();
var registeredProxyPrompts = new Set();

/**
 * After connecting to a controller, fetch its tools, resources, and prompts
 * and register them on our local MCP server so Claude can discover them.
 */
async function registerProxiedCapabilities() {
    // ── Tools ────────────────────────
    try {
        var tools = await proxy.listTools();
        tools.forEach(function(tool) {
            if(registeredProxyTools.has(tool.name)) return;  // Already registered

            // Build a Zod schema from the tool's inputSchema
            var zodSchema = {};
            if(tool.inputSchema && tool.inputSchema.properties) {
                var props = tool.inputSchema.properties;
                var required = tool.inputSchema.required || [];
                Object.keys(props).forEach(function(key) {
                    var prop = props[key];
                    var zodType = jsonSchemaToZod(prop);
                    if(required.indexOf(key) === -1) {
                        zodType = zodType.optional();
                    }
                    if(prop.description) {
                        zodType = zodType.describe(prop.description);
                    }
                    zodSchema[key] = zodType;
                });
            }

            server.registerTool(
                tool.name,
                {
                    title: tool.title || tool.name,
                    description: tool.description || '',
                    annotations: tool.annotations || {},
                    inputSchema: zodSchema,
                },
                async function(args) {
                    try {
                        return await proxy.callTool(tool.name, args);
                    }
                    catch(e) {
                        return {
                            content: [{type: 'text', text: 'Error calling ' + tool.name + ': ' + e.message}],
                            isError: true,
                        };
                    }
                }
            );
            registeredProxyTools.add(tool.name);
        });
    }
    catch(e) {
        log('Error registering proxied tools: ' + e.message);
    }

    // ── Resources ────────────────────
    try {
        var resources = await proxy.listResources();
        resources.forEach(function(resource) {
            if(registeredProxyResources.has(resource.uri)) return;
            server.registerResource(
                resource.name || resource.uri,
                resource.uri,
                {description: resource.description || '', mimeType: resource.mimeType},
                async function(uri) {
                    try {
                        var result = await proxy.readResource(uri.href);
                        return result;
                    }
                    catch(e) {
                        return {contents: [{uri: uri.href, text: 'Error: ' + e.message}]};
                    }
                }
            );
            registeredProxyResources.add(resource.uri);
        });
    }
    catch(e) {
        log('Error registering proxied resources: ' + e.message);
    }

    // ── Prompts ──────────────────────
    try {
        var prompts = await proxy.listPrompts();
        prompts.forEach(function(prompt) {
            if(registeredProxyPrompts.has(prompt.name)) return;

            // Build Zod schema for prompt arguments
            var zodArgs = {};
            if(prompt.arguments && prompt.arguments.length > 0) {
                prompt.arguments.forEach(function(arg) {
                    var zodType = z.string();
                    if(arg.description) zodType = zodType.describe(arg.description);
                    if(!arg.required) zodType = zodType.optional();
                    zodArgs[arg.name] = zodType;
                });
            }

            server.registerPrompt(
                prompt.name,
                {description: prompt.description || ''},
                async function(args) {
                    try {
                        return await proxy.getPrompt(prompt.name, args);
                    }
                    catch(e) {
                        return {messages: [{role: 'user', content: {type: 'text', text: 'Error: ' + e.message}}]};
                    }
                }
            );
            registeredProxyPrompts.add(prompt.name);
        });
    }
    catch(e) {
        log('Error registering proxied prompts: ' + e.message);
    }
}

/**
 * Convert a JSON Schema property to a Zod type.
 */
function jsonSchemaToZod(prop) {
    if(prop.enum) {
        if(prop.enum.length > 0) {
            return z.enum(prop.enum);
        }
    }

    switch(prop.type) {
        case 'string':
            return z.string();
        case 'number':
        case 'integer':
            return z.number();
        case 'boolean':
            return z.boolean();
        case 'array':
            if(prop.items) {
                return z.array(jsonSchemaToZod(prop.items));
            }
            return z.array(z.any());
        case 'object':
            return z.object({}).passthrough();
        default:
            return z.any();
    }
}

// ── Startup ──────────────────────────────────

async function main() {
    log('Starting nomos MCP Bridge...');
    log('Config directory: ' + config.CONFIG_DIR);

    // Auto-connect to the active controller if one is configured
    var activeController = config.getActiveController();
    if(activeController) {
        log('Auto-connecting to "' + activeController.name + '" at ' + activeController.url);
        try {
            await proxy.connect(activeController);
            await registerProxiedCapabilities();
            log('Connected to "' + activeController.name + '".');
        }
        catch(e) {
            log('Auto-connect failed: ' + e.message + '. Use select_controller to connect manually.');
        }
    }
    else {
        var controllers = config.getControllers();
        if(controllers.length === 0) {
            log('No controllers registered. Use add_controller or open_setup to add one.');
        }
        else {
            log(controllers.length + ' controller(s) registered. Use select_controller to connect.');
        }
    }

    // Start the local setup web server in the background
    try {
        await authServer.start();
        log('Setup page available at ' + authServer.getAuthUrl());
    }
    catch(e) {
        log('Warning: Could not start setup web server: ' + e.message);
    }

    // Connect to Claude via stdio
    var transport = new StdioServerTransport();
    await server.connect(transport);
    log('MCP Bridge ready (stdio transport).');
}

main().catch(function(e) {
    process.stderr.write('[nomos-mcp-bridge] Fatal error: ' + e.message + '\n');
    process.exit(1);
});
