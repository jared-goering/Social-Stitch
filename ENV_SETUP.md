# Environment Variables Setup Guide

## Required Environment Variables

All client-side environment variables must be prefixed with `VITE_` to be accessible in your React app.

### For Local Development (.env.local)

**Copy this into your `.env.local` file with your actual values:**

```bash
# Gemini AI API Key (REQUIRED - MUST have VITE_ prefix)

# Firebase Configuration (from Firebase Console)
VITE_GEMINI_API_KEY=AIzaSyAogVVpWr_iZtjDCs40weoxIE5rDxngUd0
VITE_FIREBASE_API_KEY=AIzaSyAds5_QuNe2z5hQBnHJyZbn5T5wnfUGmYU
VITE_FIREBASE_AUTH_DOMAIN=social-stitch.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=social-stitch
VITE_FIREBASE_STORAGE_BUCKET=social-stitch.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=37796308186
VITE_FIREBASE_APP_ID=1:37796308186:web:83f2fcd5b56c06cb54b1e3

# Firebase Functions URL
VITE_FIREBASE_FUNCTIONS_URL=https://us-central1-social-stitch.cloudfunctions.net

# Optional: For local Firebase emulators (set to true to use local emulators)
VITE_USE_EMULATORS=false
```

## Important Notes

1. **Gemini API Key**: Must be `VITE_GEMINI_API_KEY` (not `GEMINI_API_KEY`)
   - The code will check for both, but only `VITE_` prefixed vars work in Vite

2. **Storage Bucket**: Remove the `gs://` prefix
   - ❌ Wrong: `gs://social-stitch.firebasestorage.app`
   - ✅ Correct: `social-stitch.firebasestorage.app`

3. **Firebase Variables**: All need `VITE_` prefix to work in client-side code
   - Get these from: Firebase Console → Project Settings → General → Your apps

4. **Server-side Only** (Firebase Functions - do NOT use VITE_ prefix):
   ```
   META_APP_ID=1210700684500613
   META_APP_SECRET=842aed7956703d3e0a02e1a51d1a9b0c
   ```
   These are set via Firebase Functions config, not in `.env.local`

## For Vercel Deployment

Add all the `VITE_` prefixed variables in your Vercel dashboard:
- Settings → Environment Variables
- Add each variable with the exact same name
- Deploy after adding all variables

## Getting Your Firebase Values

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `social-stitch`
3. Click the gear icon → Project Settings
4. Scroll down to "Your apps" section
5. Copy the values from the Firebase config object

**Your Firebase Config Values (from Firebase Console):**
```javascript
{
  apiKey: "AIzaSyAds5_QuNe2z5hQBnHJyZbn5T5wnfUGmYU",           // → VITE_FIREBASE_API_KEY
  authDomain: "social-stitch.firebaseapp.com",                 // → VITE_FIREBASE_AUTH_DOMAIN
  projectId: "social-stitch",                                  // → VITE_FIREBASE_PROJECT_ID
  storageBucket: "social-stitch.firebasestorage.app",          // → VITE_FIREBASE_STORAGE_BUCKET (no gs://)
  messagingSenderId: "37796308186",                            // → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:37796308186:web:83f2fcd5b56c06cb54b1e3"           // → VITE_FIREBASE_APP_ID
}
```

✅ **Note**: The `storageBucket` value is already correct (no `gs://` prefix needed)

