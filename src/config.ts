import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface Controller {
    id: string;
    name: string;
    url: string;
    token: string;
}

export interface BridgeConfig {
    controllers: Controller[];
    activeControllerId: string | null;
}

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'nomos-mcp');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'controllers.json');

function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

export function load(): BridgeConfig {
    ensureConfigDir();
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data) as BridgeConfig;
    } catch {
        return { controllers: [], activeControllerId: null };
    }
}

export function save(config: BridgeConfig): void {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function getControllers(): Controller[] {
    return load().controllers;
}

export function getController(id: string): Controller | null {
    const config = load();
    return config.controllers.find(c => c.id === id) ?? null;
}

export function getControllerByName(name: string): Controller | null {
    const config = load();
    const lower = name.toLowerCase();
    return config.controllers.find(c => c.name.toLowerCase() === lower) ?? null;
}

export function addController(controller: { name: string; url: string; token: string }): Controller {
    const config = load();

    const existing = config.controllers.find(
        c => c.name.toLowerCase() === controller.name.toLowerCase()
    );
    if (existing) {
        throw new Error(`A controller with the name "${controller.name}" already exists.`);
    }

    const entry: Controller = {
        id: crypto.randomUUID(),
        name: controller.name,
        url: controller.url,
        token: controller.token,
    };
    config.controllers.push(entry);

    // Auto-select if this is the only controller
    if (config.controllers.length === 1) {
        config.activeControllerId = entry.id;
    }

    save(config);
    return entry;
}

export function updateController(id: string, updates: Partial<Omit<Controller, 'id'>>): Controller {
    const config = load();
    const controller = config.controllers.find(c => c.id === id);
    if (!controller) {
        throw new Error('Controller not found: ' + id);
    }
    if (updates.name !== undefined) controller.name = updates.name;
    if (updates.url !== undefined) controller.url = updates.url;
    if (updates.token !== undefined) controller.token = updates.token;
    save(config);
    return controller;
}

export function removeController(id: string): Controller {
    const config = load();
    const index = config.controllers.findIndex(c => c.id === id);
    if (index === -1) {
        throw new Error('Controller not found: ' + id);
    }
    const removed = config.controllers.splice(index, 1)[0];
    if (config.activeControllerId === id) {
        config.activeControllerId = config.controllers.length > 0 ? config.controllers[0].id : null;
    }
    save(config);
    return removed;
}

export function getActiveControllerId(): string | null {
    return load().activeControllerId;
}

export function setActiveControllerId(id: string | null): void {
    const config = load();
    if (id !== null) {
        const exists = config.controllers.some(c => c.id === id);
        if (!exists) {
            throw new Error('Controller not found: ' + id);
        }
    }
    config.activeControllerId = id;
    save(config);
}

export function getActiveController(): Controller | null {
    const config = load();
    if (!config.activeControllerId) return null;
    return config.controllers.find(c => c.id === config.activeControllerId) ?? null;
}
