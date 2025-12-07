# Meta App Setup for Shopify App Store Distribution

This guide explains the changes needed to your Meta (Facebook/Instagram) app configuration to make your Shopify Social Stitch app available on the Shopify App Store for public use.

## Overview

When your app is distributed through the Shopify App Store, each merchant who installs it will need to connect their own Facebook/Instagram accounts. Your Meta app must be configured to support this multi-tenant scenario.

## Key Changes Required

### 1. Submit Meta App for App Review

Your Meta app must be approved for public use before it can work for all Shopify merchants.

#### Steps:

1. **Go to Meta App Dashboard**
   - Navigate to [developers.facebook.com](https://developers.facebook.com)
   - Select your SocialStitch app

2. **Complete App Review Submission**
   - Go to **App Review** → **Permissions and Features**
   - Request approval for all permissions your app uses:
     - `pages_show_list` - List user's Facebook Pages
     - `pages_read_engagement` - Read page engagement metrics
     - `pages_manage_posts` - Publish posts to Facebook Pages
     - `instagram_basic` - Access Instagram account info
     - `instagram_content_publish` - Publish to Instagram
     - `business_management` - Manage business assets

3. **Provide Required Information**
   - **App Use Case**: Select "Manage everything on your Page" and "Manage messaging & content on Instagram"
   - **Privacy Policy URL**: Required for public apps (see section 2)
   - **Terms of Service URL**: Required for public apps (see section 2)
   - **App Icon**: 1024x1024px image
   - **App Screenshots**: Show how your app works
   - **Video Demo**: Optional but recommended

4. **Test Users**
   - Add test users who can test your app during review
   - Provide test credentials if needed

### 2. Configure OAuth Redirect URIs

**Current Issue**: Your app likely has a single redirect URI hardcoded. For App Store distribution, you need to support dynamic redirect URIs for different Shopify stores.

#### Current Configuration (in `functions/src/index.ts`):
```typescript
const redirectUri = `${config.hostingUrl}/api/auth/callback`;
```

#### Required Changes:

**Option A: Use Wildcard Domain (Recommended)**
1. In Meta App Dashboard → **Settings** → **Basic**
2. Add redirect URI with wildcard:
   ```
   https://*.yourdomain.com/api/auth/callback
   ```
   Note: Meta may not support wildcards. If not, use Option B.

**Option B: Dynamic Redirect URI Validation (Better for Production)**

Update your code to validate redirect URIs dynamically. The redirect URI should be:
- Your Firebase Hosting domain (for OAuth callback)
- Validated against an allowlist of domains

**Update `functions/src/index.ts`**:
```typescript
// Add allowed redirect URI patterns
const ALLOWED_REDIRECT_URIS = [
  'https://api.socialstitch.io/api/auth/callback',
  'https://your-production-domain.com/api/auth/callback',
  // Add your production domain here
];

function validateRedirectUri(uri: string): boolean {
  return ALLOWED_REDIRECT_URIS.some(allowed => uri === allowed);
}
```

**In Meta App Dashboard**:
- Add all production redirect URIs to **Settings** → **Basic** → **Valid OAuth Redirect URIs**
- Include your Firebase Hosting domain
- Include any custom domains you use

### 3. Switch App Mode to Production

1. **In Meta App Dashboard** → **Settings** → **Basic**
2. Change **App Mode** from "Development" to "Live"
3. This requires:
   - App Review approval (step 1)
   - Privacy Policy URL
   - Terms of Service URL
   - Valid redirect URIs

### 4. Configure Use Cases

Based on your Meta App Dashboard screenshot, configure the use cases:

1. **Go to Use Cases** section in Meta App Dashboard
2. **Customize "Manage everything on your Page"**:
   - Enable: Pages API
   - Permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
   - Extensions: None required for basic posting

3. **Customize "Manage messaging & content on Instagram"**:
   - Enable: Instagram API
   - Permissions: `instagram_basic`, `instagram_content_publish`
   - Extensions: None required for basic posting

### 5. Privacy Policy & Terms of Service

**Required for App Review and Public Distribution**

Create and host these documents:

1. **Privacy Policy** must include:
   - What data you collect (Facebook Pages, Instagram accounts, access tokens)
   - How you use the data (posting to social media, scheduling)
   - Data storage (Firestore, Firebase Storage)
   - Data sharing (only with Meta APIs for posting)
   - User rights (disconnect accounts, delete data)
   - Contact information

2. **Terms of Service** must include:
   - App functionality description
   - User responsibilities
   - Limitations of liability
   - Account termination policies

**Hosting Options**:
- Add pages to your main website
- Use Firebase Hosting static pages
- Use a service like GitHub Pages

**Add URLs to Meta App**:
- **Settings** → **Basic** → **Privacy Policy URL**
- **Settings** → **Basic** → **Terms of Service URL**

### 6. Update Code for Multi-Tenant Support

Your current code already supports multi-tenant (using `sessionId`), but verify:

**In `functions/src/index.ts`**:
- ✅ Already uses `sessionId` to scope data (good!)
- ✅ Stores accounts per session (good!)
- ⚠️ Verify redirect URI validation

**In `services/socialAuthService.ts`**:
- ✅ Already uses `getSessionId()` which works for both Firebase users and Shopify shops
- ✅ OAuth flow includes `redirectUrl` parameter (good!)

### 7. Test with Multiple Users

Before submitting to App Store:

1. **Create Test Facebook Pages**:
   - Create 2-3 test Facebook Pages
   - Link Instagram Business Accounts to them

2. **Test OAuth Flow**:
   - Install app on multiple Shopify development stores
   - Connect different Facebook/Instagram accounts
   - Verify data is isolated per shop

3. **Test Posting**:
   - Post from different shops
   - Verify posts go to correct accounts
   - Test both Facebook and Instagram

### 8. Environment Variables

Ensure your production environment has:

**Firebase Functions Config**:
```bash
firebase functions:config:set \
  meta.app_id="YOUR_META_APP_ID" \
  meta.app_secret="YOUR_META_APP_SECRET" \
  app.hosting_url="https://api.socialstitch.io" \
  app.frontend_url="https://your-shopify-app-domain.com"
```

**Important**: Never commit `app_secret` to version control. Use Firebase Functions config or environment variables.

### 9. App Store Listing Requirements

For Shopify App Store submission, you'll also need:

1. **App Store Listing**:
   - App name, description, screenshots
   - Pricing information
   - Support contact

2. **GDPR Compliance**:
   - Your app already has GDPR webhooks (`functions/src/shopify-gdpr.ts`) ✅
   - Ensure they're properly configured

3. **Billing Integration**:
   - If charging merchants, implement Shopify Billing API
   - Your app already has billing functions (`functions/src/shopify-billing.ts`) ✅

## Checklist Before App Store Submission

- [ ] Meta app submitted for App Review
- [ ] All required permissions approved
- [ ] Privacy Policy URL added to Meta app
- [ ] Terms of Service URL added to Meta app
- [ ] App Mode set to "Live" (Production)
- [ ] All redirect URIs added to Meta app settings
- [ ] Use cases configured in Meta App Dashboard
- [ ] Tested OAuth flow with multiple users
- [ ] Tested posting from multiple shops
- [ ] Environment variables configured for production
- [ ] GDPR webhooks tested
- [ ] Billing integration tested (if applicable)

## Common Issues & Solutions

### Issue: "Invalid OAuth Redirect URI"
**Solution**: Ensure the redirect URI in your code exactly matches one in Meta App Dashboard → Settings → Basic → Valid OAuth Redirect URIs

### Issue: "App Not Approved for This Permission"
**Solution**: Submit App Review request for the specific permission. Some permissions require business verification.

### Issue: "App is in Development Mode"
**Solution**: Complete App Review and switch to Live mode. Development mode only works for test users.

### Issue: "Redirect URI Mismatch"
**Solution**: For Shopify apps, the redirect URI should be your backend domain (Firebase Hosting), not the Shopify app domain. The frontend URL is passed in the state parameter.

## Next Steps

1. **Immediate**: Create Privacy Policy and Terms of Service pages
2. **Week 1**: Submit Meta App for App Review
3. **Week 2**: Test with multiple users while waiting for review
4. **Week 3**: Once approved, switch to Live mode
5. **Week 4**: Submit to Shopify App Store

## Resources

- [Meta App Review Guide](https://developers.facebook.com/docs/app-review)
- [Meta OAuth Redirect URIs](https://developers.facebook.com/docs/facebook-login/security#redirect-uri)
- [Shopify App Store Requirements](https://shopify.dev/docs/apps/store/requirements)
- [Meta Business Verification](https://www.facebook.com/business/help/2058515294227817)

## Support

If you encounter issues:
1. Check Meta App Dashboard → **Alerts** for any warnings
2. Review App Review feedback in Meta App Dashboard
3. Test with Meta's Graph API Explorer: https://developers.facebook.com/tools/explorer


