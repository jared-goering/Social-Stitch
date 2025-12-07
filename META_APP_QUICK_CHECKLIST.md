# Meta App Store Setup - Quick Checklist

## Critical Steps for App Store Distribution

### 1. Meta App Dashboard Configuration

- [ ] **App Review**: Submit app for review with all required permissions
  - `pages_show_list`
  - `pages_read_engagement`
  - `pages_manage_posts`
  - `instagram_basic`
  - `instagram_content_publish`
  - `business_management`

- [ ] **Privacy Policy**: Add Privacy Policy URL
  - Location: Settings → Basic → Privacy Policy URL
  - Must be publicly accessible

- [ ] **Terms of Service**: Add Terms of Service URL
  - Location: Settings → Basic → Terms of Service URL
  - Must be publicly accessible

- [ ] **OAuth Redirect URIs**: Add your production redirect URI
  - Location: Settings → Basic → Valid OAuth Redirect URIs
  - Example: `https://api.socialstitch.io/api/auth/callback`
  - Must match exactly what's in your code

- [ ] **App Mode**: Switch from "Development" to "Live"
  - Location: Settings → Basic → App Mode
  - Requires App Review approval first

- [ ] **Use Cases**: Configure use cases
  - Location: Use cases section
  - Enable: "Manage everything on your Page"
  - Enable: "Manage messaging & content on Instagram"

### 2. Code Configuration

- [ ] **Environment Variables**: Set production Firebase Functions config
  ```bash
  firebase functions:config:set \
    meta.app_id="YOUR_META_APP_ID" \
    meta.app_secret="YOUR_META_APP_SECRET" \
    app.hosting_url="https://api.socialstitch.io" \
    app.frontend_url="https://your-shopify-app-domain.com"
  ```

- [ ] **Redirect URI**: Verify redirect URI in code matches Meta Dashboard
  - File: `functions/src/index.ts`
  - Line: `const redirectUri = \`${config.hostingUrl}/api/auth/callback\`;`
  - Must match exactly what's in Meta App Dashboard

### 3. Testing

- [ ] **Multi-User Test**: Test OAuth with 2+ different Facebook accounts
- [ ] **Multi-Shop Test**: Test with 2+ different Shopify stores
- [ ] **Posting Test**: Verify posts go to correct accounts
- [ ] **Data Isolation**: Verify data is isolated per shop

### 4. Documentation

- [ ] **Privacy Policy**: Create and host privacy policy page
- [ ] **Terms of Service**: Create and host terms of service page
- [ ] **App Store Listing**: Prepare Shopify App Store listing materials

## Common Mistakes to Avoid

❌ **Don't**: Use different redirect URIs for different shops
✅ **Do**: Use a single backend redirect URI, pass frontend URL in state

❌ **Don't**: Submit App Review without Privacy Policy
✅ **Do**: Create Privacy Policy first, then submit

❌ **Don't**: Leave app in Development mode
✅ **Do**: Switch to Live mode after App Review approval

❌ **Don't**: Hardcode redirect URIs in multiple places
✅ **Do**: Use environment variables for all URLs

## Timeline Estimate

- **Week 1**: Create Privacy Policy & Terms, submit App Review
- **Week 2-3**: Wait for Meta App Review (typically 7-14 days)
- **Week 4**: Switch to Live mode, test thoroughly
- **Week 5**: Submit to Shopify App Store

## Need Help?

See detailed guide: `META_APP_STORE_SETUP.md`


