import http from 'http';
import * as config from '../config.js';
import { setupPage, successPage } from './pages.js';

let authPort = 18900;
let authServer: http.Server | null = null;

export function getAuthUrl(): string {
    return 'http://localhost:' + authPort;
}

export function getAuthPort(): number {
    return authPort;
}

export function start(): Promise<string> {
    return new Promise((resolve, reject) => {
        if (authServer) {
            resolve(getAuthUrl());
            return;
        }

        authServer = http.createServer(handleRequest);

        authServer.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                authPort++;
                authServer!.listen(authPort, '127.0.0.1');
            } else {
                reject(err);
            }
        });

        authServer.listen(authPort, '127.0.0.1', () => {
            resolve(getAuthUrl());
        });
    });
}

export function stop(): Promise<void> {
    return new Promise(resolve => {
        if (authServer) {
            authServer.close(() => {
                authServer = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && parsedUrl.pathname === '/') {
        serveSetupPage(res, null);
        return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/add') {
        handleAddController(req, res);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}

function serveSetupPage(res: http.ServerResponse, message: { type: 'error' | 'success'; text: string } | null): void {
    const controllers = config.getControllers();
    const activeId = config.getActiveControllerId();
    const viewControllers = controllers.map(c => ({
        name: c.name,
        url: c.url,
        isActive: c.id === activeId,
    }));
    const html = setupPage(viewControllers, message);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

function handleAddController(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
    });
    req.on('end', () => {
        const params = new URLSearchParams(body);
        const name = (params.get('name') ?? '').trim();
        let url = (params.get('url') ?? '').trim();
        const token = (params.get('token') ?? '').trim();

        if (!name || !url || !token) {
            serveSetupPage(res, { type: 'error', text: 'All fields are required.' });
            return;
        }

        // Normalize URL: strip trailing slash, append /mcp if missing
        url = url.replace(/\/+$/, '');
        if (!url.endsWith('/mcp')) {
            url += '/mcp';
        }

        try {
            const entry = config.addController({ name, url, token });
            const html = successPage(entry.name);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            serveSetupPage(res, { type: 'error', text: message });
        }
    });
}
