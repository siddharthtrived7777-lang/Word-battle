/**
 * ============================================================================
 * FIREBASE REALTIME DATABASE CONFIGURATION & SETUP INSTRUCTIONS
 * ============================================================================
 *
 * Replace the placeholder values below with your Firebase project's config
 * (or set VITE_FIREBASE_* variables in your .env file).
 *
 * SHORT SETUP INSTRUCTIONS:
 * 1. Open https://console.firebase.google.com and create/select a project.
 * 2. In the left sidebar, go to Build -> Realtime Database -> Create Database.
 * 3. Start in test mode (or set the RTDB rules below so rooms & signals sync).
 * 4. Go to Project Settings (gear icon) -> Your Apps -> Web App (</>) -> Register.
 * 5. Copy your firebaseConfig object (including databaseURL!) into FIREBASE_CONFIG below.
 *
 * RECOMMENDED RTDB RULES (for quick testing):
 * {
 *   "rules": {
 *     "rooms": {
 *       "$roomCode": {
 *         ".read": true,
 *         ".write": true
 *       }
 *     }
 *   }
 * }
 *
 * NOTE: While FIREBASE_CONFIG contains placeholder "YOUR_*" values, this app
 * automatically connects to its built-in WebSocket room server so you can play
 * and test live multiplayer + WebRTC voice right away!
 * ============================================================================
 */

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID',
};

export function isFirebaseConfigured(): boolean {
  return (
    Boolean(FIREBASE_CONFIG.apiKey) &&
    !FIREBASE_CONFIG.apiKey.startsWith('YOUR_') &&
    Boolean(FIREBASE_CONFIG.databaseURL) &&
    !FIREBASE_CONFIG.databaseURL.includes('YOUR_PROJECT')
  );
}

export const RTDB_RULES_SNIPPET = `{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}`;
