# Shopify App Setup Guide

This branch (`shopify-app`) contains a Shopify-embedded version of SocialStitch that can be installed in Shopify stores.

## Overview

The Shopify app version allows merchants to:
- Generate AI-powered social media content directly from their Shopify admin
- Use their product images or upload custom designs
- Schedule posts to Facebook and Instagram
- Manage their social media calendar within Shopify

## Prerequisites

- Node.js 20.x or later
- Shopify Partners account ([sign up here](https://partners.shopify.com/))
- Firebase project (same as web app)
- Google Gemini API key (same as web app)

## 1. Create Shopify App in Partners Dashboard

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Click **Apps** > **Create app**
3. Choose **Create app manually**
4. Fill in app details:
   - **App name**: SocialStitch (or your preferred name)
   - **App URL**: `https://your-app-url.com` (will update after deployment)
   - **Allowed redirection URL(s)**: `https://your-app-url.com/api/auth/callback`

5. Navigate to **Configuration** and set:
   - **Embedded**: Yes (this is an embedded app)
   - **App URL**: Your deployed app URL
   - **GDPR webhooks**: (optional, recommended for production)

## 2. Configure API Scopes

In the Partners dashboard, under **API access**:

1. Select the following scopes (or adjust based on your needs):
   - `read_products` - Read product information
   - `write_products` - Needed if you want to tag products
   - `read_content` - For accessing store content
   
2. Save the scopes

## 3. Set Up Environment Variables

Create a `.env.local` file with the following (see `ENV_SHOPIFY_EXAMPLE.md` for full template):

```env
# Enable Shopify mode
VITE_APP_MODE=shopify

# Shopify credentials (from Partners Dashboard)
VITE_SHOPIFY_API_KEY=your_api_key_here
VITE_SHOPIFY_API_SECRET=your_api_secret_here
VITE_SHOPIFY_REDIRECT_URI=https://your-app-url.com/api/auth/callback

# Keep same Firebase config as web app
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_FUNCTIONS_URL=...

# Keep same Gemini API key
VITE_GEMINI_API_KEY=...
```

## 4. Install Dependencies

```bash
npm install
cd functions && npm install && cd ..
```

## 5. Backend OAuth Handler (Required)

The Shopify OAuth flow requires a secure backend endpoint. You have two options:

### Option A: Add to Firebase Functions

Create `functions/src/shopify-auth.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

export const shopifyAuthCallback = functions.https.onRequest(async (req, res) => {
  const { code, shop, state } = req.query;
  
  // Verify state to prevent CSRF
  // Exchange code for access token
  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: functions.config().shopify.api_key,
      client_secret: functions.config().shopify.api_secret,
      code,
    }),
  });
  
  const data = await response.json();
  
  // Store access token securely in Firestore
  await admin.firestore().collection('shopifyStores').doc(shop).set({
    accessToken: data.access_token,
    scope: data.scope,
    installedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  // Redirect back to app with success
  res.redirect(`/?shop=${shop}&auth_success=true`);
});
```

Set Firebase config:
```bash
firebase functions:config:set shopify.api_key="YOUR_KEY" shopify.api_secret="YOUR_SECRET"
```

Deploy:
```bash
npm run functions:deploy
```

### Option B: Create Express Backend

If you prefer a separate backend, create a simple Express server to handle OAuth.

## 6. Local Development

```bash
# Run Firebase emulators (if using Firebase backend)
npm run functions:serve

# In another terminal, run the app
npm run dev
```

To test locally:
1. Use [ngrok](https://ngrok.com/) to expose your local server:
   ```bash
   ngrok http 5173
   ```
2. Update your Shopify app URL to the ngrok URL
3. Install the app on a development store

## 7. Deploy to Production

### Frontend Deployment (Vercel/Netlify)

The app can be deployed like the web version:

```bash
npm run build
```

Then deploy to Vercel:
- Set all environment variables in Vercel dashboard
- Ensure `VITE_APP_MODE=shopify`

### Backend Deployment

Deploy Firebase Functions:
```bash
npm run functions:deploy
```

## 8. Install on Development Store

1. In Partners dashboard, select your app
2. Click **Select store** > Choose a development store
3. Click **Install app**
4. Test the OAuth flow and app functionality

## Key Differences from Web App

| Feature | Web App | Shopify App |
|---------|---------|-------------|
| Authentication | Firebase Auth | Shopify OAuth |
| UI Framework | Custom styling | Shopify Polaris (optional) |
| Deployment | Vercel | Vercel + Shopify Partners |
| Installation | Direct URL | Via Shopify App Store |
| User Context | Individual users | Shopify merchants |

## Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] App loads within Shopify admin
- [ ] Can upload designs and generate mockups
- [ ] AI caption generation works
- [ ] Can schedule posts to social media
- [ ] Calendar view displays correctly
- [ ] Gallery view works
- [ ] Session persists across navigation

## Troubleshooting

### "Shop parameter missing" error
- Ensure you're accessing the app through Shopify admin, not directly
- Check that `shop` query parameter is present in URL

### App Bridge errors
- Verify `VITE_SHOPIFY_API_KEY` is set correctly
- Ensure `host` parameter is present (Shopify provides this)
- Check browser console for specific App Bridge errors

### OAuth redirect issues
- Confirm redirect URI in Partners dashboard matches your backend
- Verify backend OAuth handler is deployed and accessible
- Check Firebase Functions logs for errors

## Production Considerations

Before going live:

1. **App Review**: Submit app for Shopify review if listing publicly
2. **Scopes**: Request only the scopes you actually need
3. **GDPR**: Implement required webhooks for data deletion/access
4. **Billing**: Set up app billing if charging merchants
5. **Error Handling**: Add comprehensive error logging
6. **Rate Limiting**: Respect Shopify API rate limits
7. **Security**: Validate all Shopify webhooks with HMAC

## Switching Between Web and Shopify Versions

To switch back to web app:
```bash
git checkout master
```

To return to Shopify version:
```bash
git checkout shopify-app
```

Merge improvements:
```bash
# On shopify-app branch
git merge master

# Or merge Shopify features back to master
git checkout master
git merge shopify-app
```

## Support

For issues specific to:
- **Shopify integration**: Check [Shopify Dev Docs](https://shopify.dev/docs/apps)
- **App Bridge**: See [App Bridge docs](https://shopify.dev/docs/api/app-bridge)
- **Core functionality**: Refer to main README.md

## Next Steps

1. Complete OAuth backend implementation
2. Test on development store
3. Add Shopify-specific features (product import, etc.)
4. Customize UI with Shopify Polaris components (optional)
5. Submit for app review

