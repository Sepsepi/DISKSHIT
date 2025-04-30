// supabase-history.js
// Fetch and render previous scan results for the authenticated user
const { supabase } = require('./supabase.js');

async function fetchScanHistory() {
  const user = supabase.auth.user();
  if (!user) return [];
  const { data, error } = await supabase
    .from('scan_results')
    .select('*')
    .eq('user_id', user.id)
    .order('scanned_at', { ascending: false })
    .limit(10);
  if (error) return [];
  return data || [];
}

function renderScanHistory(history) {
  const container = document.getElementById('scan-history');
  if (!container) return;
  if (!history.length) {
    container.innerHTML = '<em>No previous scans found.</em>';
    return;
  }
  container.innerHTML = '<b>Previous Scans:</b><ul style="margin:8px 0 0 0;">' +
    history.map(item => {
      const d = new Date(item.scanned_at);
      return `<li><span style='font-size:0.95em;'>${d.toLocaleString()}</span> <button class='view-history-btn' data-id='${item.id}'>View</button></li>`;
    }).join('') + '</ul>';
}

function wireScanHistoryView(history) {
  // Attach click handlers to View buttons
  document.querySelectorAll('.view-history-btn').forEach(btn => {
    btn.onclick = () => {
      const scan = history.find(h => h.id == btn.dataset.id);
      if (!scan) return;
      let result;
      try {
        result = JSON.parse(scan.result);
      } catch { result = []; }
      // Show a modal or alert with a summary of the scan
      const summary = Array.isArray(result) && result.length
        ? result.map(item => `${item.path}: ${item.llm_summary || ''} [${item.llm_importance || ''}]`).slice(0, 10).join('\n')
        : 'No data.';
      alert(`Scan from ${new Date(scan.scanned_at).toLocaleString()}\n\n${summary}`);
    };
  });
}

module.exports = {
  fetchScanHistory,
  renderScanHistory,
  wireScanHistoryView
};
