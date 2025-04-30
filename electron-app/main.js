// [DEBUG] Commented out log suppression for development debugging
// console.log = function () {};
// console.info = function () {};
// Only errors and warnings will print to terminal

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http'); // Import http module
const url = require('url'); // Import url module

let mainWindow; // Declare mainWindow here
let authCallbackServer = null; // To hold the local server instance
const AUTH_CALLBACK_PORT = 42813; // Define a fixed port for the local server

function createWindow() {
  const { screen, Menu } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const win = new BrowserWindow({
    width,
    height,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow = win; // Assign the window instance
  win.maximize();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Add menu for toggling fullscreen and DevTools
  const template = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
          click: () => { win.setFullScreen(!win.isFullScreen()); }
        },
        {
          label: 'Toggle DevTools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => { win.webContents.toggleDevTools(); }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Custom protocol handling removed as we are using the standard Supabase callback flow.

app.whenReady().then(() => {
  createWindow();
  // Start the local server for OAuth callbacks
  startAuthCallbackServer();
});

// Handle disk listing from renderer
ipcMain.handle('list-available-disks', async () => {
  console.log('[MAIN] list-available-disks invoked');
  console.log('[IPC] list-available-disks handler called');
  return new Promise((resolve, reject) => {
    const py = spawn('python', [
      path.join(__dirname, '..', 'disk_space_analyzer.py'),
      '--list-disks'
    ]);
    let data = '';
    py.stdout.on('data', chunk => { data += chunk; });
    py.stderr.on('data', err => { console.error('[Python error]', err.toString()); });
    py.on('close', code => {
      console.log('[IPC] Python disk list output:', data);
      try {
        const disks = JSON.parse(data);
        if (!Array.isArray(disks) || disks.length === 0) {
          console.error('[IPC] No disks detected or invalid output:', disks);
          reject('No disks detected or invalid output.');
        } else {
          resolve(disks);
        }
      } catch (e) {
        console.error('[IPC] Failed to parse Python output:', e.message, data);
        reject('Failed to parse Python output: ' + e.message + '\n' + data);
      }
    });
  });
});

// Handle scan requests from renderer
ipcMain.handle('scan-disk', async (event, { dirPath, scanMode, exclude = [], minSizeMB = 0 }) => {
  return new Promise((resolve, reject) => {
    // Map scanMode to depth for Python script
    let depth = scanMode === 'deep' ? 5 : 1;
    const py = spawn('python', [
      path.join(__dirname, '..', 'disk_space_analyzer.py'),
      dirPath,
      '--depth', depth,
      '--json',
      ...(exclude.length ? ['--exclude', ...exclude] : []),
      ...(minSizeMB ? ['--min-size-mb', minSizeMB] : [])
    ]);

    let data = '';
    let jsonStarted = false;
    py.stdout.on('data', chunk => {
      const lines = chunk.toString().split(/\r?\n/);
      for (let line of lines) {
        if (!line.trim()) continue;
        // Heuristic: JSON output starts with '{' or '['
        if (!jsonStarted && (line.trim().startsWith('{') || line.trim().startsWith('['))) {
          jsonStarted = true;
        }
        if (jsonStarted) {
          data += line;
        } else {
          // Clean up the log line for user readability
          let prettyLine = line
            .replace(/[\[\]{}'\"]+/g, '') // Remove brackets, braces, quotes
            .replace(/[:,]/g, ' ')            // Replace colons and commas with space
            .replace(/\s+/g, ' ')            // Collapse whitespace
            .trim();
          // Only log if it contains something meaningful
          if (prettyLine && prettyLine.length > 2) {
            event.sender.send('scan-log-line', prettyLine);
          }
        }
      }
    });
    py.stderr.on('data', err => {
      event.sender.send('scan-log-line', '[Python error] ' + err.toString());
      console.error('Python error:', err.toString());
    });
    py.on('close', async code => {
      try {
        if (!data || !data.trim()) {
          reject('Scan completed, but no data was returned from the Python script.');
          return;
        }
        let results = JSON.parse(data);
        // --- FLATTEN PYTHON OUTPUT ---
        function flattenStructure(structure, parentPath) {
          let result = [];
          for (const [name, value] of Object.entries(structure)) {
            const [size, children] = value;
            const fullPath = parentPath ? `${parentPath}\\${name}` : name;
            result.push({ path: fullPath, size });
            if (children && typeof children === 'object' && Object.keys(children).length > 0) {
              result = result.concat(flattenStructure(children, fullPath));
            }
          }
          return result;
        }
        let items = [];
        if (results && results.structure) {
          items = flattenStructure(results.structure, results.root);
        }
        // Post-process: categorize and label each result (heuristics)
        function categorizeAndLabel(item) {
          const p = item.path.toLowerCase();
          let category = 'unknown';
          let criticality = 'unknown';
          if (p.includes('windows') || p.includes('system32') || p.includes('program files')) {
            category = 'os';
            criticality = 'dangerous';
          } else if (p.includes('appdata') || p.includes('temp') || p.includes('cache')) {
            category = 'cache';
            criticality = 'safe';
          } else if (p.includes('users')) {
            category = 'user';
            criticality = 'caution';
          } else if (p.includes('games') || p.includes('steam') || p.includes('epic')) {
            category = 'apps';
            criticality = 'caution';
          }
          item.category = category;
          item.criticality = criticality;
          return item;
        }
        async function enhanceWithLLM(item) {
          const { loadModel, askLlama } = require('./llama.js');
          await loadModel();
          const prompt = `Given the folder or file: ${item.path} (size: ${item.sizeMB || item.size || 0} MB), with current category: ${item.category}, and criticality: ${item.criticality}, suggest improved values for category and criticality. Also, provide a short user-friendly summary (1 sentence) describing what this folder/file is, and rate its importance for the system or user as one of: 'critical', 'important', 'optional', or 'safe to delete'. Respond in JSON: {"category": "...", "criticality": "...", "summary": "...", "importance": "..."}`;
          try {
            const llmResult = await askLlama(prompt);
            if (llmResult && typeof llmResult === 'string') {
              const match = llmResult.match(/\{[\s\S]*\}/);
              if (match) {
                const llmJson = JSON.parse(match[0]);
                item.llm_category = llmJson.category || item.category;
                item.llm_criticality = llmJson.criticality || item.criticality;
                item.llm_summary = llmJson.summary || '';
                item.llm_importance = llmJson.importance || '';
              }
            }
          } catch (e) {
            // If LLM fails, fallback to heuristics
            item.llm_category = item.category;
            item.llm_criticality = item.criticality;
          }
          if (item.children && Array.isArray(item.children)) {
            for (let i = 0; i < item.children.length; ++i) {
              item.children[i] = await enhanceWithLLM(categorizeAndLabel(item.children[i]));
            }
          }
          return item;
        }
        async function enhanceAll(items) {
          if (Array.isArray(items)) {
            for (let i = 0; i < items.length; ++i) {
              items[i] = await enhanceWithLLM(categorizeAndLabel(items[i]));
            }
            return items;
          } else {
            return await enhanceWithLLM(categorizeAndLabel(items));
          }
        }

        items = await enhanceAll(items);
        // Only return results that have LLM category and criticality
        const filtered = Array.isArray(items) ? items.filter(item => item.llm_category && item.llm_criticality) : items;
        resolve(filtered);
      } catch (e) {
        reject('Failed to parse Python output: ' + e.message + '\n' + data);
      }
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  // Stop the local server when the app closes
  if (authCallbackServer) {
    authCallbackServer.close();
    authCallbackServer = null;
  }
});

function startAuthCallbackServer() {
  // Create a local HTTP server to listen for the OAuth redirect
  authCallbackServer = http.createServer((req, res) => {
    const requestUrl = url.parse(req.url, true);
    // Check if the request is for the OAuth callback path
    if (requestUrl.pathname === '/') { // Supabase redirects to http://localhost/ by default
      const code = requestUrl.query.code;
      const error = requestUrl.query.error;

      if (error) {
        console.error('[Auth Callback Server] OAuth error:', error);
        // Optionally send error to renderer
        if (mainWindow) {
          mainWindow.webContents.send('oauth-error', error);
        }
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('OAuth Error: ' + error);
      } else if (code) {
        console.log('[Auth Callback Server] Received OAuth code:', code);
        // Send the code to the renderer process
        if (mainWindow) {
          mainWindow.webContents.send('oauth-code', code);
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Authentication successful! You can close this window.');
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid OAuth callback.');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  // Listen on a port (e.g., 3000 or any available port)
  // Note: Supabase's default redirect for desktop apps is often http://localhost
  // We'll listen on a specific port and ensure Supabase is configured to redirect there.
  // For now, let's assume http://localhost is sufficient and the OS handles port.
  // If issues persist, we might need to specify a port here and in Supabase/Google.
  authCallbackServer.listen(AUTH_CALLBACK_PORT, 'localhost', () => {
    const address = authCallbackServer.address();
    console.log(`[Auth Callback Server] Listening on http://${address.address}:${address.port}`);
    // We don't need to tell Supabase the port here, as we'll construct the URL manually in the renderer.
  });

  authCallbackServer.on('error', (e) => {
    console.error('[Auth Callback Server] Server error:', e);
    // Handle errors, e.g., port already in use
    // In a real app, you might want to inform the user if the port is in use.
  });
}
