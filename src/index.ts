#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as config from './config.js';
import * as proxy from './proxy.js';
import * as authServer from './auth/server.js';

// ── Stderr logging (stdout is reserved for MCP stdio transport) ──

function log(msg: string): void {
    process.stderr.write('[nomos-mcp-bridge] ' + msg + '\n');
}

// ── Bridge MCP Server ────────────────────────

const server = new McpServer(
    {
        name: 'nomos-mcp-bridge',
        version: '1.0.0',
    },
    {
        instructions: 'This is a nomos MCP Bridge that manages connections to one or more nomos system controllers.\n\n'
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
    }
);

// ── Bridge Management Tools ──────────────────

server.registerTool(
    'list_controllers',
    {
        title: 'List Controllers',
        description: 'Lists all registered nomos controllers with their names, URLs, and which one is currently active.',
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        inputSchema: {},
    },
    () => {
        const controllers = config.getControllers();
        const activeId = config.getActiveControllerId();
        const connected = proxy.getConnectionInfo();

        const list = controllers.map(c => ({
            id: c.id,
            name: c.name,
            url: c.url,
            isActive: c.id === activeId,
            isConnected: connected !== null && connected.id === c.id,
        }));

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({ controllers: list, total: list.length }, null, 2),
            }],
        };
    }
);

server.registerTool(
    'select_controller',
    {
        title: 'Select Controller',
        description: 'Connects to a nomos controller by name. Disconnects from any previously connected controller. After connecting, all tools, resources, and prompts from that controller become available.',
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        inputSchema: {
            name: z.string().describe('The name of the controller to connect to (as shown in list_controllers).'),
        },
    },
    async (args: { name: string }) => {
        const controller = config.getControllerByName(args.name);
        if (!controller) {
            return {
                content: [{ type: 'text' as const, text: `Controller not found: "${args.name}". Use list_controllers to see available controllers.` }],
                isError: true,
            };
        }

        try {
            config.setActiveControllerId(controller.id);
            const info = await proxy.connect(controller);
            await registerProxiedCapabilities();

            return {
                content: [{
                    type: 'text' as const,
                    text: `Connected to controller "${info.name}" at ${info.url}. All nomos tools, resources, and prompts are now available.`,
                }],
            };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            return {
                content: [{ type: 'text' as const, text: `Failed to connect to "${args.name}": ${message}` }],
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
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        inputSchema: {
            name: z.string().describe('A friendly name for the controller (e.g. "Wohnhaus", "Büro")'),
            url: z.string().describe('The base URL of the controller (e.g. "https://192.168.1.100"). The /mcp path is appended automatically.'),
            token: z.string().describe('The MCP Bearer token from the nomos controller settings.'),
        },
    },
    (args: { name: string; url: string; token: string }) => {
        let url = args.url.replace(/\/+$/, '');
        if (!url.endsWith('/mcp')) {
            url += '/mcp';
        }

        try {
            const entry = config.addController({ name: args.name, url, token: args.token });
            const autoSelected = config.getControllers().length === 1
                ? ' It has been automatically selected. Use select_controller to connect.'
                : '';
            return {
                content: [{
                    type: 'text' as const,
                    text: `Controller "${entry.name}" added successfully (ID: ${entry.id}).${autoSelected}`,
                }],
            };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            return {
                content: [{ type: 'text' as const, text: 'Error: ' + message }],
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
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
        inputSchema: {
            name: z.string().describe('The name of the controller to remove.'),
        },
    },
    async (args: { name: string }) => {
        const controller = config.getControllerByName(args.name);
        if (!controller) {
            return {
                content: [{ type: 'text' as const, text: `Controller not found: "${args.name}".` }],
                isError: true,
            };
        }

        const connected = proxy.getConnectionInfo();
        if (connected && connected.id === controller.id) {
            await proxy.disconnect();
        }

        try {
            config.removeController(controller.id);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Controller "${args.name}" has been removed.`,
                }],
            };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            return {
                content: [{ type: 'text' as const, text: 'Error: ' + message }],
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
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        inputSchema: {},
    },
    async () => {
        try {
            const url = await authServer.start();
            const open = (await import('open')).default;
            await open(url);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Setup page opened in browser at ${url}. Add your controller there and then use list_controllers to verify.`,
                }],
            };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            return {
                content: [{ type: 'text' as const, text: 'Failed to open setup page: ' + message }],
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
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        inputSchema: {},
    },
    () => {
        const connected = proxy.getConnectionInfo();
        if (!connected) {
            return {
                content: [{
                    type: 'text' as const,
                    text: 'Not connected to any controller. Use select_controller to connect.',
                }],
            };
        }
        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({ connected: true, controller: connected }, null, 2),
            }],
        };
    }
);

// ── Dynamic Proxy Registration ───────────────

const registeredProxyTools = new Set<string>();
const registeredProxyResources = new Set<string>();
const registeredProxyPrompts = new Set<string>();

interface JsonSchemaProperty {
    type?: string;
    description?: string;
    enum?: [string, ...string[]];
    items?: JsonSchemaProperty;
}

function jsonSchemaToZod(prop: JsonSchemaProperty): z.ZodTypeAny {
    if (prop.enum && prop.enum.length > 0) {
        return z.enum(prop.enum);
    }

    switch (prop.type) {
        case 'string':
            return z.string();
        case 'number':
        case 'integer':
            return z.number();
        case 'boolean':
            return z.boolean();
        case 'array':
            if (prop.items) {
                return z.array(jsonSchemaToZod(prop.items));
            }
            return z.array(z.any());
        case 'object':
            return z.object({}).passthrough();
        default:
            return z.any();
    }
}

async function registerProxiedCapabilities(): Promise<void> {
    // ── Tools ────────────────────────
    try {
        const tools = await proxy.listTools();
        for (const tool of tools) {
            if (registeredProxyTools.has(tool.name)) continue;

            const zodSchema: Record<string, z.ZodTypeAny> = {};
            const inputSchema = tool.inputSchema as {
                properties?: Record<string, JsonSchemaProperty>;
                required?: string[];
            } | undefined;

            if (inputSchema?.properties) {
                const props = inputSchema.properties;
                const required = inputSchema.required ?? [];
                for (const key of Object.keys(props)) {
                    const prop = props[key];
                    let zodType = jsonSchemaToZod(prop);
                    if (!required.includes(key)) {
                        zodType = zodType.optional();
                    }
                    if (prop.description) {
                        zodType = zodType.describe(prop.description);
                    }
                    zodSchema[key] = zodType;
                }
            }

            const toolName = tool.name;
            server.registerTool(
                toolName,
                {
                    title: (tool as { title?: string }).title ?? toolName,
                    description: tool.description ?? '',
                    annotations: (tool as { annotations?: Record<string, boolean> }).annotations ?? {},
                    inputSchema: zodSchema,
                },
                async (args: Record<string, unknown>) => {
                    try {
                        const result = await proxy.callTool(toolName, args);
                        // Normalize: SDK client may return toolResult or content
                        if (result.content) {
                            return result as { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
                        }
                        // Fallback: wrap raw result
                        return {
                            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
                        };
                    } catch (e: unknown) {
                        const message = e instanceof Error ? e.message : String(e);
                        return {
                            content: [{ type: 'text' as const, text: `Error calling ${toolName}: ${message}` }],
                            isError: true,
                        };
                    }
                }
            );
            registeredProxyTools.add(toolName);
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        log('Error registering proxied tools: ' + message);
    }

    // ── Resources ────────────────────
    try {
        const resources = await proxy.listResources();
        for (const resource of resources) {
            if (registeredProxyResources.has(resource.uri)) continue;
            const resourceUri = resource.uri;
            server.registerResource(
                resource.name ?? resourceUri,
                resourceUri,
                { description: resource.description ?? '', mimeType: resource.mimeType },
                async (uri: URL) => {
                    try {
                        return await proxy.readResource(uri.href);
                    } catch (e: unknown) {
                        const message = e instanceof Error ? e.message : String(e);
                        return { contents: [{ uri: uri.href, text: 'Error: ' + message }] };
                    }
                }
            );
            registeredProxyResources.add(resourceUri);
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        log('Error registering proxied resources: ' + message);
    }

    // ── Prompts ──────────────────────
    try {
        const prompts = await proxy.listPrompts();
        for (const prompt of prompts) {
            if (registeredProxyPrompts.has(prompt.name)) continue;

            const promptName = prompt.name;
            server.registerPrompt(
                promptName,
                { description: prompt.description ?? '' },
                async (args: Record<string, string>) => {
                    try {
                        return await proxy.getPrompt(promptName, args);
                    } catch (e: unknown) {
                        const message = e instanceof Error ? e.message : String(e);
                        return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'Error: ' + message } }] };
                    }
                }
            );
            registeredProxyPrompts.add(promptName);
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        log('Error registering proxied prompts: ' + message);
    }
}

// ── Startup ──────────────────────────────────

async function main(): Promise<void> {
    log('Starting nomos MCP Bridge...');
    log('Config directory: ' + config.CONFIG_DIR);

    // Auto-connect to the active controller if one is configured
    const activeController = config.getActiveController();
    if (activeController) {
        log(`Auto-connecting to "${activeController.name}" at ${activeController.url}`);
        try {
            await proxy.connect(activeController);
            await registerProxiedCapabilities();
            log(`Connected to "${activeController.name}".`);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            log('Auto-connect failed: ' + message + '. Use select_controller to connect manually.');
        }
    } else {
        const controllers = config.getControllers();
        if (controllers.length === 0) {
            log('No controllers registered. Use add_controller or open_setup to add one.');
        } else {
            log(controllers.length + ' controller(s) registered. Use select_controller to connect.');
        }
    }

    // Start the local setup web server in the background
    try {
        await authServer.start();
        log('Setup page available at ' + authServer.getAuthUrl());
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        log('Warning: Could not start setup web server: ' + message);
    }

    // Connect to Claude via stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('MCP Bridge ready (stdio transport).');
}

main().catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    process.stderr.write('[nomos-mcp-bridge] Fatal error: ' + message + '\n');
    process.exit(1);
});
