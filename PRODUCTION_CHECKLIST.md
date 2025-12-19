# Production Deployment Checklist

Complete this checklist before submitting SocialStitch for Shopify App Store review.

## Environment Configuration

### Frontend Environment Variables (Vercel/Hosting)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_APP_MODE` | Yes | Must be `shopify` for embedded app | `shopify` |
| `VITE_SHOPIFY_API_KEY` | Yes | Shopify app API key | `7511594b1231...` |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web API key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain | `social-stitch.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID | `social-stitch` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket | `social-stitch.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging ID | `123456789` |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID | `1:123:web:abc` |
| `VITE_FIREBASE_FUNCTIONS_URL` | Yes | Firebase Functions base URL | `https://us-central1-social-stitch.cloudfunctions.net` |
| `VITE_GEMINI_API_KEY` | Yes | Google Gemini API key | `AIzaSy...` |
| `VITE_DEMO_MODE` | No | Set to `true` for demo only | `false` |

### Firebase Functions Configuration

Set these using `firebase functions:config:set`:

```bash
firebase functions:config:set \
  shopify.api_key="YOUR_SHOPIFY_API_KEY" \
  shopify.api_secret="YOUR_SHOPIFY_API_SECRET" \
  shopify.app_url="https://app.socialstitch.io" \
  shopify.scopes="read_products,write_products,read_content" \
  meta.app_id="YOUR_META_APP_ID" \
  meta.app_secret="YOUR_META_APP_SECRET" \
  app.functions_url="https://us-central1-social-stitch.cloudfunctions.net" \
  app.hosting_url="https://api.socialstitch.io" \
  app.frontend_url="https://app.socialstitch.io"
```

#### Billing Test Mode (IMPORTANT)

For production, ensure billing test mode is **NOT** set:

```bash
# Check current config
firebase functions:config:get shopify

# If billing_test_mode exists and is "true", remove it:
firebase functions:config:unset shopify.billing_test_mode
```

⚠️ **Warning**: If `shopify.billing_test_mode` is set to `"true"`, all subscriptions will be created as test charges and merchants won't be billed.

#### Debugging Billing Issues

If billing failures occur, check Firebase Functions logs for detailed error information:

```bash
# View recent billing-related logs
firebase functions:log --only shopifyCreateSubscription

# Search for specific request ID (shown in error messages)
firebase functions:log | grep "req_"
```

Each billing request includes a unique `requestId` (e.g., `req_1703001234567_abc123`) that can be used to trace the full request lifecycle in logs.

**Common Error Codes:**
- `CONFIG_ERROR` - Firebase Functions config missing `shopify.app_url` or `shopify.api_key`
- `NO_ACCESS_TOKEN` - Shop needs to reinstall the app
- `DUPLICATE_REQUEST` - User double-clicked; wait and retry
- `ALREADY_SUBSCRIBED` - Already on the requested tier
- `SUBSCRIPTION_CREATE_FAILED` - Shopify API error (check logs for details)

### Verify Firebase Configuration

```bash
# View all config
firebase functions:config:get

# Expected output should include:
# - shopify.api_key
# - shopify.api_secret
# - shopify.app_url
# - meta.app_id
# - meta.app_secret
# - app.functions_url
```

## Shopify Partner Dashboard

### App Configuration

- [ ] **App name**: SocialStitch
- [ ] **App URL**: `https://app.socialstitch.io`
- [ ] **Embedded**: Yes
- [ ] **OAuth redirect URL**: `https://us-central1-social-stitch.cloudfunctions.net/shopifyAuthCallback`

### API Scopes

Verify these scopes are configured:
- [ ] `read_products` - Display product catalog
- [ ] `write_products` - Save mockups to products
- [ ] `read_content` - Brand profile analysis

### Webhooks

Register these webhooks in Partner Dashboard:
- [ ] `APP_UNINSTALLED` → `https://us-central1-social-stitch.cloudfunctions.net/shopifyAppUninstalled`
- [ ] `APP_SUBSCRIPTIONS_UPDATE` → `https://us-central1-social-stitch.cloudfunctions.net/shopifySubscriptionWebhook`

### GDPR Compliance

Verify GDPR webhook URLs (auto-synced from `shopify.app.toml`):
- [ ] Customer data request URL
- [ ] Customer data erasure URL
- [ ] Shop data erasure URL

## Firebase Project

### Security Rules

- [ ] Deploy updated Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy updated Storage rules: `firebase deploy --only storage`
- [ ] Verify sensitive collections are protected (shopifyStores, gdprRequests)

### Functions Deployment

```bash
# Build functions
cd functions && npm run build

# Deploy functions
firebase deploy --only functions

# Verify deployment
firebase functions:list
```

### Verify Functions

Test that critical functions respond:
```bash
# Check health (should return error about missing params)
curl https://us-central1-social-stitch.cloudfunctions.net/shopifyCheckInstall

# Expected: {"error":"Missing shop parameter"}
```

## Meta (Facebook/Instagram)

### App Dashboard

- [ ] **App Mode**: Live (not Development)
- [ ] **Valid OAuth Redirect URIs**: `https://api.socialstitch.io/api/auth/callback`
- [ ] **Data Deletion Request URL**: `https://us-central1-social-stitch.cloudfunctions.net/metaDataDeletion`
- [ ] **Privacy Policy URL**: `https://api.socialstitch.io/privacy`
- [ ] **Terms of Service URL**: `https://api.socialstitch.io/terms`

### Required Permissions

Verify these permissions are approved:
- [ ] `pages_show_list`
- [ ] `pages_read_engagement`
- [ ] `pages_manage_posts`
- [ ] `instagram_basic`
- [ ] `instagram_content_publish`

## Deployment Commands

### Full Deployment

```bash
# 1. Build frontend
npm run build

# 2. Deploy frontend to Vercel
vercel --prod

# 3. Build and deploy functions
cd functions && npm run build && cd ..
firebase deploy --only functions

# 4. Deploy security rules
firebase deploy --only firestore:rules,storage

# 5. Deploy Shopify app config
shopify app deploy
```

### Verify Deployment

```bash
# Check Vercel deployment
curl -I https://app.socialstitch.io

# Check functions
curl https://us-central1-social-stitch.cloudfunctions.net/shopifyCheckInstall

# Check hosting pages
curl -I https://api.socialstitch.io/privacy
```

## Pre-Submission Testing

### OAuth Flow

- [ ] Fresh install on development store works
- [ ] OAuth completes and redirects correctly
- [ ] Shop data is stored in Firestore

### Core Features

- [ ] Product browsing loads products
- [ ] Product image selection works
- [ ] Mockup generation completes
- [ ] Caption generation works
- [ ] Scheduling posts works
- [ ] Calendar displays posts correctly
- [ ] Gallery shows saved mockups

### Billing

- [ ] Subscription creation shows Shopify payment screen
- [ ] Payment approval updates subscription status
- [ ] Subscription cancellation works
- [ ] Free tier limits are enforced

### GDPR

- [ ] Test webhooks with Shopify CLI:
  ```bash
  shopify app webhook trigger --topic CUSTOMERS_DATA_REQUEST
  shopify app webhook trigger --topic CUSTOMERS_REDACT
  shopify app webhook trigger --topic SHOP_REDACT
  ```

### Error Handling

- [ ] Invalid shop domain shows appropriate error
- [ ] Missing session redirects to OAuth
- [ ] API errors display user-friendly messages

## App Store Listing

Before submission, prepare:

- [ ] **App icon**: 512x512 and 1200x1200 PNG
- [ ] **Screenshots**: Desktop (1440x900) and mobile (375x667)
- [ ] **App description**: Features and benefits
- [ ] **Demo video**: 30-60 seconds (recommended)
- [ ] **Support contact**: Email and URL
- [ ] **Categories**: Marketing, Social media

## Final Checks

- [ ] No hardcoded credentials in code
- [ ] No console.log statements with sensitive data
- [ ] Error messages don't expose internal details
- [ ] All URLs use HTTPS
- [ ] CORS is properly configured
- [ ] Rate limiting considerations documented

---

## Quick Reference

### Important URLs

| Service | URL |
|---------|-----|
| App (Frontend) | `https://app.socialstitch.io` |
| API (Firebase Hosting) | `https://api.socialstitch.io` |
| Functions | `https://us-central1-social-stitch.cloudfunctions.net` |
| Partner Dashboard | `https://partners.shopify.com` |
| Firebase Console | `https://console.firebase.google.com/project/social-stitch` |
| Meta Developer | `https://developers.facebook.com` |

### Emergency Rollback

```bash
# Rollback functions to previous version
firebase functions:delete <function_name>
firebase deploy --only functions

# Rollback Vercel deployment
vercel rollback
```


