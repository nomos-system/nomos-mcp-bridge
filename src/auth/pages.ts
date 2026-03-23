interface ViewMessage {
    type: 'error' | 'success';
    text: string;
}

interface ViewControllerEntry {
    name: string;
    url: string;
    isActive: boolean;
}

const NOMOS_LOGO_BASE64 = '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';

function escapeHtml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function layout(title: string, body: string): string {
    return '<!DOCTYPE html>'
        + '<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
        + '<title>' + title + ' — nomos MCP Bridge</title>'
        + '<style>'
        + ':root{--bg:#0a0a0a;--card:#f5e6d3;--card-text:#1a1a1a;--border:#e0cdb8;--accent:#1a1a1a;--accent-hover:#333;--text:#f5e6d3;--muted:#666;--muted-light:#999;--danger:#ef4444;--success:#22c55e;--input-bg:#fff;--input-border:#ccc}'
        + '*{margin:0;padding:0;box-sizing:border-box}'
        + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}'
        + '.container{width:100%;max-width:480px}'
        + '.header{text-align:center;margin-bottom:24px;display:flex;flex-direction:column;align-items:center;gap:12px}'
        + '.header img{width:48px;height:48px}'
        + '.header .title{font-size:14px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:var(--text);opacity:0.7}'
        + '.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:32px;color:var(--card-text)}'
        + 'h2{font-size:18px;margin-bottom:16px;font-weight:600;color:var(--card-text)}'
        + 'p{color:var(--muted);font-size:14px;line-height:1.5;margin-bottom:16px}'
        + 'label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:var(--muted)}'
        + 'input[type="text"],input[type="url"],input[type="password"]{width:100%;padding:10px 12px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;color:var(--card-text);font-size:14px;outline:none;transition:border-color .2s}'
        + 'input:focus{border-color:var(--accent)}'
        + '.field{margin-bottom:16px}'
        + '.btn{display:inline-block;width:100%;padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s;text-align:center}'
        + '.btn:hover{background:var(--accent-hover)}'
        + '.status{padding:12px 16px;border-radius:8px;font-size:14px;margin-bottom:16px}'
        + '.status-success{background:#e8f5e9;border:1px solid #a5d6a7;color:#2e7d32}'
        + '.status-error{background:#fbe9e7;border:1px solid #ef9a9a;color:#c62828}'
        + '.controllers{list-style:none;margin-bottom:16px}'
        + '.controllers li{padding:12px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}'
        + '.controllers li .name{font-weight:600;color:var(--card-text)}'
        + '.controllers li .url{font-size:12px;color:var(--muted)}'
        + '.controllers li .active{font-size:11px;color:var(--success);font-weight:600;text-transform:uppercase}'
        + '.hint{font-size:12px;color:var(--muted-light);margin-top:4px}'
        + '</style></head><body>'
        + '<div class="container">'
        + '<div class="header">'
        + '<img src="data:image/png;base64,' + NOMOS_LOGO_BASE64 + '" alt="nomos system">'
        + '<div class="title">nomos system MCP Bridge</div>'
        + '</div>'
        + body
        + '</div></body></html>';
}

export function setupPage(controllers: ViewControllerEntry[], message?: ViewMessage | null): string {
    let statusHtml = '';
    if (message) {
        const cssClass = message.type === 'error' ? 'status-error' : 'status-success';
        statusHtml = '<div class="status ' + cssClass + '">' + escapeHtml(message.text) + '</div>';
    }

    let listHtml = '';
    if (controllers.length > 0) {
        listHtml = '<h2>Registered Controllers</h2><ul class="controllers">';
        for (const c of controllers) {
            listHtml += '<li><div><div class="name">' + escapeHtml(c.name) + '</div>'
                + '<div class="url">' + escapeHtml(c.url) + '</div></div>'
                + (c.isActive ? '<div class="active">Active</div>' : '')
                + '</li>';
        }
        listHtml += '</ul>';
    }

    const body = '<div class="card">'
        + statusHtml
        + listHtml
        + '<h2>Add Controller</h2>'
        + '<p>Enter the connection details for your nomos system controller. You can find the MCP token in the nomos system configuration under Skills &gt; MCP.</p>'
        + '<form method="POST" action="/add">'
        + '<div class="field"><label for="name">Name</label>'
        + '<input type="text" id="name" name="name" placeholder="e.g. Wohnhaus" required>'
        + '<div class="hint">A friendly name to identify this controller.</div></div>'
        + '<div class="field"><label for="url">Controller URL</label>'
        + '<input type="url" id="url" name="url" placeholder="https://192.168.1.100" required>'
        + '<div class="hint">The IP address or hostname of your nomos system controller (without /mcp path).</div></div>'
        + '<div class="field"><label for="token">MCP Token</label>'
        + '<input type="password" id="token" name="token" placeholder="Bearer token" required></div>'
        + '<button type="submit" class="btn">Add Controller</button>'
        + '</form></div>';

    return layout('Setup', body);
}

export function successPage(controllerName: string): string {
    const body = '<div class="card">'
        + '<div class="status status-success">Controller "' + escapeHtml(controllerName) + '" has been added successfully.</div>'
        + '<p>You can now close this window and use the controller via your AI assistant. Tell it to <strong>select_controller</strong> with the name "' + escapeHtml(controllerName) + '".</p>'
        + '<p style="margin-top:16px"><a href="/" class="btn">Add another controller</a></p>'
        + '</div>';
    return layout('Success', body);
}
