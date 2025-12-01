<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Wd-6--Uep8Ih0kPWDkHSXSkmsvERiGJO

## Run Locally

**Prerequisites:**  Node.js, Firebase CLI

1. Install dependencies:
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. Run the app:
   ```bash
   npm run dev
   ```

## Social Account Integration Setup

To enable real Facebook and Instagram posting, you need to set up Firebase and Meta Developer credentials.

### 1. Firebase Setup

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Create a new project at [console.firebase.google.com](https://console.firebase.google.com)
4. Enable Cloud Functions (requires Blaze/pay-as-you-go plan)
5. Enable Firestore Database
6. Update `.firebaserc` with your project ID

### 2. Meta (Facebook) Developer Setup

1. Go to [developers.facebook.com](https://developers.facebook.com) and create an app
2. Select **Business** type (required for Instagram Graph API)
3. Add these products:
   - **Facebook Login**
   - **Instagram Graph API**
4. Under Facebook Login > Settings, add OAuth redirect URI:
   - Local: `http://localhost:5001/YOUR-PROJECT-ID/us-central1/authCallback`
   - Production: `https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/authCallback`
5. Get your **App ID** and **App Secret**

### 3. Configure Firebase Functions

Set your Meta credentials using Firebase config:

```bash
firebase functions:config:set meta.app_id="YOUR_APP_ID" meta.app_secret="YOUR_APP_SECRET"
firebase functions:config:set app.functions_url="https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net"
firebase functions:config:set app.frontend_url="http://localhost:5173"
```

### 4. Update Frontend Config

Edit `services/firebaseConfig.ts` and update `FUNCTIONS_BASE_URL` with your Firebase Functions URL, or set `VITE_FIREBASE_FUNCTIONS_URL` in your `.env.local`:

```
VITE_FIREBASE_FUNCTIONS_URL=https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net
```

### 5. Deploy Functions

```bash
npm run functions:deploy
```

### 6. Run with Emulators (Local Development)

For local testing with Firebase emulators:

```bash
npm run functions:serve
```

Then in another terminal:
```bash
npm run dev
```

## Important Notes

- **Instagram Requirements**: Instagram posting requires a Facebook Page connected to an Instagram Business or Creator account
- **Token Expiration**: Access tokens expire after ~60 days. Production apps should implement token refresh
- **Meta App Review**: For production use with other users, your Meta app needs to go through App Review

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run frontend in development mode |
| `npm run build` | Build frontend for production |
| `npm run functions:build` | Build Firebase functions |
| `npm run functions:serve` | Run Firebase emulators locally |
| `npm run functions:deploy` | Deploy functions to Firebase |
| `npm run firebase:deploy` | Deploy everything to Firebase |
