# Shopify App - Quick Start

This is a condensed guide to get the Shopify version running quickly. For full details, see [SHOPIFY_SETUP.md](./SHOPIFY_SETUP.md).

## 1. Install Dependencies

```bash
npm install
```

New Shopify packages added:
- `@shopify/app-bridge` - Core Shopify App Bridge
- `@shopify/app-bridge-react` - React components for App Bridge
- `@shopify/polaris` - Shopify's design system

## 2. Create Shopify App

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. **Apps** → **Create app** → **Create app manually**
3. Note your **API Key** and **API Secret**

## 3. Configure Environment

Copy to `.env.local`:

```env
VITE_APP_MODE=shopify
VITE_SHOPIFY_API_KEY=your_api_key
VITE_SHOPIFY_API_SECRET=your_api_secret
VITE_SHOPIFY_REDIRECT_URI=https://your-app.com/api/auth/callback

# Keep existing Firebase and Gemini configs
VITE_FIREBASE_API_KEY=...
VITE_GEMINI_API_KEY=...
```

## 4. Implement OAuth Backend

**Important**: You need a backend endpoint to handle OAuth token exchange.

Quick option - Add to Firebase Functions:

```bash
# Set Shopify credentials
firebase functions:config:set \
  shopify.api_key="YOUR_KEY" \
  shopify.api_secret="YOUR_SECRET"

# Deploy functions
npm run functions:deploy
```

See `SHOPIFY_SETUP.md` section 5 for complete OAuth implementation.

## 5. Local Testing

```bash
# Terminal 1: Run Firebase emulators
npm run functions:serve

# Terminal 2: Run dev server
npm run dev

# Terminal 3: Expose with ngrok
ngrok http 5173
```

Update your Shopify app URL to the ngrok URL and install on a development store.

## 6. Deploy

```bash
# Build frontend
npm run build

# Deploy to Vercel (set VITE_APP_MODE=shopify in dashboard)
vercel deploy

# Deploy Firebase Functions
npm run functions:deploy
```

## Key Files

- `shopify.config.ts` - Shopify configuration
- `services/shopifyAuthService.ts` - OAuth handling
- `components/ShopifyProvider.tsx` - App Bridge provider
- `index.tsx` - Entry point (wraps app with ShopifyProvider)

## Architecture Differences

```
Web App:              Shopify App:
┌─────────────┐      ┌─────────────┐
│ Firebase    │      │ Shopify     │
│ Auth        │──►   │ OAuth       │
└─────────────┘      └─────────────┘
       │                    │
       ▼                    ▼
┌─────────────┐      ┌─────────────┐
│ React App   │      │ App Bridge  │
│ (Standalone)│      │ (Embedded)  │
└─────────────┘      └─────────────┘
```

## Testing Checklist

- [ ] OAuth completes without errors
- [ ] App loads in Shopify admin iframe
- [ ] Can upload and generate mockups
- [ ] AI features work (Gemini API)
- [ ] Can schedule posts
- [ ] Session persists

## Troubleshooting

**"Shop parameter missing"**
→ Access app through Shopify admin, not direct URL

**App Bridge errors**
→ Check `VITE_SHOPIFY_API_KEY` is correct and `host` param exists

**OAuth fails**
→ Verify backend endpoint is deployed and redirect URI matches

## Next Steps

1. ✅ Branch created (`shopify-app`)
2. ⏳ Implement OAuth backend
3. ⏳ Test on development store
4. ⏳ Add Shopify-specific features
5. ⏳ Submit for app review

## Need Help?

- [Shopify App Dev Docs](https://shopify.dev/docs/apps)
- [App Bridge Documentation](https://shopify.dev/docs/api/app-bridge)
- [Full Setup Guide](./SHOPIFY_SETUP.md)



