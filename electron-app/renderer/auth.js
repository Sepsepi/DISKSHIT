// auth.js
// Minimal landing page UI and logic for Supabase OAuth
const { supabase, signInWithProvider, signOut, onAuthStateChange } = require('./supabase.js');

const { fetchScanHistory, renderScanHistory } = require('./supabase-history.js');

// Expose handleAuthStateChange globally for supabase.js to call after OAuth
window.handleAuthStateChange = async function(event, session) {
  const authBox = document.getElementById('auth-box');
  const userBox = document.getElementById('user-box');
  const userEmail = document.getElementById('user-email');
  const scanContainer = document.getElementById('scan-container');
  const historyBox = document.getElementById('scan-history');
  if (session && session.user) {
    authBox.style.display = 'none';
    userBox.style.display = 'block';
    userEmail.textContent = session.user.email;
    if (scanContainer) scanContainer.style.display = 'block';
    // Fetch and render scan history
    if (typeof fetchScanHistory === 'function' && typeof renderScanHistory === 'function') {
      const history = await fetchScanHistory();
      renderScanHistory(history);
      if (typeof wireScanHistoryView === 'function') wireScanHistoryView(history);
    }
  } else {
    authBox.style.display = 'block';
    userBox.style.display = 'none';
    userEmail.textContent = '';
    if (scanContainer) scanContainer.style.display = 'none';
    if (historyBox) historyBox.innerHTML = '';
  }
};

window.addEventListener('DOMContentLoaded', () => {
  const authBox = document.getElementById('auth-box');
  const userBox = document.getElementById('user-box');
  const signInBtns = document.querySelectorAll('.oauth-btn');
  console.log('Found OAuth buttons:', signInBtns.length); // Add this line
  const signOutBtn = document.getElementById('sign-out-btn');
  const userEmail = document.getElementById('user-email');

  // Listen for auth state changes
  onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      authBox.style.display = 'none';
      userBox.style.display = 'block';
      userEmail.textContent = session.user.email;
      // Show scan UI
      const scanContainer = document.getElementById('scan-container');
      if (scanContainer) scanContainer.style.display = 'block';
      // Fetch and render scan history
      const history = await fetchScanHistory();
      renderScanHistory(history);
      wireScanHistoryView(history);
    } else {
      authBox.style.display = 'block';
      userBox.style.display = 'none';
      userEmail.textContent = '';
      // Hide scan UI
      const scanContainer = document.getElementById('scan-container');
      if (scanContainer) scanContainer.style.display = 'none';
      // Clear scan history
      const historyBox = document.getElementById('scan-history');
      if (historyBox) historyBox.innerHTML = '';
    }
  });

  // Sign in with OAuth provider
  signInBtns.forEach(btn => {
    btn.addEventListener('click', () => { // Changed to addEventListener
      const provider = btn.dataset.provider;
      console.log('Sign-in button clicked for provider:', provider);
      // Re-enable signInWithProvider call
      signInWithProvider(provider).catch(err => {
        console.error('Error from signInWithProvider catch:', err); // Log the error
        alert('Sign-in failed: ' + err.message);
      });
    });
  });

  // Sign out
  if (signOutBtn) {
    signOutBtn.onclick = () => signOut();
  }
});
