/**
 * Authentication Service for SocialStitch
 * Handles Google Sign-In via Firebase Auth
 */

import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User
} from 'firebase/auth';
import { auth } from './firebaseConfig';

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google using a popup
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Subscribe to auth state changes
 * Returns an unsubscribe function
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the current authenticated user (synchronous, may be null during initialization)
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}




