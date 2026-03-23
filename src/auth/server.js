const http = require('http');
const {URL} = require('url');
const config = require('../config');
const pages = require('./pages');

var AUTH_PORT = 18900;
var authServer = null;

function getAuthUrl() {
    return 'http://localhost:' + AUTH_PORT;
}

function getAuthPort() {
    return AUTH_PORT;
}

/**
 * Start the local auth web server for controller setup.
 * Returns a promise that resolves when the server is listening.
 */
function start() {
    return new Promise(function(resolve, reject) {
        if(authServer) {
            resolve(getAuthUrl());
            return;
        }

        authServer = http.createServer(handleRequest);

        authServer.on('error', function(err) {
            if(err.code === 'EADDRINUSE') {
                // Port already in use — try next port
                AUTH_PORT++;
                authServer.listen(AUTH_PORT, '127.0.0.1');
            }
            else {
                reject(err);
            }
        });

        authServer.listen(AUTH_PORT, '127.0.0.1', function() {
            resolve(getAuthUrl());
        });
    });
}

function stop() {
    return new Promise(function(resolve) {
        if(authServer) {
            authServer.close(function() {
                authServer = null;
                resolve();
            });
        }
        else {
            resolve();
        }
    });
}

function handleRequest(req, res) {
    var parsedUrl = new URL(req.url, 'http://localhost');

    if(req.method === 'GET' && parsedUrl.pathname === '/') {
        return serveSetupPage(req, res, null);
    }

    if(req.method === 'POST' && parsedUrl.pathname === '/add') {
        return handleAddController(req, res);
    }

    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not Found');
}

function serveSetupPage(req, res, message) {
    var controllers = config.getControllers();
    var activeId = config.getActiveControllerId();
    var viewControllers = controllers.map(function(c) {
        return {name: c.name, url: c.url, isActive: c.id === activeId};
    });
    var html = pages.setupPage(viewControllers, message);
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(html);
}

function handleAddController(req, res) {
    var body = '';
    req.on('data', function(chunk) {
        body += chunk.toString();
    });
    req.on('end', function() {
        var params = new URLSearchParams(body);
        var name = (params.get('name') || '').trim();
        var url = (params.get('url') || '').trim();
        var token = (params.get('token') || '').trim();

        if(!name || !url || !token) {
            return serveSetupPage(req, res, {type: 'error', text: 'All fields are required.'});
        }

        // Normalize URL: strip trailing slash, append /mcp if missing
        url = url.replace(/\/+$/, '');
        if(!url.endsWith('/mcp')) {
            url += '/mcp';
        }

        try {
            var entry = config.addController({name: name, url: url, token: token});
            var html = pages.successPage(entry.name);
            res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
            res.end(html);
        }
        catch(e) {
            serveSetupPage(req, res, {type: 'error', text: e.message});
        }
    });
}

module.exports = {
    start: start,
    stop: stop,
    getAuthUrl: getAuthUrl,
    getAuthPort: getAuthPort,
};
