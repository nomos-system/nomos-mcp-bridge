import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Controller } from './config.js';

let activeClient: Client | null = null;
let activeTransport: StreamableHTTPClientTransport | null = null;
let activeControllerInfo: Controller | null = null;

export interface ConnectionInfo {
    id: string;
    name: string;
    url: string;
}

export async function connect(controller: Controller): Promise<{ name: string; url: string }> {
    await disconnect();

    const url = new URL(controller.url);

    const transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
            headers: {
                'Authorization': 'Bearer ' + controller.token,
            },
        },
    });

    const client = new Client({
        name: 'nomos-mcp-bridge',
        version: '1.0.0',
    });

    await client.connect(transport);

    activeClient = client;
    activeTransport = transport;
    activeControllerInfo = controller;

    return { name: controller.name, url: controller.url };
}

export async function disconnect(): Promise<void> {
    if (activeTransport) {
        try { await activeTransport.terminateSession(); } catch { /* ignore */ }
    }
    if (activeClient) {
        try { await activeClient.close(); } catch { /* ignore */ }
    }
    activeClient = null;
    activeTransport = null;
    activeControllerInfo = null;
}

export function isConnected(): boolean {
    return activeClient !== null;
}

export function getConnectionInfo(): ConnectionInfo | null {
    if (!activeControllerInfo) return null;
    return {
        id: activeControllerInfo.id,
        name: activeControllerInfo.name,
        url: activeControllerInfo.url,
    };
}

export function getClient(): Client | null {
    return activeClient;
}

function ensureClient(): Client {
    if (!activeClient) throw new Error('Not connected to any controller.');
    return activeClient;
}

export async function listTools() {
    const client = ensureClient();
    const allTools: Awaited<ReturnType<Client['listTools']>>['tools'] = [];
    let cursor: string | undefined;
    do {
        const result = await client.listTools({ cursor });
        allTools.push(...result.tools);
        cursor = result.nextCursor;
    } while (cursor);
    return allTools;
}

export async function callTool(name: string, args?: Record<string, unknown>) {
    const client = ensureClient();
    return await client.callTool({ name, arguments: args ?? {} });
}

export async function listResources() {
    const client = ensureClient();
    const allResources: Awaited<ReturnType<Client['listResources']>>['resources'] = [];
    let cursor: string | undefined;
    do {
        const result = await client.listResources({ cursor });
        allResources.push(...result.resources);
        cursor = result.nextCursor;
    } while (cursor);
    return allResources;
}

export async function listResourceTemplates() {
    const client = ensureClient();
    const allTemplates: Awaited<ReturnType<Client['listResourceTemplates']>>['resourceTemplates'] = [];
    let cursor: string | undefined;
    do {
        const result = await client.listResourceTemplates({ cursor });
        allTemplates.push(...result.resourceTemplates);
        cursor = result.nextCursor;
    } while (cursor);
    return allTemplates;
}

export async function readResource(uri: string) {
    const client = ensureClient();
    return await client.readResource({ uri });
}

export async function listPrompts() {
    const client = ensureClient();
    const allPrompts: Awaited<ReturnType<Client['listPrompts']>>['prompts'] = [];
    let cursor: string | undefined;
    do {
        const result = await client.listPrompts({ cursor });
        allPrompts.push(...result.prompts);
        cursor = result.nextCursor;
    } while (cursor);
    return allPrompts;
}

export async function getPrompt(name: string, args?: Record<string, string>) {
    const client = ensureClient();
    return await client.getPrompt({ name, arguments: args ?? {} });
}

export function getInstructions(): string | undefined {
    if (!activeClient) return undefined;
    return activeClient.getInstructions();
}
