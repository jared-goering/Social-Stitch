/**
 * Firebase Configuration for SocialStitch
 * 
 * Replace the config values with your Firebase project's configuration
 * Get these from: Firebase Console > Project Settings > General > Your apps
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'social-stitch.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'social-stitch',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'social-stitch.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore, Storage, and Auth
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Connect to emulators only when explicitly enabled
// Set VITE_USE_EMULATORS=true in .env to use local emulators
const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
if (useEmulators) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.log('Connected to Firebase emulators');
  } catch (e) {
    // Emulators already connected
  }
}

// Firebase Functions base URL
// For local development with emulator: http://localhost:5001/YOUR-PROJECT-ID/us-central1
// For production: https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net
export const FUNCTIONS_BASE_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 
  'http://localhost:5001/social-stitch/us-central1';

// Helper to build function URLs
export const getFunctionUrl = (functionName: string): string => {
  return `${FUNCTIONS_BASE_URL}/${functionName}`;
};

