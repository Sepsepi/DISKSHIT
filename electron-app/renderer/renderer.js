const { ipcRenderer } = require('electron');

// --- Disk Permission Modal and Disk Picker Logic ---
window.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('disk-permission-modal');
  const allowBtn = document.getElementById('grant-disk-access');
  if (modal && allowBtn) {
    allowBtn.onclick = async () => {
      console.log('[RENDERER] About to invoke list-available-disks');
      addTerminalLine('Requesting disk access...', 'info');
      allowBtn.disabled = true;
      allowBtn.textContent = 'Detecting disks...';
      try {
        // Ask main process to list disks
        const disks = await ipcRenderer.invoke('list-available-disks');
        console.log('[RENDERER] Disks received from main:', disks);
        addTerminalLine('Disk access granted. Disks detected: ' + disks.join(', '), 'success');
        modal.style.display = 'none';
        showDiskPicker(disks);
      } catch (e) {
        allowBtn.textContent = 'Failed. Retry';
        allowBtn.disabled = false;
        addTerminalLine('Could not detect disks: ' + e, 'error');
        console.error('Could not detect disks:', e);
        alert('Could not detect disks: ' + e);
      }
    };
  }
});

// Minimal terminal panel helper
function addTerminalLine(msg, type = 'info') {
  const terminal = document.getElementById('mini-terminal');
  if (!terminal) return;
  const line = document.createElement('div');
  line.className = 'terminal-line terminal-' + type;
  line.textContent = msg;
  terminal.appendChild(line);
  // Only keep the last 5 lines
  while (terminal.children.length > 5) terminal.removeChild(terminal.firstChild);
  terminal.scrollTop = terminal.scrollHeight;
}


function showDiskPicker(disks) {
  console.log('[DEBUG] showDiskPicker called with:', disks);
  alert('[DEBUG] Disks received: ' + JSON.stringify(disks));
  if (!Array.isArray(disks) || disks.length === 0) return;
  let picker = document.getElementById('disk-picker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'disk-picker';
    picker.style.marginBottom = '18px';
    picker.innerHTML = '<b>Select a disk to scan:</b> ' +
      disks.map(d => `<button class="disk-btn" data-path="${d}">${d}</button>`).join(' ');
    const container = document.querySelector('.container');
    container.insertBefore(picker, container.querySelector('form'));
    picker.querySelectorAll('.disk-btn').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('dirPath').value = btn.dataset.path;
      };
    });
  }
}

const TAGS = [
  { key: 'cache', color: '#f39c12' },
  { key: 'app', color: '#3498db' },
  { key: 'os', color: '#e74c3c' },
  { key: 'custom', color: '#2ecc71' }
];
let folderTags = {}; // { fullPath: tagKey }
let currentFilter = null;

function renderLegend() {
  const legend = document.getElementById('legend');
  legend.innerHTML = '<b>Tags:</b> ' + TAGS.map(t => `<span class="legend-tag" data-tag="${t.key}" style="background:${t.color}">${t.key}</span>`).join(' ');
  legend.querySelectorAll('.legend-tag').forEach(el => {
    el.onclick = () => {
      currentFilter = (currentFilter === el.dataset.tag) ? null : el.dataset.tag;
      renderTreeView(window.lastTreeData);
    };
  });
}

// --- Tree view rendering (Programmatic DOM Creation) ---
function renderTreeView(data) {
  const container = document.getElementById('tree-view');
  container.innerHTML = ''; // Clear previous content
  if (!data || !data.structure) {
    container.innerHTML = '<em>No data</em>';
    return;
  }

  function createTreeNode(name, size, fullPath, subdirs) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';
    nodeDiv.style.marginLeft = '20px';

    const folderNameSpan = document.createElement('span');
    folderNameSpan.className = 'folder-name';
    folderNameSpan.dataset.path = fullPath;
    folderNameSpan.textContent = `${name} `;

    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'size';
    sizeSpan.textContent = `(${formatSize(size)})`;
    folderNameSpan.appendChild(sizeSpan);

    const tag = folderTags[fullPath];
    if (tag) {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'tag';
      const tagInfo = TAGS.find(t => t.key === tag);
      if (tagInfo) {
        tagSpan.style.background = tagInfo.color;
        tagSpan.textContent = tagInfo.key;
      }
      folderNameSpan.appendChild(tagSpan);
    }

    const tagButton = document.createElement('button');
    tagButton.className = 'tag-btn';
    tagButton.dataset.path = fullPath;
    tagButton.textContent = 'Tag';
    tagButton.onclick = () => {
      const newTag = prompt('Enter tag: cache, app, os, custom');
      if (TAGS.some(t => t.key === newTag)) {
        folderTags[fullPath] = newTag;
        renderTreeView(window.lastTreeData);
      } else if (newTag === '' || newTag === null) {
        delete folderTags[fullPath];
        renderTreeView(window.lastTreeData);
      } else {
        alert('Invalid tag');
      }
    };
    folderNameSpan.appendChild(tagButton);

    nodeDiv.appendChild(folderNameSpan);

    if (subdirs && Object.keys(subdirs).length) {
      const subdirsDiv = document.createElement('div');
      Object.entries(subdirs).forEach(([subName, [subSize, subSubdirs]]) => {
        const subFullPath = fullPath + '/' + subName;
        const subNode = createTreeNode(subName, subSize, subFullPath, subSubdirs);
        subdirsDiv.appendChild(subNode);
      });
      nodeDiv.appendChild(subdirsDiv);
    }

    // Apply filter
    if (currentFilter && tag !== currentFilter) {
        nodeDiv.style.display = 'none';
    } else {
        nodeDiv.style.display = 'block';
    }


    // Apply selection highlight
    if (selectedPaths.has(fullPath)) {
        nodeDiv.classList.add('chat-selected');
    } else {
        nodeDiv.classList.remove('chat-selected');
    }


    return nodeDiv;
  }

  Object.entries(data.structure).forEach(([name, [size, subdirs]]) => {
      const fullPath = data.root + '/' + name;
      const node = createTreeNode(name, size, fullPath, subdirs);
      container.appendChild(node);
  });
}


function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  let u = -1;
  const units = ['KB','MB','GB','TB','PB'];
  do {
    bytes /= 1024;
    ++u;
  } while(bytes >= 1024 && u < units.length-1);
  return bytes.toFixed(1)+' '+units[u];
}

require('./supabase-save.js');
document.getElementById('scan-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dirPath = document.getElementById('dirPath').value;
  const scanMode = document.getElementById('depth').value;
  const treeView = document.getElementById('tree-view');
  treeView.innerHTML = 'Scanning...';
  addScanLog('Started scanning ' + dirPath + ' (depth ' + depth + ')...');
  try {
    const result = await ipcRenderer.invoke('scan-disk', { dirPath, scanMode });
    // Only show folders/files with LLM category and criticality, filter out any that are missing
    const filtered = Array.isArray(result) ? result.filter(item => item.llm_category && item.llm_criticality) : result;
    window.lastTreeData = filtered;
    renderTreeView(filtered);
    renderLegend();
    addScanLog('Scan complete.');
    // Save results to Supabase
    try {
      await saveScanResult(filtered);
      addScanLog('Scan results saved to your account.');
    } catch (saveErr) {
      addScanLog('Could not save scan results: ' + saveErr.message);
    }
  } catch (err) {
    treeView.innerHTML = 'Error: ' + err;
    addScanLog('Error: ' + err);
  }
});

function addScanLog(msg) {
  let logBox = document.getElementById('scan-log-box');
  if (!logBox) return;
  const entry = document.createElement('div');
  entry.textContent = `[${(new Date()).toLocaleTimeString()}] ${msg}`;
  logBox.appendChild(entry);
  // Limit log length
  while (logBox.childNodes.length > 100) logBox.removeChild(logBox.firstChild);
  logBox.scrollTop = logBox.scrollHeight;
}

// Listen for scan log lines from main process
ipcRenderer.on('scan-log-line', (event, line) => {
  // Only show important events in the mini-terminal
  // Example: [Error], [Warn], [Scan] Started, [Scan] Complete, large files/folders
  if (/\[Error\]/i.test(line)) {
    addTerminalLine(line.replace('[Error]', 'Error:'), 'error');
  } else if (/\[Warn\]/i.test(line)) {
    addTerminalLine(line.replace('[Warn]', 'Warning:'), 'warn');
  } else if (/\[Scan\] Started/.test(line)) {
    addTerminalLine('Scan started.', 'info');
  } else if (/\[Scan\] Complete/.test(line)) {
    addTerminalLine('Scan complete.', 'success');
  } else if (/\[Result\] Included:/.test(line)) {
    // Only show if very large (e.g. > 1 GB or > 0.1 TB)
    const sizeMatch = line.match(/\((\d+[.,]?\d*)\s*(GB|TB|MB)\)/i);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      let isBig = false;
      if (unit === 'TB' && size >= 0.1) isBig = true;
      else if (unit === 'GB' && size >= 1) isBig = true;
      else if (unit === 'MB' && size >= 1024) isBig = true;
      if (isBig) {
        addTerminalLine('Large: ' + line.replace('[Result] Included:', '').trim(), 'warn');
      }
    }
  }
  // All lines still go to the scan log box if present (for full details)
  addScanLog(line);
});

// Fade away the mini-terminal after 3 seconds of inactivity
let terminalFadeTimeout = null;
function showMiniTerminal() {
  const terminal = document.getElementById('mini-terminal');
  if (!terminal) return;
  terminal.style.opacity = '1';
  terminal.style.pointerEvents = 'auto';
  terminal.style.transition = 'opacity 0.4s';
  if (terminalFadeTimeout) clearTimeout(terminalFadeTimeout);
  terminalFadeTimeout = setTimeout(() => {
    terminal.style.opacity = '0';
    terminal.style.pointerEvents = 'none';
  }, 3000);
}
// Patch addTerminalLine to show and fade
const _addTerminalLine = addTerminalLine;
addTerminalLine = function(msg, type = 'info') {
  _addTerminalLine(msg, type);
  showMiniTerminal();
};



// --- Chat/Command Box Logic ---
let selectedPaths = new Set();

function addChatMessage(sender, text) {
  const chatHistory = document.getElementById('chat-history');
  const msg = document.createElement('div');
  msg.className = 'chat-msg ' + sender;
  msg.textContent = (sender === 'user' ? 'You: ' : 'AI: ') + text;
  chatHistory.appendChild(msg);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const cmd = input.value.trim();
  if (!cmd) return;
  addChatMessage('user', cmd);
  handleCommand(cmd);
  input.value = '';
});

function handleCommand(cmd) {
  // Simple command parser: search, tag, select
  let match;
  if ((match = cmd.match(/^search (.+)$/i))) {
    const query = match[1].toLowerCase();
    const matches = findFoldersByQuery(query);
    selectedPaths = new Set(matches);
    addChatMessage('ai', `Found ${matches.length} folders matching "${query}".`);
    renderTreeView(window.lastTreeData);
  } else if ((match = cmd.match(/^tag (\w+) (.+)$/i))) {
    const tag = match[1].toLowerCase();
    const query = match[2].toLowerCase();
    if (!TAGS.some(t => t.key === tag)) {
      addChatMessage('ai', `Unknown tag: ${tag}`);
      return;
    }
    const matches = findFoldersByQuery(query);
    matches.forEach(path => folderTags[path] = tag);
    addChatMessage('ai', `Tagged ${matches.length} folders as ${tag}.`);
    renderTreeView(window.lastTreeData);
  } else if ((match = cmd.match(/^select (.+)$/i))) {
    const query = match[1].toLowerCase();
    let matches;
    if (TAGS.some(t => t.key === query)) {
      // Select by tag
      matches = Object.entries(folderTags).filter(([_, tg]) => tg === query).map(([p]) => p);
    } else {
      matches = findFoldersByQuery(query);
    }
    selectedPaths = new Set(matches);
    addChatMessage('ai', `Selected ${matches.length} folders by "${query}".`);
    renderTreeView(window.lastTreeData);
  } else if (/^clear$/i.test(cmd)) {
    selectedPaths.clear();
    addChatMessage('ai', 'Cleared selection.');
    renderTreeView(window.lastTreeData);
  } else {
    addChatMessage('ai', 'Unknown command. Try: search <query>, tag <tag> <query>, select <tag|query>, clear');
  }
}

function findFoldersByQuery(query) {
  // Traverse the tree and match folder names or paths
  const matches = [];
  function walk(node, fullPath) {
    Object.entries(node).forEach(([name, [size, subdirs]]) => {
      const path = fullPath ? fullPath + '/' + name : name;
      if (name.toLowerCase().includes(query) || path.toLowerCase().includes(query)) {
        matches.push(path);
      }
      if (subdirs && Object.keys(subdirs).length) walk(subdirs, path);
    });
  }
  if (window.lastTreeData && window.lastTreeData.structure) {
    walk(window.lastTreeData.structure, window.lastTreeData.root);
  }
  return matches;
}

// Initial legend render
renderLegend();
