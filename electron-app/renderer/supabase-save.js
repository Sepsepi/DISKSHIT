// supabase-save.js
// Save scan results to Supabase for the authenticated user
const { supabase } = require('./supabase.js');

async function saveScanResult(result) {
  // result: array of scanned items (with LLM fields)
  const user = supabase.auth.user();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('scan_results')
    .insert([
      { user_id: user.id, scanned_at: new Date().toISOString(), result: JSON.stringify(result) }
    ]);
  if (error) throw error;
  return data;
}

module.exports = {
  saveScanResult
};
