"use strict";
/**
 * Shopify Billing Module
 *
 * Handles subscription billing via Shopify's GraphQL Admin API:
 * - Create subscriptions (appSubscriptionCreate)
 * - Cancel subscriptions (appSubscriptionCancel)
 * - Query active subscriptions
 * - Handle billing webhooks (APP_SUBSCRIPTIONS_UPDATE)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopifySubscriptionWebhook = exports.shopifyCancelSubscription = exports.shopifyGetActiveSubscription = exports.shopifyBillingCallback = exports.shopifyCreateSubscription = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const shopify_auth_1 = require("./shopify-auth");
const corsHandler = (0, cors_1.default)({ origin: true });
// Shopify API version for GraphQL
const API_VERSION = '2024-10';
// Get Shopify configuration
const getShopifyConfig = () => {
    var _a, _b, _c, _d;
    const config = functions.config();
    return {
        apiKey: ((_a = config.shopify) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.SHOPIFY_API_KEY || '',
        apiSecret: ((_b = config.shopify) === null || _b === void 0 ? void 0 : _b.api_secret) || process.env.SHOPIFY_API_SECRET || '',
        appUrl: ((_c = config.shopify) === null || _c === void 0 ? void 0 : _c.app_url) || process.env.SHOPIFY_APP_URL || '',
        // Test mode for development - charges won't actually bill
        testMode: ((_d = config.shopify) === null || _d === void 0 ? void 0 : _d.billing_test_mode) === 'true' ||
            process.env.SHOPIFY_BILLING_TEST_MODE === 'true' ||
            false,
    };
};
const SUBSCRIPTION_TIERS = {
    free: {
        id: 'free',
        name: 'Free',
        monthlyPriceCents: 0,
        imageQuota: 10,
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        monthlyPriceCents: 2900, // $29
        imageQuota: 100,
    },
    business: {
        id: 'business',
        name: 'Business',
        monthlyPriceCents: 7900, // $79
        imageQuota: 300,
    },
};
/**
 * Generate a unique request ID for tracing
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
/**
 * Make GraphQL request to Shopify Admin API
 * Enhanced with detailed error logging for debugging
 */
async function shopifyGraphQL(shop, accessToken, query, variables, requestId) {
    const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
    const logPrefix = requestId ? `[${requestId}]` : '[shopifyGraphQL]';
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
        });
    }
    catch (fetchError) {
        console.error(`${logPrefix} Network error calling Shopify API:`, {
            shop,
            error: fetchError.message,
            cause: fetchError.cause,
        });
        throw new Error(`Network error: ${fetchError.message}`);
    }
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`${logPrefix} Shopify GraphQL HTTP error:`, {
            shop,
            status: response.status,
            statusText: response.statusText,
            body: errorText.substring(0, 500), // Truncate for logging
        });
        // Special handling for 401 - invalid access token
        if (response.status === 401) {
            console.error(`${logPrefix} CRITICAL: Invalid access token for shop ${shop} - token needs refresh`);
            // Mark the token as invalid in Firestore so it can be refreshed
            try {
                const db = admin.firestore();
                await db.collection('shopifyStores').doc(shop).update({
                    accessTokenInvalid: true,
                    accessTokenInvalidAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            catch (dbError) {
                console.error(`${logPrefix} Failed to mark token as invalid:`, dbError);
            }
            throw new Error('INVALID_ACCESS_TOKEN: Your app authorization has expired. Please reinstall the app from the Shopify App Store.');
        }
        throw new Error(`Shopify API error (${response.status}): ${errorText.substring(0, 200)}`);
    }
    let result;
    try {
        result = await response.json();
    }
    catch (parseError) {
        console.error(`${logPrefix} Failed to parse Shopify response:`, {
            shop,
            error: parseError.message,
        });
        throw new Error('Invalid response from Shopify API');
    }
    // Check for GraphQL-level errors
    if (result.errors && result.errors.length > 0) {
        console.error(`${logPrefix} GraphQL errors:`, {
            shop,
            errors: result.errors,
        });
        throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }
    // Validate we got data
    if (!result.data) {
        console.error(`${logPrefix} No data in Shopify response:`, {
            shop,
            result: JSON.stringify(result).substring(0, 500),
        });
        throw new Error('No data returned from Shopify API');
    }
    return result.data;
}
/**
 * GraphQL mutation to create an app subscription
 */
const CREATE_SUBSCRIPTION_MUTATION = `
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      lineItems: $lineItems
    ) {
      appSubscription {
        id
        status
        name
        createdAt
        currentPeriodEnd
        trialDays
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;
/**
 * GraphQL mutation to cancel an app subscription
 */
const CANCEL_SUBSCRIPTION_MUTATION = `
  mutation AppSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;
/**
 * GraphQL query to get active subscriptions
 */
const GET_ACTIVE_SUBSCRIPTIONS_QUERY = `
  query {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        createdAt
        currentPeriodEnd
        trialDays
        test
        lineItems {
          id
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;
/**
 * Create a new subscription for a shop
 * POST /shopifyCreateSubscription
 * Body: { tier: 'pro' | 'business' }
 *
 * Enhanced with:
 * - Request ID tracing for debugging
 * - Detailed error logging
 * - Configuration validation
 * - Existing subscription detection
 * - Idempotency check for double-click prevention
 */
exports.shopifyCreateSubscription = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b, _c, _d;
        const requestId = generateRequestId();
        const logPrefix = `[shopifyCreateSubscription][${requestId}]`;
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed', requestId });
            return;
        }
        // Verify session
        const session = await (0, shopify_auth_1.verifyRequestSession)(req);
        if (!session.valid || !session.shop) {
            console.log(`${logPrefix} Session invalid:`, { error: session.error });
            res.status(401).json({ error: session.error || 'Unauthorized', requestId });
            return;
        }
        const shop = session.shop;
        const { tier } = req.body;
        console.log(`${logPrefix} Request received:`, { shop, tier });
        // Validate tier
        if (!tier || !['pro', 'business'].includes(tier)) {
            console.log(`${logPrefix} Invalid tier:`, { tier });
            res.status(400).json({ error: 'Invalid tier. Must be "pro" or "business"', requestId });
            return;
        }
        const tierConfig = SUBSCRIPTION_TIERS[tier];
        if (!tierConfig || tierConfig.monthlyPriceCents === 0) {
            res.status(400).json({ error: 'Cannot create subscription for free tier', requestId });
            return;
        }
        // Validate configuration BEFORE making any API calls
        const config = getShopifyConfig();
        if (!config.appUrl) {
            console.error(`${logPrefix} CRITICAL: appUrl not configured in Firebase config`);
            res.status(500).json({
                error: 'Billing configuration error. Please contact support.',
                code: 'CONFIG_ERROR',
                requestId
            });
            return;
        }
        if (!config.apiKey) {
            console.error(`${logPrefix} CRITICAL: apiKey not configured in Firebase config`);
            res.status(500).json({
                error: 'Billing configuration error. Please contact support.',
                code: 'CONFIG_ERROR',
                requestId
            });
            return;
        }
        // Get access token
        const accessToken = await (0, shopify_auth_1.getShopAccessToken)(shop);
        if (!accessToken) {
            console.error(`${logPrefix} No access token found for shop:`, { shop });
            res.status(401).json({
                error: 'Shop access token not found. Please reinstall the app.',
                code: 'NO_ACCESS_TOKEN',
                requestId
            });
            return;
        }
        const db = admin.firestore();
        try {
            // Check for existing pending subscription (idempotency check)
            const pendingDoc = await db.collection('shops').doc(shop).collection('subscription').doc('pending').get();
            if (pendingDoc.exists) {
                const pendingData = pendingDoc.data();
                const pendingAge = Date.now() - (((_c = (_b = (_a = pendingData === null || pendingData === void 0 ? void 0 : pendingData.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.getTime()) || 0);
                // If pending subscription is less than 2 minutes old, reject to prevent double-click
                if (pendingAge < 2 * 60 * 1000) {
                    console.log(`${logPrefix} Duplicate request detected - pending subscription exists:`, {
                        pendingTier: pendingData === null || pendingData === void 0 ? void 0 : pendingData.tier,
                        ageMs: pendingAge,
                    });
                    res.status(409).json({
                        error: 'A subscription request is already in progress. Please wait.',
                        code: 'DUPLICATE_REQUEST',
                        requestId
                    });
                    return;
                }
                // Old pending subscription - clean it up
                console.log(`${logPrefix} Cleaning up stale pending subscription`);
                await pendingDoc.ref.delete();
            }
            // Check for existing active subscriptions
            console.log(`${logPrefix} Checking existing subscriptions...`);
            let existingSubscriptions = [];
            try {
                const existingResult = await shopifyGraphQL(shop, accessToken, GET_ACTIVE_SUBSCRIPTIONS_QUERY, undefined, requestId);
                existingSubscriptions = existingResult.currentAppInstallation.activeSubscriptions || [];
                console.log(`${logPrefix} Existing subscriptions:`, existingSubscriptions.map(s => ({ id: s.id, name: s.name, status: s.status })));
            }
            catch (queryError) {
                // Log but don't fail - we can still try to create the subscription
                console.warn(`${logPrefix} Failed to query existing subscriptions:`, queryError.message);
            }
            // Check if already on requested tier
            const alreadyOnTier = existingSubscriptions.some(sub => sub.name === `SocialStitch ${tierConfig.name}` && sub.status === 'ACTIVE');
            if (alreadyOnTier) {
                console.log(`${logPrefix} Already subscribed to requested tier:`, { tier });
                res.status(400).json({
                    error: `You are already subscribed to the ${tierConfig.name} plan.`,
                    code: 'ALREADY_SUBSCRIBED',
                    requestId
                });
                return;
            }
            // Build the return URL - this is where Shopify redirects after approval/decline
            const returnUrl = `${config.appUrl}/shopifyBillingCallback?shop=${encodeURIComponent(shop)}&tier=${tier}`;
            console.log(`${logPrefix} Creating subscription:`, {
                tier,
                name: `SocialStitch ${tierConfig.name}`,
                price: tierConfig.monthlyPriceCents / 100,
                testMode: config.testMode,
                returnUrl,
            });
            // Create the subscription via GraphQL
            const result = await shopifyGraphQL(shop, accessToken, CREATE_SUBSCRIPTION_MUTATION, {
                name: `SocialStitch ${tierConfig.name}`,
                returnUrl,
                test: config.testMode,
                lineItems: [
                    {
                        plan: {
                            appRecurringPricingDetails: {
                                price: {
                                    amount: tierConfig.monthlyPriceCents / 100, // Convert cents to dollars
                                    currencyCode: 'USD',
                                },
                                interval: 'EVERY_30_DAYS',
                            },
                        },
                    },
                ],
            }, requestId);
            const { appSubscription, confirmationUrl, userErrors } = result.appSubscriptionCreate;
            // Check for user errors from Shopify
            if (userErrors && userErrors.length > 0) {
                console.error(`${logPrefix} Shopify user errors:`, userErrors);
                res.status(400).json({
                    error: userErrors[0].message,
                    userErrors,
                    requestId
                });
                return;
            }
            if (!confirmationUrl) {
                console.error(`${logPrefix} No confirmation URL returned from Shopify:`, { appSubscription });
                res.status(500).json({
                    error: 'No confirmation URL returned from Shopify. Please try again.',
                    code: 'NO_CONFIRMATION_URL',
                    requestId
                });
                return;
            }
            // Store pending subscription in Firestore
            await db.collection('shops').doc(shop).collection('subscription').doc('pending').set({
                tier,
                shopifySubscriptionId: appSubscription === null || appSubscription === void 0 ? void 0 : appSubscription.id,
                status: 'pending',
                requestId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`${logPrefix} SUCCESS - Subscription created:`, {
                shop,
                tier,
                subscriptionId: appSubscription === null || appSubscription === void 0 ? void 0 : appSubscription.id,
                confirmationUrl: confirmationUrl.substring(0, 50) + '...',
            });
            res.json({
                confirmationUrl,
                subscriptionId: appSubscription === null || appSubscription === void 0 ? void 0 : appSubscription.id,
                requestId,
            });
        }
        catch (error) {
            // Detailed error logging for debugging
            console.error(`${logPrefix} FAILED:`, {
                shop,
                tier,
                errorMessage: error.message,
                errorStack: (_d = error.stack) === null || _d === void 0 ? void 0 : _d.split('\n').slice(0, 5).join('\n'),
            });
            // Check for specific error types
            const errorMessage = error.message || 'Failed to create subscription';
            let errorCode = 'SUBSCRIPTION_CREATE_FAILED';
            let statusCode = 500;
            // Invalid access token - needs reinstall
            if (errorMessage.includes('INVALID_ACCESS_TOKEN') || errorMessage.includes('401')) {
                errorCode = 'INVALID_ACCESS_TOKEN';
                statusCode = 401;
            }
            res.status(statusCode).json(Object.assign({ error: errorMessage, code: errorCode, requestId }, (errorCode === 'INVALID_ACCESS_TOKEN' && {
                action: 'reinstall',
                hint: 'Please uninstall and reinstall the app from the Shopify App Store to refresh your authorization.'
            })));
        }
    });
});
/**
 * Billing callback - handles return from Shopify after approval/decline
 * GET /shopifyBillingCallback?shop=xxx&tier=xxx&charge_id=xxx
 */
exports.shopifyBillingCallback = functions.https.onRequest(async (req, res) => {
    const { shop, tier, charge_id } = req.query;
    const config = getShopifyConfig();
    if (!shop || !tier) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
    }
    const shopDomain = shop;
    const tierName = tier;
    console.log(`[shopifyBillingCallback] Callback for shop: ${shopDomain}, tier: ${tierName}, charge_id: ${charge_id}`);
    // Get access token
    const accessToken = await (0, shopify_auth_1.getShopAccessToken)(shopDomain);
    if (!accessToken) {
        console.error(`[shopifyBillingCallback] No access token for shop: ${shopDomain}`);
        // Redirect back to app with error
        res.redirect(`https://${shopDomain}/admin/apps/${config.apiKey}?billing_error=no_token`);
        return;
    }
    try {
        // Query current active subscriptions to verify the subscription was approved
        const result = await shopifyGraphQL(shopDomain, accessToken, GET_ACTIVE_SUBSCRIPTIONS_QUERY);
        const activeSubscriptions = result.currentAppInstallation.activeSubscriptions;
        // Find the subscription for our tier
        const tierConfig = SUBSCRIPTION_TIERS[tierName];
        const activeSubscription = activeSubscriptions.find(sub => sub.name === `SocialStitch ${tierConfig === null || tierConfig === void 0 ? void 0 : tierConfig.name}` && sub.status === 'ACTIVE');
        const db = admin.firestore();
        if (activeSubscription) {
            // Subscription was approved - update Firestore
            console.log(`[shopifyBillingCallback] Subscription approved for ${shopDomain}:`, activeSubscription);
            const now = new Date();
            const billingCycleEnd = new Date(now);
            billingCycleEnd.setDate(billingCycleEnd.getDate() + 30);
            await db.collection('shops').doc(shopDomain).collection('subscription').doc('current').set({
                tier: tierName,
                imageQuota: (tierConfig === null || tierConfig === void 0 ? void 0 : tierConfig.imageQuota) || 100,
                billingCycleStart: admin.firestore.Timestamp.fromDate(now),
                billingCycleEnd: admin.firestore.Timestamp.fromDate(billingCycleEnd),
                externalSubscriptionId: activeSubscription.id,
                status: 'active',
                isTest: activeSubscription.test,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Clean up pending subscription
            await db.collection('shops').doc(shopDomain).collection('subscription').doc('pending').delete();
            // Redirect back to app with success
            res.redirect(`https://${shopDomain}/admin/apps/${config.apiKey}?billing_success=${tierName}`);
        }
        else {
            // Subscription was declined or not found
            console.log(`[shopifyBillingCallback] No active subscription found for ${shopDomain}`);
            // Clean up pending subscription
            await db.collection('shops').doc(shopDomain).collection('subscription').doc('pending').delete();
            // Redirect back to app with declined status
            res.redirect(`https://${shopDomain}/admin/apps/${config.apiKey}?billing_declined=true`);
        }
    }
    catch (error) {
        console.error('[shopifyBillingCallback] Error:', error);
        res.redirect(`https://${shopDomain}/admin/apps/${config.apiKey}?billing_error=unknown`);
    }
});
/**
 * Get active subscription for a shop
 * GET /shopifyGetActiveSubscription
 */
exports.shopifyGetActiveSubscription = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Verify session
        const session = await (0, shopify_auth_1.verifyRequestSession)(req);
        if (!session.valid || !session.shop) {
            res.status(401).json({ error: session.error || 'Unauthorized' });
            return;
        }
        // Get access token
        const accessToken = await (0, shopify_auth_1.getShopAccessToken)(session.shop);
        if (!accessToken) {
            res.status(401).json({ error: 'Shop access token not found' });
            return;
        }
        try {
            // Query active subscriptions from Shopify
            const result = await shopifyGraphQL(session.shop, accessToken, GET_ACTIVE_SUBSCRIPTIONS_QUERY);
            const activeSubscriptions = result.currentAppInstallation.activeSubscriptions;
            // Also get our local subscription record
            const db = admin.firestore();
            const localSubDoc = await db.collection('shops').doc(session.shop).collection('subscription').doc('current').get();
            const localSubscription = localSubDoc.exists ? localSubDoc.data() : null;
            // Determine current tier from active subscriptions
            let currentTier = 'free';
            let activeSubscription = null;
            for (const sub of activeSubscriptions) {
                if (sub.status === 'ACTIVE') {
                    if (sub.name.includes('Pro')) {
                        currentTier = 'pro';
                        activeSubscription = sub;
                    }
                    else if (sub.name.includes('Business')) {
                        currentTier = 'business';
                        activeSubscription = sub;
                    }
                }
            }
            res.json({
                tier: currentTier,
                subscription: activeSubscription,
                localSubscription,
                activeSubscriptions,
            });
        }
        catch (error) {
            console.error('Error getting subscription:', error);
            res.status(500).json({ error: 'Failed to get subscription' });
        }
    });
});
/**
 * Cancel a subscription
 * POST /shopifyCancelSubscription
 * Body: { subscriptionId: string }
 */
exports.shopifyCancelSubscription = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        // Verify session
        const session = await (0, shopify_auth_1.verifyRequestSession)(req);
        if (!session.valid || !session.shop) {
            res.status(401).json({ error: session.error || 'Unauthorized' });
            return;
        }
        const { subscriptionId } = req.body;
        if (!subscriptionId) {
            res.status(400).json({ error: 'Missing subscriptionId' });
            return;
        }
        // Get access token
        const accessToken = await (0, shopify_auth_1.getShopAccessToken)(session.shop);
        if (!accessToken) {
            res.status(401).json({ error: 'Shop access token not found' });
            return;
        }
        try {
            // Cancel the subscription via GraphQL
            const result = await shopifyGraphQL(session.shop, accessToken, CANCEL_SUBSCRIPTION_MUTATION, {
                id: subscriptionId,
            });
            const { appSubscription, userErrors } = result.appSubscriptionCancel;
            if (userErrors && userErrors.length > 0) {
                console.error('Subscription cancellation errors:', userErrors);
                res.status(400).json({
                    error: userErrors[0].message,
                    userErrors
                });
                return;
            }
            // Update local subscription to reflect cancellation
            // Note: The subscription remains active until the end of the billing period
            const db = admin.firestore();
            await db.collection('shops').doc(session.shop).collection('subscription').doc('current').update({
                status: 'cancelled',
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[shopifyCancelSubscription] Cancelled subscription for ${session.shop}`);
            res.json({
                success: true,
                subscription: appSubscription,
            });
        }
        catch (error) {
            console.error('Error cancelling subscription:', error);
            res.status(500).json({ error: 'Failed to cancel subscription' });
        }
    });
});
/**
 * Webhook handler for APP_SUBSCRIPTIONS_UPDATE
 * Called by Shopify when subscription status changes
 */
exports.shopifySubscriptionWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
    const config = getShopifyConfig();
    // Verify webhook HMAC
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const rawBody = ((_a = req.rawBody) === null || _a === void 0 ? void 0 : _a.toString()) || JSON.stringify(req.body);
    if (!(0, shopify_auth_1.verifyWebhookHmac)(rawBody, hmacHeader, config.apiSecret)) {
        console.error('[shopifySubscriptionWebhook] Invalid webhook HMAC');
        res.status(401).send('Unauthorized');
        return;
    }
    const shopDomain = req.headers['x-shopify-shop-domain'];
    const topic = req.headers['x-shopify-topic'];
    if (!shopDomain) {
        res.status(400).send('Missing shop domain');
        return;
    }
    console.log(`[shopifySubscriptionWebhook] Received ${topic} for ${shopDomain}`);
    console.log('[shopifySubscriptionWebhook] Payload:', JSON.stringify(req.body, null, 2));
    const db = admin.firestore();
    try {
        const payload = req.body;
        const subscriptionId = ((_b = payload.app_subscription) === null || _b === void 0 ? void 0 : _b.admin_graphql_api_id) || payload.id;
        const status = ((_c = payload.app_subscription) === null || _c === void 0 ? void 0 : _c.status) || payload.status;
        const name = ((_d = payload.app_subscription) === null || _d === void 0 ? void 0 : _d.name) || payload.name;
        // Determine tier from subscription name
        let tier = 'free';
        if (name === null || name === void 0 ? void 0 : name.includes('Pro')) {
            tier = 'pro';
        }
        else if (name === null || name === void 0 ? void 0 : name.includes('Business')) {
            tier = 'business';
        }
        const tierConfig = SUBSCRIPTION_TIERS[tier];
        // Handle different status changes
        switch (status === null || status === void 0 ? void 0 : status.toUpperCase()) {
            case 'ACTIVE':
                // Subscription is active
                console.log(`[shopifySubscriptionWebhook] Subscription activated for ${shopDomain}, tier: ${tier}`);
                const now = new Date();
                const billingCycleEnd = new Date(now);
                billingCycleEnd.setDate(billingCycleEnd.getDate() + 30);
                await db.collection('shops').doc(shopDomain).collection('subscription').doc('current').set({
                    tier,
                    imageQuota: (tierConfig === null || tierConfig === void 0 ? void 0 : tierConfig.imageQuota) || 10,
                    billingCycleStart: admin.firestore.Timestamp.fromDate(now),
                    billingCycleEnd: admin.firestore.Timestamp.fromDate(billingCycleEnd),
                    externalSubscriptionId: subscriptionId,
                    status: 'active',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                break;
            case 'CANCELLED':
            case 'EXPIRED':
            case 'DECLINED':
                // Subscription ended - revert to free tier
                console.log(`[shopifySubscriptionWebhook] Subscription ${status} for ${shopDomain}, reverting to free`);
                const freeConfig = SUBSCRIPTION_TIERS.free;
                const nowFree = new Date();
                const freeEnd = new Date(nowFree);
                freeEnd.setMonth(freeEnd.getMonth() + 1);
                freeEnd.setDate(0); // Last day of month
                await db.collection('shops').doc(shopDomain).collection('subscription').doc('current').set({
                    tier: 'free',
                    imageQuota: freeConfig.imageQuota,
                    billingCycleStart: admin.firestore.Timestamp.fromDate(nowFree),
                    billingCycleEnd: admin.firestore.Timestamp.fromDate(freeEnd),
                    externalSubscriptionId: null,
                    status: 'active',
                    previousTier: tier,
                    previousSubscriptionEndedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                break;
            case 'FROZEN':
                // Payment failed - mark as past_due but don't revoke access yet
                console.log(`[shopifySubscriptionWebhook] Subscription frozen for ${shopDomain}`);
                await db.collection('shops').doc(shopDomain).collection('subscription').doc('current').update({
                    status: 'past_due',
                    frozenAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                break;
            default:
                console.log(`[shopifySubscriptionWebhook] Unhandled status: ${status}`);
        }
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('[shopifySubscriptionWebhook] Error:', error);
        res.status(500).send('Internal error');
    }
});
//# sourceMappingURL=shopify-billing.js.map