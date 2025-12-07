"use strict";
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
exports.metaDataDeletion = exports.disconnectAccount = exports.postCarouselToFacebook = exports.postCarouselToInstagram = exports.postToInstagram = exports.postToFacebook = exports.getConnectedAccounts = exports.authCallback = exports.authStart = exports.shopifySubscriptionWebhook = exports.shopifyCancelSubscription = exports.shopifyGetActiveSubscription = exports.shopifyBillingCallback = exports.shopifyCreateSubscription = exports.exportShopData = exports.gdprShopRedact = exports.gdprCustomersRedact = exports.gdprCustomersDataRequest = exports.shopifyAddProductImage = exports.shopifyProxyImage = exports.shopifyGetShop = exports.shopifySearchProducts = exports.shopifyGetCollections = exports.shopifyGetProductImages = exports.shopifyGetProduct = exports.shopifyGetProducts = exports.shopifyAppUninstalled = exports.shopifyCheckInstall = exports.shopifyVerifySession = exports.shopifyAuthCallback = exports.shopifyAuthStart = exports.triggerScheduledPosts = exports.processScheduledPosts = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const meta_1 = require("./meta");
// Export scheduler functions
var scheduler_1 = require("./scheduler");
Object.defineProperty(exports, "processScheduledPosts", { enumerable: true, get: function () { return scheduler_1.processScheduledPosts; } });
Object.defineProperty(exports, "triggerScheduledPosts", { enumerable: true, get: function () { return scheduler_1.triggerScheduledPosts; } });
// Export Shopify OAuth and authentication functions
var shopify_auth_1 = require("./shopify-auth");
Object.defineProperty(exports, "shopifyAuthStart", { enumerable: true, get: function () { return shopify_auth_1.shopifyAuthStart; } });
Object.defineProperty(exports, "shopifyAuthCallback", { enumerable: true, get: function () { return shopify_auth_1.shopifyAuthCallback; } });
Object.defineProperty(exports, "shopifyVerifySession", { enumerable: true, get: function () { return shopify_auth_1.shopifyVerifySession; } });
Object.defineProperty(exports, "shopifyCheckInstall", { enumerable: true, get: function () { return shopify_auth_1.shopifyCheckInstall; } });
Object.defineProperty(exports, "shopifyAppUninstalled", { enumerable: true, get: function () { return shopify_auth_1.shopifyAppUninstalled; } });
// Export Shopify API proxy functions
var shopify_api_1 = require("./shopify-api");
Object.defineProperty(exports, "shopifyGetProducts", { enumerable: true, get: function () { return shopify_api_1.shopifyGetProducts; } });
Object.defineProperty(exports, "shopifyGetProduct", { enumerable: true, get: function () { return shopify_api_1.shopifyGetProduct; } });
Object.defineProperty(exports, "shopifyGetProductImages", { enumerable: true, get: function () { return shopify_api_1.shopifyGetProductImages; } });
Object.defineProperty(exports, "shopifyGetCollections", { enumerable: true, get: function () { return shopify_api_1.shopifyGetCollections; } });
Object.defineProperty(exports, "shopifySearchProducts", { enumerable: true, get: function () { return shopify_api_1.shopifySearchProducts; } });
Object.defineProperty(exports, "shopifyGetShop", { enumerable: true, get: function () { return shopify_api_1.shopifyGetShop; } });
Object.defineProperty(exports, "shopifyProxyImage", { enumerable: true, get: function () { return shopify_api_1.shopifyProxyImage; } });
Object.defineProperty(exports, "shopifyAddProductImage", { enumerable: true, get: function () { return shopify_api_1.shopifyAddProductImage; } });
// Export Shopify GDPR webhooks
var shopify_gdpr_1 = require("./shopify-gdpr");
Object.defineProperty(exports, "gdprCustomersDataRequest", { enumerable: true, get: function () { return shopify_gdpr_1.gdprCustomersDataRequest; } });
Object.defineProperty(exports, "gdprCustomersRedact", { enumerable: true, get: function () { return shopify_gdpr_1.gdprCustomersRedact; } });
Object.defineProperty(exports, "gdprShopRedact", { enumerable: true, get: function () { return shopify_gdpr_1.gdprShopRedact; } });
Object.defineProperty(exports, "exportShopData", { enumerable: true, get: function () { return shopify_gdpr_1.exportShopData; } });
// Export Shopify Billing functions
var shopify_billing_1 = require("./shopify-billing");
Object.defineProperty(exports, "shopifyCreateSubscription", { enumerable: true, get: function () { return shopify_billing_1.shopifyCreateSubscription; } });
Object.defineProperty(exports, "shopifyBillingCallback", { enumerable: true, get: function () { return shopify_billing_1.shopifyBillingCallback; } });
Object.defineProperty(exports, "shopifyGetActiveSubscription", { enumerable: true, get: function () { return shopify_billing_1.shopifyGetActiveSubscription; } });
Object.defineProperty(exports, "shopifyCancelSubscription", { enumerable: true, get: function () { return shopify_billing_1.shopifyCancelSubscription; } });
Object.defineProperty(exports, "shopifySubscriptionWebhook", { enumerable: true, get: function () { return shopify_billing_1.shopifySubscriptionWebhook; } });
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
/**
 * Upload base64 image to Firebase Storage and return public URL
 */
async function uploadImageToStorage(base64Data, sessionId) {
    // Remove data URL prefix if present
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    // Generate unique filename
    const filename = `posts/${sessionId}/${Date.now()}.jpg`;
    const bucket = storage.bucket();
    const file = bucket.file(filename);
    // Upload the image
    await file.save(buffer, {
        metadata: {
            contentType: 'image/jpeg',
        },
    });
    // Make the file publicly accessible
    await file.makePublic();
    // Return the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    return publicUrl;
}
// CORS middleware
const corsHandler = (0, cors_1.default)({ origin: true });
// Environment variables (set via Firebase config)
const getConfig = () => {
    var _a, _b, _c, _d, _e;
    const config = functions.config();
    return {
        appId: ((_a = config.meta) === null || _a === void 0 ? void 0 : _a.app_id) || process.env.META_APP_ID || '',
        appSecret: ((_b = config.meta) === null || _b === void 0 ? void 0 : _b.app_secret) || process.env.META_APP_SECRET || '',
        functionsUrl: ((_c = config.app) === null || _c === void 0 ? void 0 : _c.functions_url) || process.env.FUNCTIONS_URL || '',
        // Use custom domain for OAuth callback (must match Meta App Dashboard settings)
        hostingUrl: ((_d = config.app) === null || _d === void 0 ? void 0 : _d.hosting_url) || process.env.HOSTING_URL || 'https://api.socialstitch.io',
        frontendUrl: ((_e = config.app) === null || _e === void 0 ? void 0 : _e.frontend_url) || process.env.FRONTEND_URL || 'http://localhost:5173'
    };
};
/**
 * Allowed redirect URIs - must match exactly what's registered in Meta App Dashboard
 * These are the URIs configured in Meta App Dashboard > Facebook Login > Settings > Valid OAuth Redirect URIs
 */
const ALLOWED_REDIRECT_URIS = [
    'https://api.socialstitch.io/api/auth/callback',
    'https://social-stitch.web.app/api/auth/callback',
    'https://us-central1-social-stitch.cloudfunctions.net/authCallback',
];
/**
 * Validate redirect URI for security
 * For App Store distribution, the redirect URI must be your backend domain
 * and must be registered in Meta App Dashboard
 */
function validateRedirectUri(uri) {
    // Check against allowlist of registered URIs
    if (ALLOWED_REDIRECT_URIS.includes(uri)) {
        return true;
    }
    // Log warning for debugging
    console.warn(`Redirect URI not in allowlist: ${uri}`);
    console.warn(`Allowed URIs: ${ALLOWED_REDIRECT_URIS.join(', ')}`);
    // In development, allow localhost
    try {
        const url = new URL(uri);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            console.log('Allowing localhost redirect URI for development');
            return true;
        }
    }
    catch (_a) {
        return false;
    }
    return false;
}
/**
 * Start OAuth flow - redirects to Meta's OAuth page
 */
exports.authStart = functions.https.onRequest((req, res) => {
    const config = getConfig();
    // Debug: log raw query params
    console.log('authStart - raw req.query:', JSON.stringify(req.query));
    console.log('authStart - raw platform:', req.query.platform, 'type:', typeof req.query.platform);
    // Ensure sessionId, platform, and redirectUrl are strings (req.query can return arrays)
    let sessionId = Array.isArray(req.query.sessionId)
        ? req.query.sessionId[0]
        : req.query.sessionId;
    let platform = Array.isArray(req.query.platform)
        ? req.query.platform[0]
        : req.query.platform;
    let redirectUrl = Array.isArray(req.query.redirectUrl)
        ? req.query.redirectUrl[0]
        : req.query.redirectUrl;
    // Force to string
    sessionId = String(sessionId);
    platform = String(platform);
    // Use provided redirectUrl or fall back to config
    const frontendUrl = redirectUrl ? String(redirectUrl) : config.frontendUrl;
    console.log('authStart - processed platform:', platform, 'frontendUrl:', frontendUrl);
    if (!sessionId || !platform) {
        res.status(400).json({ error: 'Missing sessionId or platform parameter' });
        return;
    }
    if (!config.appId) {
        res.status(500).json({ error: 'Meta App ID not configured' });
        return;
    }
    // Use Firebase Hosting URL for OAuth callback to avoid Safe Browsing warnings
    // This must match the redirect URI registered in Meta App Dashboard
    const redirectUri = `${config.hostingUrl}/api/auth/callback`;
    // Validate redirect URI
    if (!validateRedirectUri(redirectUri)) {
        res.status(500).json({ error: 'Invalid redirect URI configuration' });
        return;
    }
    const oauthUrl = (0, meta_1.buildOAuthUrl)(config.appId, redirectUri, String(sessionId), String(platform), frontendUrl);
    res.redirect(oauthUrl);
});
/**
 * OAuth callback - exchanges code for token and stores in Firestore
 */
exports.authCallback = functions.https.onRequest(async (req, res) => {
    const config = getConfig();
    const { code, state, error, error_description } = req.query;
    // Parse state early to get frontendUrl for error redirects
    let frontendUrl = config.frontendUrl;
    if (state) {
        try {
            const stateStr = Array.isArray(state) ? state[0] : state;
            const parsedState = JSON.parse(stateStr);
            if (parsedState.frontendUrl) {
                frontendUrl = String(parsedState.frontendUrl);
            }
        }
        catch (e) {
            // Use default frontendUrl if state parsing fails
        }
    }
    // Handle OAuth errors
    if (error) {
        console.error('OAuth error:', error, error_description);
        res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(error_description || 'Unknown error')}`);
        return;
    }
    if (!code || !state) {
        res.status(400).json({ error: 'Missing code or state parameter' });
        return;
    }
    try {
        // Parse state to get sessionId and platform
        // Handle case where state might be an array
        const stateStr = Array.isArray(state) ? state[0] : state;
        const parsedState = JSON.parse(stateStr);
        // Ensure sessionId and platform are strings (handle arrays if somehow present)
        const sessionId = Array.isArray(parsedState.sessionId)
            ? String(parsedState.sessionId[0])
            : String(parsedState.sessionId);
        const platform = Array.isArray(parsedState.platform)
            ? String(parsedState.platform[0])
            : String(parsedState.platform);
        // Use frontendUrl from state if provided, otherwise use config
        if (parsedState.frontendUrl) {
            frontendUrl = String(parsedState.frontendUrl);
        }
        console.log('Auth callback - sessionId:', sessionId, 'platform:', platform, 'frontendUrl:', frontendUrl);
        // Use Firebase Hosting URL for OAuth callback (must match what was used in authStart)
        // This must also match the redirect URI registered in Meta App Dashboard
        const redirectUri = `${config.hostingUrl}/api/auth/callback`;
        // Validate redirect URI
        if (!validateRedirectUri(redirectUri)) {
            res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent('Invalid redirect URI configuration')}`);
            return;
        }
        // Exchange code for short-lived token
        const tokenResponse = await (0, meta_1.exchangeCodeForToken)(code, config.appId, config.appSecret, redirectUri);
        // Get long-lived token
        const longLivedToken = await (0, meta_1.getLongLivedToken)(tokenResponse.access_token, config.appId, config.appSecret);
        // Get user's Facebook Pages (with Instagram business accounts)
        const pages = await (0, meta_1.getUserPages)(longLivedToken.access_token);
        if (pages.length === 0) {
            res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent('No Facebook Pages found. Please create a Page first.')}`);
            return;
        }
        // Use the first page for simplicity (could add page selection UI later)
        const selectedPage = pages[0];
        // Store account info in Firestore
        const accountData = {
            connected: true,
            pageId: selectedPage.id,
            pageName: selectedPage.name,
            pageAccessToken: selectedPage.access_token,
            userAccessToken: longLivedToken.access_token,
            connectedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        // If this is Instagram and the page has an IG business account
        if (platform === 'instagram' && selectedPage.instagram_business_account) {
            accountData.instagramId = selectedPage.instagram_business_account.id;
            accountData.instagramUsername = selectedPage.instagram_business_account.username || 'Connected Account';
        }
        else if (platform === 'instagram' && !selectedPage.instagram_business_account) {
            res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent('No Instagram Business Account linked to your Facebook Page.')}`);
            return;
        }
        // Save to Firestore
        await db.collection('sessions').doc(sessionId).collection('accounts').doc(platform).set(accountData);
        // Redirect back to frontend with success
        res.redirect(`${frontendUrl}?auth_success=${platform}`);
    }
    catch (err) {
        console.error('Auth callback error:', err);
        res.redirect(`${config.frontendUrl}?auth_error=${encodeURIComponent('Authentication failed. Please try again.')}`);
    }
});
/**
 * Get connected accounts for a session
 */
exports.getConnectedAccounts = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const { sessionId } = req.query;
        if (!sessionId) {
            res.status(400).json({ error: 'Missing sessionId parameter' });
            return;
        }
        try {
            const accountsSnapshot = await db
                .collection('sessions')
                .doc(sessionId)
                .collection('accounts')
                .get();
            const accounts = {};
            accountsSnapshot.forEach((doc) => {
                const data = doc.data();
                accounts[doc.id] = {
                    connected: data.connected,
                    username: data.instagramUsername || data.pageName,
                    pageId: data.pageId,
                    pageName: data.pageName
                };
            });
            res.json({ accounts });
        }
        catch (err) {
            console.error('Error getting accounts:', err);
            res.status(500).json({ error: 'Failed to get accounts' });
        }
    });
});
/**
 * Post to Facebook Page
 */
exports.postToFacebook = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { sessionId, imageUrl, imageBase64, caption } = req.body;
        if (!sessionId || (!imageUrl && !imageBase64) || !caption) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        try {
            // Get account from Firestore
            const accountDoc = await db
                .collection('sessions')
                .doc(sessionId)
                .collection('accounts')
                .doc('facebook')
                .get();
            if (!accountDoc.exists) {
                res.status(401).json({ error: 'Facebook account not connected' });
                return;
            }
            const account = accountDoc.data();
            // Determine the public image URL
            let publicImageUrl = imageUrl;
            // If base64 image is provided, or if imageUrl is a data URL or localhost, upload to Storage
            if (imageBase64 || (imageUrl && (imageUrl.startsWith('data:') || imageUrl.includes('localhost') || imageUrl.startsWith('blob:')))) {
                const imageData = imageBase64 || imageUrl;
                console.log('Uploading image to Firebase Storage...');
                publicImageUrl = await uploadImageToStorage(imageData, sessionId);
                console.log('Image uploaded:', publicImageUrl);
            }
            // Post to Facebook
            const result = await (0, meta_1.postToFacebookPage)(account.pageId, account.pageAccessToken, publicImageUrl, caption);
            res.json({ success: true, postId: result.post_id || result.id });
        }
        catch (err) {
            console.error('Error posting to Facebook:', err);
            res.status(500).json({ error: 'Failed to post to Facebook' });
        }
    });
});
/**
 * Post to Instagram Business Account
 */
exports.postToInstagram = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { sessionId, imageUrl, imageBase64, caption } = req.body;
        if (!sessionId || (!imageUrl && !imageBase64) || !caption) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        try {
            // Get account from Firestore
            const accountDoc = await db
                .collection('sessions')
                .doc(sessionId)
                .collection('accounts')
                .doc('instagram')
                .get();
            if (!accountDoc.exists) {
                res.status(401).json({ error: 'Instagram account not connected' });
                return;
            }
            const account = accountDoc.data();
            if (!account.instagramId) {
                res.status(400).json({ error: 'No Instagram Business Account linked' });
                return;
            }
            // Determine the public image URL
            let publicImageUrl = imageUrl;
            // If base64 image is provided, or if imageUrl is a data URL or localhost, upload to Storage
            if (imageBase64 || (imageUrl && (imageUrl.startsWith('data:') || imageUrl.includes('localhost') || imageUrl.startsWith('blob:')))) {
                const imageData = imageBase64 || imageUrl;
                console.log('Uploading image to Firebase Storage...');
                publicImageUrl = await uploadImageToStorage(imageData, sessionId);
                console.log('Image uploaded:', publicImageUrl);
            }
            // Step 1: Create media container
            const container = await (0, meta_1.createInstagramMediaContainer)(account.instagramId, account.pageAccessToken, publicImageUrl, caption);
            // Step 2: Publish the media
            const result = await (0, meta_1.publishInstagramMedia)(account.instagramId, account.pageAccessToken, container.id);
            res.json({ success: true, postId: result.id });
        }
        catch (err) {
            console.error('Error posting to Instagram:', err);
            res.status(500).json({ error: 'Failed to post to Instagram' });
        }
    });
});
/**
 * Post a carousel to Instagram Business Account
 */
exports.postCarouselToInstagram = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { sessionId, imagesBase64, caption } = req.body;
        if (!sessionId || !imagesBase64 || !Array.isArray(imagesBase64) || imagesBase64.length < 2 || !caption) {
            res.status(400).json({ error: 'Missing required fields. Carousel requires at least 2 images.' });
            return;
        }
        if (imagesBase64.length > 10) {
            res.status(400).json({ error: 'Instagram carousel supports maximum 10 images.' });
            return;
        }
        try {
            // Get account from Firestore
            const accountDoc = await db
                .collection('sessions')
                .doc(sessionId)
                .collection('accounts')
                .doc('instagram')
                .get();
            if (!accountDoc.exists) {
                res.status(401).json({ error: 'Instagram account not connected' });
                return;
            }
            const account = accountDoc.data();
            if (!account.instagramId) {
                res.status(400).json({ error: 'No Instagram Business Account linked' });
                return;
            }
            // Step 1: Upload all images to Firebase Storage and get public URLs
            console.log(`Uploading ${imagesBase64.length} images to Firebase Storage...`);
            const publicUrls = [];
            for (let i = 0; i < imagesBase64.length; i++) {
                const publicUrl = await uploadImageToStorage(imagesBase64[i], sessionId);
                publicUrls.push(publicUrl);
                console.log(`Uploaded image ${i + 1}/${imagesBase64.length}: ${publicUrl}`);
            }
            // Step 2: Create carousel item containers for each image
            console.log('Creating Instagram carousel item containers...');
            const childrenIds = [];
            for (const imageUrl of publicUrls) {
                const container = await (0, meta_1.createInstagramCarouselItem)(account.instagramId, account.pageAccessToken, imageUrl);
                childrenIds.push(container.id);
                console.log(`Created carousel item: ${container.id}`);
            }
            // Step 3: Create the carousel container
            console.log('Creating Instagram carousel container...');
            const carouselContainer = await (0, meta_1.createInstagramCarouselContainer)(account.instagramId, account.pageAccessToken, childrenIds, caption);
            console.log(`Created carousel container: ${carouselContainer.id}`);
            // Step 4: Publish the carousel
            console.log('Publishing Instagram carousel...');
            const result = await (0, meta_1.publishInstagramMedia)(account.instagramId, account.pageAccessToken, carouselContainer.id);
            res.json({ success: true, postId: result.id });
        }
        catch (err) {
            console.error('Error posting carousel to Instagram:', err);
            res.status(500).json({ error: 'Failed to post carousel to Instagram' });
        }
    });
});
/**
 * Post a carousel/multi-photo to Facebook Page
 */
exports.postCarouselToFacebook = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { sessionId, imagesBase64, caption } = req.body;
        if (!sessionId || !imagesBase64 || !Array.isArray(imagesBase64) || imagesBase64.length < 2 || !caption) {
            res.status(400).json({ error: 'Missing required fields. Multi-photo post requires at least 2 images.' });
            return;
        }
        try {
            // Get account from Firestore
            const accountDoc = await db
                .collection('sessions')
                .doc(sessionId)
                .collection('accounts')
                .doc('facebook')
                .get();
            if (!accountDoc.exists) {
                res.status(401).json({ error: 'Facebook account not connected' });
                return;
            }
            const account = accountDoc.data();
            // Upload all images to Firebase Storage and get public URLs
            console.log(`Uploading ${imagesBase64.length} images to Firebase Storage...`);
            const publicUrls = [];
            for (let i = 0; i < imagesBase64.length; i++) {
                const publicUrl = await uploadImageToStorage(imagesBase64[i], sessionId);
                publicUrls.push(publicUrl);
                console.log(`Uploaded image ${i + 1}/${imagesBase64.length}: ${publicUrl}`);
            }
            // Post multi-photo to Facebook
            console.log('Creating Facebook multi-photo post...');
            const result = await (0, meta_1.postMultiPhotoToFacebook)(account.pageId, account.pageAccessToken, publicUrls, caption);
            res.json({ success: true, postId: result.post_id || result.id });
        }
        catch (err) {
            console.error('Error posting carousel to Facebook:', err);
            res.status(500).json({ error: 'Failed to post carousel to Facebook' });
        }
    });
});
/**
 * Disconnect an account
 */
exports.disconnectAccount = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { sessionId, platform } = req.body;
        if (!sessionId || !platform) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        try {
            await db
                .collection('sessions')
                .doc(sessionId)
                .collection('accounts')
                .doc(platform)
                .delete();
            res.json({ success: true });
        }
        catch (err) {
            console.error('Error disconnecting account:', err);
            res.status(500).json({ error: 'Failed to disconnect account' });
        }
    });
});
/**
 * Meta Data Deletion Callback
 *
 * This endpoint is called by Meta when a user deletes their data from Facebook.
 * Required for Meta App Review and GDPR compliance.
 *
 * Meta sends a signed_request parameter containing the user's ID.
 * We must delete all data associated with that user and return a confirmation.
 */
exports.metaDataDeletion = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Meta sends a POST request with signed_request
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const config = getConfig();
        const { signed_request } = req.body;
        if (!signed_request) {
            res.status(400).json({ error: 'Missing signed_request parameter' });
            return;
        }
        try {
            // Parse the signed request from Meta
            // Format: [signature].[base64_encoded_payload]
            const [signature, payload] = signed_request.split('.');
            if (!signature || !payload) {
                res.status(400).json({ error: 'Invalid signed_request format' });
                return;
            }
            // Decode the payload
            const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
            const data = JSON.parse(decodedPayload);
            // Verify the signature using HMAC SHA256
            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
            const expectedSignature = crypto
                .createHmac('sha256', config.appSecret)
                .update(payload)
                .digest('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            if (signature !== expectedSignature) {
                console.error('Meta data deletion: Invalid signature');
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }
            const userId = data.user_id;
            console.log(`[Meta Data Deletion] Received request for user ID: ${userId}`);
            // Generate a confirmation code for this deletion request
            const confirmationCode = `SS-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            // Search for and delete any sessions that might be associated with this Meta user
            // Note: Our app stores data by sessionId (shop domain), not by Meta user ID
            // We log the deletion request for audit purposes
            await db.collection('metaDataDeletionRequests').add({
                metaUserId: userId,
                confirmationCode,
                requestedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'received',
                note: 'Data deletion request received from Meta. Our app stores data by shop domain, not Meta user ID. Users should disconnect their account from within the app or uninstall the app to delete their data.'
            });
            // Meta expects a specific response format
            // url: A URL where the user can check the status of their deletion request
            // confirmation_code: A unique code the user can use to track their request
            const statusUrl = `https://api.socialstitch.io/data-deletion?code=${confirmationCode}`;
            res.json({
                url: statusUrl,
                confirmation_code: confirmationCode
            });
            console.log(`[Meta Data Deletion] Completed for user ${userId}, confirmation: ${confirmationCode}`);
        }
        catch (err) {
            console.error('Error processing Meta data deletion:', err);
            res.status(500).json({ error: 'Failed to process deletion request' });
        }
    });
});
//# sourceMappingURL=index.js.map