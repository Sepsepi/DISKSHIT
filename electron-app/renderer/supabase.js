// supabase.js
// Handles Supabase client initialization and authentication helpers

const { createClient } = require('@supabase/supabase-js');

// TODO: Replace with your actual Supabase URL and public anon key
const SUPABASE_URL = 'https://xeedtbjebkjnsxzgqkzo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlZWR0YmplYmtqbnN4emdxa3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4OTUwNDEsImV4cCI6MjA2MTQ3MTA0MX0.gmLYC8G3-ee7-A-xQlk6-MeamEorJjxHXPNyh2zSpug';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { ipcRenderer, shell } = require('electron');
const axios = require('axios'); // Import axios for making HTTP requests

// Define the local callback URL
const AUTH_CALLBACK_URL = 'http://localhost:42813';

// Google OAuth Credentials (for Desktop App)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // Read from environment variable
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET; // Read from environment variable

async function signInWithProvider(provider) {
  try {
    console.log('Attempting sign-in with provider:', provider);

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      const errorMessage = 'Google Client ID and Secret are not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.';
      console.error(errorMessage);
      alert(errorMessage);
      return; // Stop the sign-in process if credentials are missing
    }

    if (provider === 'google') {
      // Manually construct Google authorization URL for desktop flow
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(AUTH_CALLBACK_URL)}&response_type=code&scope=${encodeURIComponent('openid email profile')}`;

      console.log('Opening Google OAuth URL:', authUrl);
      shell.openExternal(authUrl);

      // Listen for the authorization code from the main process
      ipcRenderer.once('oauth-code', async (event, code) => {
        console.log('Received Google OAuth code via IPC:', code);
        if (code) {
          try {
            // Exchange authorization code for tokens with Google
            console.log('Exchanging authorization code for tokens with Google...');
            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
              code: code,
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              redirect_uri: AUTH_CALLBACK_URL,
              grant_type: 'authorization_code',
            });
            console.log('Google token exchange successful:', tokenResponse.data);

            const { id_token, access_token } = tokenResponse.data;

            if (id_token) {
              // Use the ID token to sign in with Supabase
              console.log('Signing in with Supabase using ID token...');
              const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: id_token, // Use the ID token here
              });

              if (error) {
                console.error('Supabase signInWithIdToken error:', error);
                alert('Supabase sign-in failed: ' + error.message);
              } else {
                console.log('Supabase sign-in successful:', data);
                // After login, refresh session and update UI
                const { data: { session } } = await supabase.auth.getSession();
                if (session && typeof window.handleAuthStateChange === 'function') {
                  window.handleAuthStateChange('SIGNED_IN', session);
                }
              }
            } else {
              console.warn('No ID token received from Google.');
              alert('Google sign-in did not return an ID token.');
            }

          } catch (exchangeErr) {
            console.error('Error during Google token exchange or Supabase sign-in:', exchangeErr);
            alert('Authentication exchange failed: ' + exchangeErr.message);
          }
        } else {
          console.warn('No Google OAuth code received.');
          alert('Google sign-in did not return an authorization code.');
        }
      });

      // Listen for OAuth errors from the main process
      ipcRenderer.once('oauth-error', (event, error) => {
        console.error('Received OAuth error via IPC:', error);
        alert('OAuth Error: ' + error);
      });

    } else {
      // Handle other providers using Supabase's default flow (if applicable)
      // or implement similar manual flow if needed
      console.warn(`Sign-in with provider "${provider}" not yet implemented with desktop flow.`);
      alert(`Sign-in with ${provider} is not yet supported in this desktop flow.`);
      // Example for other providers if they support http://localhost redirect:
      /*
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: AUTH_CALLBACK_URL }
      });
      if (error) throw error;
      shell.openExternal(data.url);
      // Need to handle callback for other providers if they redirect to AUTH_CALLBACK_URL
      */
    }

  } catch (err) {
    console.error('Error in signInWithProvider:', err);
    alert('Sign-in failed: ' + err.message);
  }
}

async function signOut() {
  await supabase.auth.signOut();
}

function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

module.exports = {
  supabase,
  signInWithProvider,
  signOut,
  onAuthStateChange
};

async function signOut() {
  await supabase.auth.signOut();
}

function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

module.exports = {
  supabase,
  signInWithProvider,
  signOut,
  onAuthStateChange
};

async function signOut() {
  await supabase.auth.signOut();
}

function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

module.exports = {
  supabase,
  signInWithProvider,
  signOut,
  onAuthStateChange
};
