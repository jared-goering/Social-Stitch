"use strict";
/**
 * Shopify GDPR Webhooks Module
 *
 * Required webhooks for public Shopify apps to comply with GDPR:
 * - customers/data_request: When a customer requests their data
 * - customers/redact: When a customer requests deletion of their data
 * - shop/redact: When a shop owner requests deletion of shop data
 *
 * These endpoints must be registered in your Shopify app's GDPR settings.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportShopData = exports.gdprShopRedact = exports.gdprCustomersRedact = exports.gdprCustomersDataRequest = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const shopify_auth_1 = require("./shopify-auth");
// Get Shopify configuration
const getShopifyConfig = () => {
    var _a;
    const config = functions.config();
    return {
        apiSecret: ((_a = config.shopify) === null || _a === void 0 ? void 0 : _a.api_secret) || process.env.SHOPIFY_API_SECRET || '',
    };
};
/**
 * Helper to verify incoming webhook request
 */
function verifyGdprWebhook(req) {
    var _a;
    const config = getShopifyConfig();
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const shopDomain = req.headers['x-shopify-shop-domain'];
    if (!hmacHeader) {
        return { valid: false, error: 'Missing HMAC header' };
    }
    if (!shopDomain) {
        return { valid: false, error: 'Missing shop domain header' };
    }
    // Get raw body for HMAC verification
    const rawBody = ((_a = req.rawBody) === null || _a === void 0 ? void 0 : _a.toString()) || JSON.stringify(req.body);
    if (!(0, shopify_auth_1.verifyWebhookHmac)(rawBody, hmacHeader, config.apiSecret)) {
        return { valid: false, error: 'Invalid HMAC signature' };
    }
    return { valid: true, shopDomain };
}
/**
 * Customer Data Request Webhook
 *
 * Called when a customer requests to know what data you have stored about them.
 * You should respond with a list of all personal data you have for this customer.
 *
 * Endpoint: POST /api/gdpr/customers/data_request
 */
exports.gdprCustomersDataRequest = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    // Verify webhook
    const verification = verifyGdprWebhook(req);
    if (!verification.valid) {
        console.error('GDPR webhook verification failed:', verification.error);
        res.status(401).send('Unauthorized');
        return;
    }
    const { shopDomain } = verification;
    const { customer, orders_requested } = req.body;
    console.log(`[GDPR] Customer data request from shop: ${shopDomain}`);
    console.log(`[GDPR] Customer ID: ${customer === null || customer === void 0 ? void 0 : customer.id}, Email: ${customer === null || customer === void 0 ? void 0 : customer.email}`);
    console.log(`[GDPR] Orders requested: ${orders_requested === null || orders_requested === void 0 ? void 0 : orders_requested.join(', ')}`);
    try {
        const db = admin.firestore();
        // In this app, we don't store customer data directly.
        // We store shop-level data (mockups, posts) that belong to the merchant.
        // If you were storing customer-related data, you would query it here.
        // Log the request for audit purposes
        await db.collection('gdprRequests').add({
            type: 'customers_data_request',
            shopDomain,
            customerId: customer === null || customer === void 0 ? void 0 : customer.id,
            customerEmail: customer === null || customer === void 0 ? void 0 : customer.email,
            ordersRequested: orders_requested || [],
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'acknowledged',
            // No customer data to return for this app
            dataFound: false,
        });
        // Respond with 200 to acknowledge receipt
        // Shopify expects a response within 48 hours
        res.status(200).json({
            message: 'Data request received',
            dataFound: false,
            note: 'This app does not store customer personal data.',
        });
    }
    catch (error) {
        console.error('[GDPR] Error processing data request:', error);
        res.status(500).send('Internal error');
    }
});
/**
 * Customer Redact Webhook
 *
 * Called when a store owner requests deletion of a customer's data,
 * or when a customer requests their data be erased.
 *
 * Endpoint: POST /api/gdpr/customers/redact
 */
exports.gdprCustomersRedact = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    // Verify webhook
    const verification = verifyGdprWebhook(req);
    if (!verification.valid) {
        console.error('GDPR webhook verification failed:', verification.error);
        res.status(401).send('Unauthorized');
        return;
    }
    const { shopDomain } = verification;
    const { customer, orders_to_redact } = req.body;
    console.log(`[GDPR] Customer redact request from shop: ${shopDomain}`);
    console.log(`[GDPR] Customer ID: ${customer === null || customer === void 0 ? void 0 : customer.id}, Email: ${customer === null || customer === void 0 ? void 0 : customer.email}`);
    console.log(`[GDPR] Orders to redact: ${orders_to_redact === null || orders_to_redact === void 0 ? void 0 : orders_to_redact.join(', ')}`);
    try {
        const db = admin.firestore();
        // In this app, we don't store customer data.
        // If you were storing customer-related data, you would delete it here.
        // Log the request for audit purposes
        await db.collection('gdprRequests').add({
            type: 'customers_redact',
            shopDomain,
            customerId: customer === null || customer === void 0 ? void 0 : customer.id,
            customerEmail: customer === null || customer === void 0 ? void 0 : customer.email,
            ordersToRedact: orders_to_redact || [],
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            // No customer data to delete for this app
            dataDeleted: false,
        });
        // Respond with 200 to acknowledge
        res.status(200).json({
            message: 'Redact request processed',
            dataDeleted: false,
            note: 'This app does not store customer personal data.',
        });
    }
    catch (error) {
        console.error('[GDPR] Error processing redact request:', error);
        res.status(500).send('Internal error');
    }
});
/**
 * Shop Redact Webhook
 *
 * Called 48 hours after a shop uninstalls your app.
 * You must delete all shop data at this point.
 *
 * Endpoint: POST /api/gdpr/shop/redact
 */
exports.gdprShopRedact = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    // Verify webhook
    const verification = verifyGdprWebhook(req);
    if (!verification.valid) {
        console.error('GDPR webhook verification failed:', verification.error);
        res.status(401).send('Unauthorized');
        return;
    }
    const { shopDomain } = verification;
    const { shop_id } = req.body;
    console.log(`[GDPR] Shop redact request for: ${shopDomain} (ID: ${shop_id})`);
    try {
        const db = admin.firestore();
        const storage = admin.storage();
        // Start deletion process
        const deletionResults = [];
        // 1. Delete shop's mockups
        const mockupsRef = db.collection('shops').doc(shopDomain).collection('mockups');
        const mockupsSnapshot = await mockupsRef.get();
        const mockupBatch = db.batch();
        mockupsSnapshot.docs.forEach((doc) => mockupBatch.delete(doc.ref));
        if (mockupsSnapshot.size > 0) {
            await mockupBatch.commit();
        }
        deletionResults.push({ collection: 'mockups', docsDeleted: mockupsSnapshot.size });
        // 2. Delete shop's scheduled posts
        const postsRef = db.collection('shops').doc(shopDomain).collection('scheduledPosts');
        const postsSnapshot = await postsRef.get();
        const postsBatch = db.batch();
        postsSnapshot.docs.forEach((doc) => postsBatch.delete(doc.ref));
        if (postsSnapshot.size > 0) {
            await postsBatch.commit();
        }
        deletionResults.push({ collection: 'scheduledPosts', docsDeleted: postsSnapshot.size });
        // 3. Delete shop's settings
        const settingsRef = db.collection('shops').doc(shopDomain).collection('settings');
        const settingsSnapshot = await settingsRef.get();
        const settingsBatch = db.batch();
        settingsSnapshot.docs.forEach((doc) => settingsBatch.delete(doc.ref));
        if (settingsSnapshot.size > 0) {
            await settingsBatch.commit();
        }
        deletionResults.push({ collection: 'settings', docsDeleted: settingsSnapshot.size });
        // 4. Delete the shop document itself
        await db.collection('shops').doc(shopDomain).delete();
        deletionResults.push({ collection: 'shops', docsDeleted: 1 });
        // 5. Delete shop from shopifyStores collection
        await db.collection('shopifyStores').doc(shopDomain).delete();
        deletionResults.push({ collection: 'shopifyStores', docsDeleted: 1 });
        // 6. Delete shop's files from storage
        try {
            const bucket = storage.bucket();
            const [files] = await bucket.getFiles({
                prefix: `shops/${shopDomain}/`,
            });
            if (files.length > 0) {
                await Promise.all(files.map((file) => file.delete()));
                console.log(`[GDPR] Deleted ${files.length} files for shop: ${shopDomain}`);
            }
        }
        catch (storageError) {
            console.warn('[GDPR] Storage deletion warning:', storageError);
            // Continue even if storage deletion fails
        }
        // Log the completed request
        await db.collection('gdprRequests').add({
            type: 'shop_redact',
            shopDomain,
            shopId: shop_id,
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            deletionResults,
        });
        console.log(`[GDPR] Shop data deleted for: ${shopDomain}`, deletionResults);
        res.status(200).json({
            message: 'Shop data deleted',
            deletionResults,
        });
    }
    catch (error) {
        console.error('[GDPR] Error processing shop redact:', error);
        res.status(500).send('Internal error');
    }
});
/**
 * Manual data export endpoint (for admin use)
 *
 * Allows shop owners to export their data from within the app.
 * This is a convenience feature, not required by GDPR.
 */
exports.exportShopData = functions.https.onRequest(async (req, res) => {
    // This would typically require authentication via session token
    // For now, return method not implemented
    res.status(501).json({
        error: 'Not implemented',
        message: 'Use the Shopify admin to export your data.',
    });
});
//# sourceMappingURL=shopify-gdpr.js.map