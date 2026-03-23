const {Client} = require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

var activeClient = null;
var activeTransport = null;
var activeControllerInfo = null;

/**
 * Connect to a nomos controller via Streamable HTTP.
 * @param {Object} controller - { id, name, url, token }
 * @returns {Promise<Object>} - Server capabilities & info
 */
async function connect(controller) {
    // Disconnect any existing connection first
    await disconnect();

    var url = new URL(controller.url);

    var transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
            headers: {
                'Authorization': 'Bearer ' + controller.token,
            },
        },
    });

    var client = new Client({
        name: 'nomos-mcp-bridge',
        version: '1.0.0',
    });

    await client.connect(transport);

    activeClient = client;
    activeTransport = transport;
    activeControllerInfo = controller;

    return {
        name: controller.name,
        url: controller.url,
    };
}

/**
 * Disconnect from the current controller.
 */
async function disconnect() {
    if(activeTransport) {
        try {
            await activeTransport.terminateSession();
        }
        catch(e) {
            // Ignore — transport may already be closed
        }
    }
    if(activeClient) {
        try {
            await activeClient.close();
        }
        catch(e) {
            // Ignore
        }
    }
    activeClient = null;
    activeTransport = null;
    activeControllerInfo = null;
}

/**
 * Check if we are currently connected.
 */
function isConnected() {
    return activeClient !== null;
}

/**
 * Get info about the current connection.
 */
function getConnectionInfo() {
    if(!activeControllerInfo) return null;
    return {
        id: activeControllerInfo.id,
        name: activeControllerInfo.name,
        url: activeControllerInfo.url,
    };
}

/**
 * Get the active MCP client (for proxying requests).
 */
function getClient() {
    return activeClient;
}

/**
 * List tools from the connected controller.
 */
async function listTools() {
    if(!activeClient) throw new Error('Not connected to any controller.');
    var allTools = [];
    var cursor;
    do {
        var result = await activeClient.listTools({cursor: cursor});
        allTools.push.apply(allTools, result.tools);
        cursor = result.nextCursor;
    } while(cursor);
    return allTools;
}

/**
 * Call a tool on the connected controller.
 */
async function callTool(name, args) {
    if(!activeClient) throw new Error('Not connected to any controller.');
    return await activeClient.callTool({name: name, arguments: args || {}});
}

/**
 * List resources from the connected controller.
 */
async function listResources() {
    if(!activeClient) throw new Error('Not connected to any controller.');
    var allResources = [];
    var cursor;
    do {
        var result = await activeClient.listResources({cursor: cursor});
        allResources.push.apply(allResources, result.resources);
        cursor = result.nextCursor;
    } while(cursor);
    return allResources;
}

/**
 * List resource templates from the connected controller.
 */
async function listResourceTemplates() {
    if(!activeClient) throw new Error('Not connected to any controller.');
    var allTemplates = [];
    var cursor;
    do {
        var result = await activeClient.listResourceTemplates({cursor: cursor});
        allTemplates.push.apply(allTemplates, result.resourceTemplates);
        cursor = result.nextCursor;
    } while(cursor);
    return allTemplates;
}

/**
 * Read a resource from the connected controller.
 */
async function readResource(uri) {
    if(!activeClient) throw new Error('Not connected to any controller.');
    return await activeClient.readResource({uri: uri});
}

/**
 * List prompts from the connected controller.
 */
async function listPrompts() {
    if(!activeClient) throw new Error('Not connected to any controller.');
    var allPrompts = [];
    var cursor;
    do {
        var result = await activeClient.listPrompts({cursor: cursor});
        allPrompts.push.apply(allPrompts, result.prompts);
        cursor = result.nextCursor;
    } while(cursor);
    return allPrompts;
}

/**
 * Get a prompt from the connected controller.
 */
async function getPrompt(name, args) {
    if(!activeClient) throw new Error('Not connected to any controller.');
    return await activeClient.getPrompt({name: name, arguments: args || {}});
}

/**
 * Get server instructions from the connected controller.
 */
function getInstructions() {
    if(!activeClient) return null;
    return activeClient.getInstructions();
}

module.exports = {
    connect: connect,
    disconnect: disconnect,
    isConnected: isConnected,
    getConnectionInfo: getConnectionInfo,
    getClient: getClient,
    listTools: listTools,
    callTool: callTool,
    listResources: listResources,
    listResourceTemplates: listResourceTemplates,
    readResource: readResource,
    listPrompts: listPrompts,
    getPrompt: getPrompt,
    getInstructions: getInstructions,
};
