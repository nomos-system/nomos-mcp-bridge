/**
 * HTML pages for the local auth web server.
 */

function layout(title, body) {
    return '<!DOCTYPE html>'
        + '<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
        + '<title>' + title + ' — nomos MCP Bridge</title>'
        + '<style>'
        + ':root{--bg:#0f1117;--card:#1a1d27;--border:#2a2d3a;--accent:#4f8ff7;--accent-hover:#3a7ae0;--text:#e4e4e7;--muted:#9ca3af;--danger:#ef4444;--success:#22c55e}'
        + '*{margin:0;padding:0;box-sizing:border-box}'
        + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}'
        + '.container{width:100%;max-width:480px}'
        + '.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:32px}'
        + '.logo{text-align:center;margin-bottom:24px;font-size:28px;font-weight:700;letter-spacing:-0.5px}'
        + '.logo span{color:var(--accent)}'
        + 'h2{font-size:18px;margin-bottom:16px;font-weight:600}'
        + 'p{color:var(--muted);font-size:14px;line-height:1.5;margin-bottom:16px}'
        + 'label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--muted)}'
        + 'input[type="text"],input[type="url"],input[type="password"]{width:100%;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none;transition:border-color .2s}'
        + 'input:focus{border-color:var(--accent)}'
        + '.field{margin-bottom:16px}'
        + '.btn{display:inline-block;width:100%;padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s;text-align:center}'
        + '.btn:hover{background:var(--accent-hover)}'
        + '.btn-danger{background:var(--danger)}'
        + '.btn-danger:hover{background:#dc2626}'
        + '.status{padding:12px 16px;border-radius:8px;font-size:14px;margin-bottom:16px}'
        + '.status-success{background:#052e16;border:1px solid #166534;color:var(--success)}'
        + '.status-error{background:#2c0b0e;border:1px solid #7f1d1d;color:var(--danger)}'
        + '.controllers{list-style:none;margin-bottom:16px}'
        + '.controllers li{padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}'
        + '.controllers li .name{font-weight:600}'
        + '.controllers li .url{font-size:12px;color:var(--muted)}'
        + '.controllers li .active{font-size:11px;color:var(--success);font-weight:600;text-transform:uppercase}'
        + '.hint{font-size:12px;color:var(--muted);margin-top:4px}'
        + '</style></head><body>'
        + '<div class="container">'
        + '<div class="logo"><span>nomos</span> MCP Bridge</div>'
        + body
        + '</div></body></html>';
}

function setupPage(controllers, message) {
    var statusHtml = '';
    if(message) {
        var cssClass = message.type === 'error' ? 'status-error' : 'status-success';
        statusHtml = '<div class="status ' + cssClass + '">' + escapeHtml(message.text) + '</div>';
    }

    var listHtml = '';
    if(controllers.length > 0) {
        listHtml = '<h2>Registered Controllers</h2><ul class="controllers">';
        controllers.forEach(function(c) {
            listHtml += '<li><div><div class="name">' + escapeHtml(c.name) + '</div>'
                + '<div class="url">' + escapeHtml(c.url) + '</div></div>'
                + (c.isActive ? '<div class="active">Active</div>' : '')
                + '</li>';
        });
        listHtml += '</ul>';
    }

    var body = '<div class="card">'
        + statusHtml
        + listHtml
        + '<h2>Add Controller</h2>'
        + '<p>Enter the connection details for your nomos controller. You can find the MCP token in the nomos system configuration under Settings &gt; MCP.</p>'
        + '<form method="POST" action="/add">'
        + '<div class="field"><label for="name">Name</label>'
        + '<input type="text" id="name" name="name" placeholder="e.g. Wohnhaus" required>'
        + '<div class="hint">A friendly name to identify this controller.</div></div>'
        + '<div class="field"><label for="url">Controller URL</label>'
        + '<input type="url" id="url" name="url" placeholder="https://192.168.1.100" required>'
        + '<div class="hint">The IP address or hostname of your nomos controller (without /mcp path).</div></div>'
        + '<div class="field"><label for="token">MCP Token</label>'
        + '<input type="password" id="token" name="token" placeholder="Bearer token" required></div>'
        + '<button type="submit" class="btn">Add Controller</button>'
        + '</form></div>';

    return layout('Setup', body);
}

function successPage(controllerName) {
    var body = '<div class="card">'
        + '<div class="status status-success">Controller "' + escapeHtml(controllerName) + '" has been added successfully.</div>'
        + '<p>You can now close this window and use the controller via Claude. Tell Claude to <strong>select_controller</strong> with the name "' + escapeHtml(controllerName) + '".</p>'
        + '<p style="margin-top:16px"><a href="/" class="btn">Add another controller</a></p>'
        + '</div>';
    return layout('Success', body);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = {
    setupPage: setupPage,
    successPage: successPage,
};
