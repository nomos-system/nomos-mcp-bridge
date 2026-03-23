const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'nomos-mcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'controllers.json');

/**
 * Config structure:
 * {
 *   controllers: [
 *     { id: "uuid", name: "Wohnhaus", url: "https://192.168.1.100/mcp", token: "abc123" }
 *   ],
 *   activeControllerId: "uuid" | null
 * }
 */

function ensureConfigDir() {
    if(!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, {recursive: true});
    }
}

function load() {
    ensureConfigDir();
    try {
        var data = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(data);
    }
    catch(e) {
        return {controllers: [], activeControllerId: null};
    }
}

function save(config) {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function getControllers() {
    return load().controllers;
}

function getController(id) {
    var config = load();
    return config.controllers.find(function(c) { return c.id === id; }) || null;
}

function getControllerByName(name) {
    var config = load();
    var lower = name.toLowerCase();
    return config.controllers.find(function(c) { return c.name.toLowerCase() === lower; }) || null;
}

function addController(controller) {
    var config = load();

    // Check for duplicate name
    var existing = config.controllers.find(function(c) {
        return c.name.toLowerCase() === controller.name.toLowerCase();
    });
    if(existing) {
        throw new Error('A controller with the name "' + controller.name + '" already exists.');
    }

    var id = generateId();
    var entry = {
        id: id,
        name: controller.name,
        url: controller.url,
        token: controller.token,
    };
    config.controllers.push(entry);

    // Auto-select if this is the only controller
    if(config.controllers.length === 1) {
        config.activeControllerId = id;
    }

    save(config);
    return entry;
}

function updateController(id, updates) {
    var config = load();
    var controller = config.controllers.find(function(c) { return c.id === id; });
    if(!controller) {
        throw new Error('Controller not found: ' + id);
    }
    if(updates.name !== undefined) controller.name = updates.name;
    if(updates.url !== undefined) controller.url = updates.url;
    if(updates.token !== undefined) controller.token = updates.token;
    save(config);
    return controller;
}

function removeController(id) {
    var config = load();
    var index = config.controllers.findIndex(function(c) { return c.id === id; });
    if(index === -1) {
        throw new Error('Controller not found: ' + id);
    }
    var removed = config.controllers.splice(index, 1)[0];
    if(config.activeControllerId === id) {
        config.activeControllerId = config.controllers.length > 0 ? config.controllers[0].id : null;
    }
    save(config);
    return removed;
}

function getActiveControllerId() {
    return load().activeControllerId;
}

function setActiveControllerId(id) {
    var config = load();
    if(id !== null) {
        var exists = config.controllers.some(function(c) { return c.id === id; });
        if(!exists) {
            throw new Error('Controller not found: ' + id);
        }
    }
    config.activeControllerId = id;
    save(config);
}

function getActiveController() {
    var config = load();
    if(!config.activeControllerId) return null;
    return config.controllers.find(function(c) { return c.id === config.activeControllerId; }) || null;
}

function generateId() {
    // Simple UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

module.exports = {
    CONFIG_DIR: CONFIG_DIR,
    CONFIG_FILE: CONFIG_FILE,
    load: load,
    save: save,
    getControllers: getControllers,
    getController: getController,
    getControllerByName: getControllerByName,
    addController: addController,
    updateController: updateController,
    removeController: removeController,
    getActiveControllerId: getActiveControllerId,
    setActiveControllerId: setActiveControllerId,
    getActiveController: getActiveController,
};
