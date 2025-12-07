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

## 5. Backend OAuth Handler (Implemented)

The Shopify OAuth flow is handled by Firebase Functions. The following endpoints are available:

### OAuth Endpoints

| Endpoint | Purpose |
|----------|---------|
| `shopifyAuthStart` | Start OAuth flow, redirect to Shopify |
| `shopifyAuthCallback` | Handle OAuth callback, exchange code for token |
| `shopifyVerifySession` | Verify session token for API requests |
| `shopifyCheckInstall` | Check if a shop has installed the app |
| `shopifyAppUninstalled` | Webhook for app uninstallation |

### Shopify API Proxy Endpoints

| Endpoint | Purpose |
|----------|---------|
| `shopifyGetProducts` | Fetch merchant's products with pagination |
| `shopifyGetProduct` | Get single product by ID |
| `shopifyGetProductImages` | Get product images |
| `shopifyGetCollections` | Fetch custom and smart collections |
| `shopifySearchProducts` | Search products by title |
| `shopifyGetShop` | Get shop information |
| `shopifyProxyImage` | Proxy Shopify CDN images (CORS) |

### Billing Endpoints (Subscription Management)

| Endpoint | Purpose |
|----------|---------|
| `shopifyCreateSubscription` | Create subscription for Pro/Business tiers |
| `shopifyBillingCallback` | Handle return from Shopify payment approval |
| `shopifyGetActiveSubscription` | Get current subscription status |
| `shopifyCancelSubscription` | Cancel an active subscription |
| `shopifySubscriptionWebhook` | Handle APP_SUBSCRIPTIONS_UPDATE webhook |

### GDPR Webhooks (Required for Public Apps)

| Endpoint | Purpose |
|----------|---------|
| `gdprCustomersDataRequest` | Handle customer data requests |
| `gdprCustomersRedact` | Handle customer data deletion |
| `gdprShopRedact` | Handle shop data deletion |

### Configuration

Set Firebase config:
```bash
firebase functions:config:set \
  shopify.api_key="YOUR_KEY" \
  shopify.api_secret="YOUR_SECRET" \
  shopify.scopes="read_products" \
  shopify.app_url="https://your-app-url.com"
```

Deploy:
```bash
npm run functions:deploy
```

### Register Webhooks in Shopify Partners

In your app settings, configure these webhook URLs:

**GDPR Webhooks (Required):**
- Customer data request: `https://[YOUR_FUNCTIONS_URL]/gdprCustomersDataRequest`
- Customer data erasure: `https://[YOUR_FUNCTIONS_URL]/gdprCustomersRedact`
- Shop data erasure: `https://[YOUR_FUNCTIONS_URL]/gdprShopRedact`

**Billing Webhooks (For subscription management):**

In the Partners Dashboard, go to **Webhooks** and add:
- Topic: `APP_SUBSCRIPTIONS_UPDATE`
- URL: `https://[YOUR_FUNCTIONS_URL]/shopifySubscriptionWebhook`

This webhook is triggered when:
- A subscription is approved/activated
- A subscription is cancelled
- A subscription expires or payment fails

### Enable Billing Test Mode (Development)

For testing subscriptions without real charges:
```bash
firebase functions:config:set shopify.billing_test_mode="true"
```

When `test: true` is passed to Shopify billing mutations, charges appear as test charges and won't actually bill the merchant.

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

## Key Files

| File | Purpose |
|------|---------|
| `shopify.config.ts` | Shopify app configuration |
| `components/ShopifyProvider.tsx` | App Bridge provider and session management |
| `components/ShopifyApp.tsx` | Main Shopify embedded app with Polaris UI |
| `components/ProductBrowser.tsx` | Product catalog browser |
| `components/pages/*.tsx` | Polaris page wrappers |
| `services/shopifyAuthService.ts` | Client-side OAuth handling |
| `services/shopifyProductService.ts` | Product API client |
| `services/shopScopedStorageService.ts` | Shop-scoped data storage |
| `functions/src/shopify-auth.ts` | OAuth backend |
| `functions/src/shopify-api.ts` | API proxy |
| `functions/src/shopify-gdpr.ts` | GDPR webhooks |

## Key Differences from Web App

| Feature | Web App | Shopify App |
|---------|---------|-------------|
| Authentication | Firebase Auth | Shopify OAuth + Session Tokens |
| UI Framework | Custom styling | Hybrid (Polaris + Custom) |
| Product Source | Upload only | Shopify products + Upload |
| Data Storage | By user ID | By shop domain |
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

