"use strict";
/**
 * Shopify OAuth and Authentication Module
 *
 * Handles OAuth 2.0 flow for Shopify app installation:
 * - OAuth callback to exchange code for access token
 * - HMAC verification for request authenticity
 * - Session token verification for embedded app requests
 * - Secure token storage in Firestore
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopifyAppUninstalled = exports.shopifyCheckInstall = exports.shopifyVerifySession = exports.shopifyAuthCallback = exports.shopifyAuthStart = void 0;
exports.verifyHmac = verifyHmac;
exports.verifyWebhookHmac = verifyWebhookHmac;
exports.verifySessionToken = verifySessionToken;
exports.getShopFromToken = getShopFromToken;
exports.getShopAccessToken = getShopAccessToken;
exports.verifyRequestSession = verifyRequestSession;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const cors_1 = __importDefault(require("cors"));
const corsHandler = (0, cors_1.default)({ origin: true });
// Get Shopify configuration from Firebase config or environment
const getShopifyConfig = () => {
    var _a, _b, _c, _d;
    const config = functions.config();
    return {
        apiKey: ((_a = config.shopify) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.SHOPIFY_API_KEY || '',
        apiSecret: ((_b = config.shopify) === null || _b === void 0 ? void 0 : _b.api_secret) || process.env.SHOPIFY_API_SECRET || '',
        scopes: ((_c = config.shopify) === null || _c === void 0 ? void 0 : _c.scopes) || process.env.SHOPIFY_SCOPES || 'read_products',
        appUrl: ((_d = config.shopify) === null || _d === void 0 ? void 0 : _d.app_url) || process.env.SHOPIFY_APP_URL || '',
    };
};
/**
 * Verify HMAC signature from Shopify
 * Used to validate OAuth callbacks and webhook requests
 */
function verifyHmac(query, secret) {
    const { hmac } = query, params = __rest(query, ["hmac"]);
    if (!hmac)
        return false;
    // Sort parameters and create query string
    const sortedParams = Object.keys(params)
        .sort()
        .map((key) => {
        const value = Array.isArray(params[key]) ? params[key].join(',') : params[key];
        return `${key}=${value}`;
    })
        .join('&');
    // Calculate HMAC
    const calculatedHmac = crypto
        .createHmac('sha256', secret)
        .update(sortedParams)
        .digest('hex');
    // Timing-safe comparison
    try {
        return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(calculatedHmac, 'hex'));
    }
    catch (_a) {
        return false;
    }
}
/**
 * Verify Shopify webhook HMAC
 * Webhooks use a different HMAC calculation than OAuth
 */
function verifyWebhookHmac(body, hmacHeader, secret) {
    const calculatedHmac = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');
    try {
        return crypto.timingSafeEqual(Buffer.from(hmacHeader), Buffer.from(calculatedHmac));
    }
    catch (_a) {
        return false;
    }
}
/**
 * Verify Shopify session token (JWT)
 * Used for authenticated requests from the embedded app
 */
function verifySessionToken(token, apiKey, apiSecret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid token format' };
        }
        const [headerB64, payloadB64, signatureB64] = parts;
        // Verify signature
        const signatureInput = `${headerB64}.${payloadB64}`;
        const expectedSignature = crypto
            .createHmac('sha256', apiSecret)
            .update(signatureInput)
            .digest('base64url');
        if (signatureB64 !== expectedSignature) {
            return { valid: false, error: 'Invalid signature' };
        }
        // Decode payload
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        // Verify audience matches our API key
        if (payload.aud !== apiKey) {
            return { valid: false, error: 'Invalid audience' };
        }
        // Verify expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            return { valid: false, error: 'Token expired' };
        }
        // Verify not before
        if (payload.nbf > now) {
            return { valid: false, error: 'Token not yet valid' };
        }
        return { valid: true, payload };
    }
    catch (error) {
        return { valid: false, error: 'Token verification failed' };
    }
}
/**
 * Extract shop domain from session token destination
 */
function getShopFromToken(dest) {
    // dest is like "https://myshop.myshopify.com"
    const url = new URL(dest);
    return url.hostname;
}
/**
 * Start Shopify OAuth flow
 * Generates the OAuth URL and redirects the merchant
 */
exports.shopifyAuthStart = functions.https.onRequest((req, res) => {
    const config = getShopifyConfig();
    const shop = req.query.shop;
    if (!shop) {
        res.status(400).json({ error: 'Missing shop parameter' });
        return;
    }
    // Validate shop domain format
    const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    if (!shopRegex.test(shop)) {
        res.status(400).json({ error: 'Invalid shop domain' });
        return;
    }
    if (!config.apiKey || !config.appUrl) {
        res.status(500).json({ error: 'Shopify app not configured' });
        return;
    }
    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    // Store state temporarily (expires in 10 minutes)
    const db = admin.firestore();
    db.collection('shopifyOAuthStates').doc(state).set({
        shop,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    // Build OAuth URL - use the Firebase Function URL directly
    const redirectUri = `${config.appUrl}/shopifyAuthCallback`;
    const scopes = config.scopes;
    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', config.apiKey);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    res.redirect(authUrl.toString());
});
/**
 * Shopify OAuth callback
 * Exchanges authorization code for access token
 */
exports.shopifyAuthCallback = functions.https.onRequest(async (req, res) => {
    const config = getShopifyConfig();
    const { code, shop, state, hmac } = req.query;
    console.log('[shopifyAuthCallback] Received callback for shop:', shop);
    console.log('[shopifyAuthCallback] State:', state);
    console.log('[shopifyAuthCallback] Has code:', !!code);
    console.log('[shopifyAuthCallback] Has hmac:', !!hmac);
    // Validate required parameters
    if (!code || !shop) {
        console.error('[shopifyAuthCallback] Missing required parameters');
        res.status(400).json({ error: 'Missing required OAuth parameters' });
        return;
    }
    // Verify HMAC (this confirms the request came from Shopify)
    if (!verifyHmac(req.query, config.apiSecret)) {
        console.error('[shopifyAuthCallback] HMAC verification failed');
        res.status(401).json({ error: 'Invalid HMAC signature' });
        return;
    }
    console.log('[shopifyAuthCallback] HMAC verified successfully');
    // Verify state to prevent CSRF (optional for now, HMAC is sufficient)
    const db = admin.firestore();
    if (state) {
        const stateDoc = await db.collection('shopifyOAuthStates').doc(state).get();
        if (stateDoc.exists) {
            const stateData = stateDoc.data();
            if (stateData.shop !== shop) {
                console.warn('[shopifyAuthCallback] State shop mismatch, but continuing since HMAC is valid');
            }
            // Delete used state
            await stateDoc.ref.delete();
        }
        else {
            console.warn('[shopifyAuthCallback] State not found, but continuing since HMAC is valid');
        }
    }
    try {
        // Exchange code for access token
        const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: config.apiKey,
                client_secret: config.apiSecret,
                code,
            }),
        });
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token exchange failed:', errorText);
            res.status(500).json({ error: 'Failed to exchange authorization code' });
            return;
        }
        const tokenData = await tokenResponse.json();
        console.log('[shopifyAuthCallback] Token exchange successful, got access token:', tokenData.access_token ? `${tokenData.access_token.substring(0, 10)}...` : 'NONE');
        console.log('[shopifyAuthCallback] Scopes:', tokenData.scope);
        // Fetch shop information
        const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
            headers: {
                'X-Shopify-Access-Token': tokenData.access_token,
            },
        });
        let shopInfo = {};
        if (shopResponse.ok) {
            const shopData = await shopResponse.json();
            shopInfo = shopData.shop;
            console.log('[shopifyAuthCallback] Shop info retrieved:', shopInfo.name);
        }
        else {
            console.warn('[shopifyAuthCallback] Failed to fetch shop info:', shopResponse.status);
        }
        // Store access token securely in Firestore (overwrite old token completely)
        // IMPORTANT: Also store the apiKey so we can verify the token belongs to this app
        console.log('[shopifyAuthCallback] Storing token for shop:', shop);
        await db.collection('shopifyStores').doc(shop).set({
            accessToken: tokenData.access_token,
            scope: tokenData.scope,
            shopDomain: shop,
            shopName: shopInfo.name || shop,
            shopEmail: shopInfo.email || '',
            shopOwner: shopInfo.shop_owner || '',
            apiKey: config.apiKey, // Store which app's API key this token belongs to
            installedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }); // Removed merge:true to ensure complete overwrite
        console.log('[shopifyAuthCallback] Token stored successfully');
        // Create initial settings document for the shop
        await db.collection('shops').doc(shop).set({
            shopDomain: shop,
            shopName: shopInfo.name || shop,
            installedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        // Redirect back to the app (embedded in Shopify)
        const redirectUrl = `https://${shop}/admin/apps/${config.apiKey}`;
        res.redirect(redirectUrl);
    }
    catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});
/**
 * Verify session token for API requests
 * Called by frontend to validate the embedded app session
 */
exports.shopifyVerifySession = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const config = getShopifyConfig();
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or invalid authorization header' });
            return;
        }
        const token = authHeader.substring(7);
        const verification = verifySessionToken(token, config.apiKey, config.apiSecret);
        if (!verification.valid) {
            res.status(401).json({ error: verification.error || 'Invalid session token' });
            return;
        }
        const payload = verification.payload;
        const shop = getShopFromToken(payload.dest);
        // Verify the shop has installed the app
        const db = admin.firestore();
        const storeDoc = await db.collection('shopifyStores').doc(shop).get();
        if (!storeDoc.exists) {
            res.status(401).json({ error: 'Shop has not installed the app' });
            return;
        }
        res.json({
            valid: true,
            shop,
            sessionId: payload.sid,
            userId: payload.sub,
        });
    });
});
/**
 * Get shop access token (internal use only)
 * Used by other functions to make authenticated Shopify API calls
 */
async function getShopAccessToken(shop) {
    var _a;
    const db = admin.firestore();
    const storeDoc = await db.collection('shopifyStores').doc(shop).get();
    if (!storeDoc.exists) {
        return null;
    }
    return ((_a = storeDoc.data()) === null || _a === void 0 ? void 0 : _a.accessToken) || null;
}
/**
 * Middleware to verify session token and extract shop
 * Returns the shop domain if valid, null if invalid
 *
 * Falls back to shop query parameter if no session token is provided
 * (for cases where App Bridge session tokens don't work)
 */
async function verifyRequestSession(req) {
    var _a;
    const config = getShopifyConfig();
    const authHeader = req.headers.authorization;
    // First, try session token authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const verification = verifySessionToken(token, config.apiKey, config.apiSecret);
        if (verification.valid) {
            const shop = getShopFromToken(verification.payload.dest);
            return { valid: true, shop };
        }
        // If token is invalid, fall through to shop parameter check
        console.log('[verifyRequestSession] Session token invalid, checking shop parameter');
    }
    // Fallback: Check for shop parameter in query string
    // This is used when App Bridge session tokens don't work
    const shopParam = req.query.shop;
    if (shopParam) {
        // Validate shop domain format
        const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
        if (!shopRegex.test(shopParam)) {
            return { valid: false, error: 'Invalid shop domain format' };
        }
        // Verify the shop has installed the app (has an access token)
        const db = admin.firestore();
        const storeDoc = await db.collection('shopifyStores').doc(shopParam).get();
        if (!storeDoc.exists || !((_a = storeDoc.data()) === null || _a === void 0 ? void 0 : _a.accessToken)) {
            return { valid: false, error: 'Shop has not installed the app' };
        }
        console.log('[verifyRequestSession] Using shop parameter auth for:', shopParam);
        return { valid: true, shop: shopParam };
    }
    return { valid: false, error: 'Missing authorization header or shop parameter' };
}
/**
 * Check if a shop has installed the app
 * Verifies both that the token exists AND was created with the current app's API key
 */
exports.shopifyCheckInstall = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a;
        const config = getShopifyConfig();
        const shop = req.query.shop;
        if (!shop) {
            res.status(400).json({ error: 'Missing shop parameter' });
            return;
        }
        const db = admin.firestore();
        const storeDoc = await db.collection('shopifyStores').doc(shop).get();
        if (!storeDoc.exists) {
            console.log(`[shopifyCheckInstall] No store doc for ${shop}`);
            res.json({
                installed: false,
                shop,
            });
            return;
        }
        const storeData = storeDoc.data();
        const accessToken = storeData === null || storeData === void 0 ? void 0 : storeData.accessToken;
        const storedApiKey = storeData === null || storeData === void 0 ? void 0 : storeData.apiKey;
        // If no access token, not properly installed
        if (!accessToken) {
            console.log(`[shopifyCheckInstall] No access token for ${shop}`);
            res.json({
                installed: false,
                shop,
            });
            return;
        }
        // CRITICAL: Check if the token was created with the CURRENT app's API key
        // If not, the token is from a different/old app and won't work with App Bridge
        if (storedApiKey && storedApiKey !== config.apiKey) {
            console.log(`[shopifyCheckInstall] Token for ${shop} was created with different API key (old app), requiring re-auth`);
            console.log(`[shopifyCheckInstall] Stored key: ${storedApiKey === null || storedApiKey === void 0 ? void 0 : storedApiKey.substring(0, 8)}..., Current key: ${(_a = config.apiKey) === null || _a === void 0 ? void 0 : _a.substring(0, 8)}...`);
            // Delete the old token
            await db.collection('shopifyStores').doc(shop).delete();
            res.json({
                installed: false,
                shop,
                reason: 'different_app',
            });
            return;
        }
        // If no apiKey stored (legacy install), verify and update
        if (!storedApiKey) {
            console.log(`[shopifyCheckInstall] Legacy install for ${shop}, verifying token and updating with current API key`);
            // Verify the token works
            try {
                const testResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
                    headers: {
                        'X-Shopify-Access-Token': accessToken,
                    },
                });
                if (testResponse.ok) {
                    // Token works - but we can't verify which app it came from
                    // For safety, require re-auth to ensure App Bridge works
                    console.log(`[shopifyCheckInstall] Legacy token works but API key unknown, requiring re-auth for ${shop}`);
                    await db.collection('shopifyStores').doc(shop).delete();
                    res.json({
                        installed: false,
                        shop,
                        reason: 'legacy_token',
                    });
                    return;
                }
                else {
                    // Token doesn't work
                    console.log(`[shopifyCheckInstall] Legacy token invalid for ${shop}, requiring re-auth`);
                    await db.collection('shopifyStores').doc(shop).delete();
                    res.json({
                        installed: false,
                        shop,
                        reason: 'token_invalid',
                    });
                    return;
                }
            }
            catch (error) {
                console.error(`[shopifyCheckInstall] Error verifying legacy token for ${shop}:`, error);
                // On error, require re-auth to be safe
                await db.collection('shopifyStores').doc(shop).delete();
                res.json({
                    installed: false,
                    shop,
                    reason: 'verification_error',
                });
                return;
            }
        }
        // Token exists and was created with current API key - all good!
        console.log(`[shopifyCheckInstall] Valid install for ${shop}`);
        res.json({
            installed: true,
            shop,
        });
    });
});
/**
 * Uninstall webhook handler
 * Called by Shopify when the app is uninstalled
 */
exports.shopifyAppUninstalled = functions.https.onRequest(async (req, res) => {
    var _a;
    const config = getShopifyConfig();
    // Verify webhook HMAC
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const rawBody = ((_a = req.rawBody) === null || _a === void 0 ? void 0 : _a.toString()) || JSON.stringify(req.body);
    if (!verifyWebhookHmac(rawBody, hmacHeader, config.apiSecret)) {
        console.error('Invalid webhook HMAC');
        res.status(401).send('Unauthorized');
        return;
    }
    const shopDomain = req.headers['x-shopify-shop-domain'];
    if (!shopDomain) {
        res.status(400).send('Missing shop domain');
        return;
    }
    console.log(`App uninstalled from shop: ${shopDomain}`);
    const db = admin.firestore();
    try {
        // Mark the store as uninstalled (don't delete data immediately for GDPR compliance)
        await db.collection('shopifyStores').doc(shopDomain).update({
            uninstalledAt: admin.firestore.FieldValue.serverTimestamp(),
            accessToken: admin.firestore.FieldValue.delete(),
        });
        res.status(200).send('OK');
    }
    catch (error) {
        console.error('Error handling uninstall webhook:', error);
        res.status(500).send('Internal error');
    }
});
//# sourceMappingURL=shopify-auth.js.map