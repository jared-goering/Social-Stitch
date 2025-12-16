# Webhook Configuration Guide

This document lists all webhooks that must be configured in the Shopify Partners Dashboard for SocialStitch to function properly.

## Required Webhooks

### 1. App Uninstallation Webhook

**Purpose:** Triggered when a merchant uninstalls the app from their store. Used to clean up data and revoke access tokens.

| Setting | Value |
|---------|-------|
| Topic | `APP_UNINSTALLED` |
| URL | `https://us-central1-social-stitch.cloudfunctions.net/shopifyAppUninstalled` |
| Format | JSON |
| API Version | 2024-10 |

### 2. Subscription Updates Webhook

**Purpose:** Triggered when a subscription status changes (approved, cancelled, expired, frozen). Essential for billing management.

| Setting | Value |
|---------|-------|
| Topic | `APP_SUBSCRIPTIONS_UPDATE` |
| URL | `https://us-central1-social-stitch.cloudfunctions.net/shopifySubscriptionWebhook` |
| Format | JSON |
| API Version | 2024-10 |

## GDPR Compliance Webhooks

These are configured in `shopify.app.toml` and should auto-sync with the Partner Dashboard when you run `shopify app deploy`.

### 3. Customer Data Request

**Purpose:** When a customer requests to know what data your app stores about them.

| Setting | Value |
|---------|-------|
| URL | `https://us-central1-social-stitch.cloudfunctions.net/gdprCustomersDataRequest` |

### 4. Customer Data Erasure

**Purpose:** When a customer requests deletion of their data.

| Setting | Value |
|---------|-------|
| URL | `https://us-central1-social-stitch.cloudfunctions.net/gdprCustomersRedact` |

### 5. Shop Data Erasure

**Purpose:** When a shop owner requests deletion of all shop data (48 hours after uninstall).

| Setting | Value |
|---------|-------|
| URL | `https://us-central1-social-stitch.cloudfunctions.net/gdprShopRedact` |

## How to Configure Webhooks

### Via Shopify CLI (Recommended)

1. Ensure your `shopify.app.toml` is up to date
2. Run:
   ```bash
   shopify app deploy
   ```
3. This syncs GDPR webhooks automatically

### Via Partner Dashboard (For APP_UNINSTALLED and APP_SUBSCRIPTIONS_UPDATE)

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Navigate to **Apps** → **SocialStitch** → **Configuration**
3. Scroll to **Webhooks** section
4. Click **Add webhook**
5. Enter the topic and URL from the tables above
6. Click **Save**

## Verification Checklist

Run through this checklist to ensure webhooks are properly configured:

- [ ] **APP_UNINSTALLED webhook registered**
  - URL: `https://us-central1-social-stitch.cloudfunctions.net/shopifyAppUninstalled`
  
- [ ] **APP_SUBSCRIPTIONS_UPDATE webhook registered**
  - URL: `https://us-central1-social-stitch.cloudfunctions.net/shopifySubscriptionWebhook`
  
- [ ] **GDPR webhooks configured in Partner Dashboard**
  - Customer data request URL set
  - Customer data erasure URL set
  - Shop data erasure URL set

- [ ] **Deploy shopify.app.toml changes**
  - Run `shopify app deploy` to sync configuration

## Testing Webhooks

### Using Shopify CLI

Test GDPR webhooks:
```bash
# Test customer data request
shopify app webhook trigger --topic CUSTOMERS_DATA_REQUEST

# Test customer data erasure  
shopify app webhook trigger --topic CUSTOMERS_REDACT

# Test shop data erasure
shopify app webhook trigger --topic SHOP_REDACT
```

### Manual Testing

1. Install the app on a development store
2. Uninstall the app
3. Check Firebase Functions logs for `shopifyAppUninstalled` execution
4. Verify data cleanup in Firestore

## Troubleshooting

### Webhook not triggering

1. Verify the URL is correct and accessible
2. Check Firebase Functions are deployed: `firebase functions:list`
3. Check Firebase Functions logs: `firebase functions:log`

### HMAC verification failing

1. Ensure `shopify.api_secret` is correctly set in Firebase config
2. Verify the raw body is being passed correctly

### Webhook returning errors

1. Check Firebase Functions logs for detailed error messages
2. Verify Firestore permissions allow the function to write

## Firebase Functions Config

Ensure these are set in your Firebase project:

```bash
firebase functions:config:set \
  shopify.api_key="YOUR_API_KEY" \
  shopify.api_secret="YOUR_API_SECRET" \
  shopify.app_url="https://app.socialstitch.io" \
  shopify.scopes="read_products,write_products,read_content"
```

To verify current config:
```bash
firebase functions:config:get
```


