"use strict";
/**
 * Shopify API Proxy Module
 *
 * Provides authenticated access to Shopify APIs for the frontend:
 * - Products API (list, get, images)
 * - Handles pagination and rate limiting
 * - Uses stored access tokens from Firestore
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
exports.shopifyProxyImage = exports.shopifyGetShop = exports.shopifySearchProducts = exports.shopifyGetCollections = exports.shopifyGetProductImages = exports.shopifyGetProduct = exports.shopifyGetProducts = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const shopify_auth_1 = require("./shopify-auth");
const corsHandler = (0, cors_1.default)({ origin: true });
// Shopify API version
const API_VERSION = '2024-01';
/**
 * Make authenticated request to Shopify API
 */
async function shopifyFetch(shop, endpoint, accessToken, options = {}) {
    const url = `https://${shop}/admin/api/${API_VERSION}${endpoint}`;
    const response = await fetch(url, Object.assign(Object.assign({}, options), { headers: Object.assign({ 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }, options.headers) }));
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error (${response.status}):`, errorText);
        // If token is invalid, throw a specific error that frontend can detect
        if (response.status === 401 || response.status === 403) {
            throw new Error('INVALID_ACCESS_TOKEN');
        }
        throw new Error(`Shopify API error: ${response.status}`);
    }
    return response.json();
}
/**
 * Get products list
 * Supports pagination and filtering
 */
exports.shopifyGetProducts = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Verify session
        const session = await (0, shopify_auth_1.verifyRequestSession)(req);
        console.log('[shopifyGetProducts] Session verification:', {
            valid: session.valid,
            shop: session.shop,
            error: session.error,
        });
        if (!session.valid || !session.shop) {
            res.status(401).json({ error: session.error || 'Unauthorized' });
            return;
        }
        // Get access token
        console.log('[shopifyGetProducts] Looking up access token for shop:', session.shop);
        const accessToken = await (0, shopify_auth_1.getShopAccessToken)(session.shop);
        if (!accessToken) {
            console.error('[shopifyGetProducts] No access token found for shop:', session.shop);
            res.status(401).json({ error: 'Shop access token not found. Please reinstall the app.' });
            return;
        }
        console.log('[shopifyGetProducts] Access token found:', accessToken.substring(0, 10) + '...');
        console.log('[shopifyGetProducts] Fetching products...');
        try {
            // Build query parameters
            const params = new URLSearchParams();
            // Pagination
            const limit = Math.min(parseInt(req.query.limit) || 50, 250);
            params.set('limit', limit.toString());
            if (req.query.page_info) {
                params.set('page_info', req.query.page_info);
            }
            // Filtering
            if (req.query.product_type) {
                params.set('product_type', req.query.product_type);
            }
            if (req.query.vendor) {
                params.set('vendor', req.query.vendor);
            }
            if (req.query.status) {
                params.set('status', req.query.status);
            }
            if (req.query.collection_id) {
                params.set('collection_id', req.query.collection_id);
            }
            if (req.query.ids) {
                params.set('ids', req.query.ids);
            }
            // Fields to return
            params.set('fields', 'id,title,body_html,vendor,product_type,handle,status,tags,images,variants,created_at,updated_at');
            const endpoint = `/products.json?${params.toString()}`;
            const data = await shopifyFetch(session.shop, endpoint, accessToken);
            // Transform products for frontend
            const products = data.products.map((product) => {
                var _a, _b;
                return ({
                    id: product.id,
                    title: product.title,
                    description: ((_a = product.body_html) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>/g, '').substring(0, 200)) || '',
                    vendor: product.vendor,
                    productType: product.product_type,
                    handle: product.handle,
                    status: product.status,
                    tags: product.tags ? product.tags.split(', ') : [],
                    featuredImage: ((_b = product.images[0]) === null || _b === void 0 ? void 0 : _b.src) || null,
                    images: product.images.map((img) => ({
                        id: img.id,
                        src: img.src,
                        width: img.width,
                        height: img.height,
                        alt: img.alt,
                    })),
                    variants: product.variants.map((v) => ({
                        id: v.id,
                        title: v.title,
                        price: v.price,
                        sku: v.sku,
                        inventoryQuantity: v.inventory_quantity,
                    })),
                    createdAt: product.created_at,
                    updatedAt: product.updated_at,
                });
            });
            res.json({
                products,
                shop: session.shop,
            });
        }
        catch (error) {
            console.error('Error fetching products:', error);
            // If the access token is invalid, delete it and tell the frontend to re-auth
            if (error.message === 'INVALID_ACCESS_TOKEN') {
                console.log('[shopifyGetProducts] Deleting invalid token for shop:', session.shop);
                const db = admin.firestore();
                await db.collection('shopifyStores').doc(session.shop).delete();
                res.status(401).json({
                    error: 'Access token is invalid. Please reinstall the app.',
                    code: 'INVALID_ACCESS_TOKEN'
                });
                return;
            }
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    });
});
/**
 * Get single product by ID
 */
exports.shopifyGetProduct = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Verify session
        const session = await (0, shopify_auth_1.verifyRequestSession)(req);
        if (!session.valid || !session.shop) {
            res.status(401).json({ error: session.error || 'Unauthorized' });
            return;
        }
        const productId = req.query.id;
        if (!productId) {
            res.status(400).json({ error: 'Missing product ID' });
            return;
        }
        // Get access token
        const accessToken = await (0, shopify_auth_1.getShopAccessToken)(session.shop);
        if (!accessToken) {
            res.status(401).json({ error: 'Shop access token not found' });
            return;
        }
        try {
            const data = await shopifyFetch(session.shop, `/products/${productId}.json`, accessToken);
            const product = data.product;
            res.json({
                product: {
                    id: product.id,
                    title: product.title,
                    description: product.body_html,
                    vendor: product.vendor,
                    productType: product.product_type,
                    handle: product.handle,
                    status: product.status,
                    tags: product.tags ? product.tags.split(', ') : [],
                    images: product.images.map((img) => ({
                        id: img.id,
                        src: img.src,
                        width: img.width,
                        height: img.height,
                        alt: img.alt,
                        position: img.position,
                    })),
                    variants: product.variants.map((v) => ({
                        id: v.id,
                        title: v.title,
                        price: v.price,
                        sku: v.sku,
                        inventoryQuantity: v.inventory_quantity,
                        imageId: v.image_id,
                    })),
                    createdAt: product.created_at,
                    updatedAt: product.updated_at,
                },
                shop: session.shop,
            });
        }
        catch (error) {
            console.error('Error fetching product:', error);
            res.status(500).json({ error: 'Failed to fetch product' });
        }
    });
});
/**
 * Get product images
 */
exports.shopifyGetProductImages = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Verify session
        const session = await (0, shopify_auth_1.verifyRequestSession)(req);
        if (!session.valid || !session.shop) {
            res.status(401).json({ error: session.error || 'Unauthorized' });
            return;
        }
        const productId = req.query.product_id;
        if (!productId) {
            res.status(400).json({ error: 'Missing product_id' });
            return;
        }
        // Get access token
        const accessToken = await (0, shopify_auth_1.getShopAccessToken)(session.shop);
        if (!accessToken) {
            res.status(401).json({ error: 'Shop access token not found' });
            return;
        }
        try {
            const data = await shopifyFetch(session.shop, `/products/${productId}/images.json`, accessToken);
            res.json({
                images: data.images.map((img) => ({
                    id: img.id,
                    productId: img.product_id,
                    src: img.src,
                    width: img.width,
                    height: img.height,
                    alt: img.alt,
                    position: img.position,
                })),
                shop: session.shop,
            });
        }
        catch (error) {
            console.error('Error fetching product images:', error);
            res.status(500).json({ error: 'Failed to fetch product images' });
        }
    });
});
/**
 * Get collections list
 */
exports.shopifyGetCollections = functions.https.onRequest((req, res) => {
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
            // Fetch both custom collections and smart collections
            const [customCollections, smartCollections] = await Promise.all([
                shopifyFetch(session.shop, '/custom_collections.json?limit=250', accessToken),
                shopifyFetch(session.shop, '/smart_collections.json?limit=250', accessToken),
            ]);
            const collections = [
                ...customCollections.custom_collections.map((c) => {
                    var _a;
                    return ({
                        id: c.id,
                        title: c.title,
                        handle: c.handle,
                        type: 'custom',
                        image: ((_a = c.image) === null || _a === void 0 ? void 0 : _a.src) || null,
                        productsCount: c.products_count,
                    });
                }),
                ...smartCollections.smart_collections.map((c) => {
                    var _a;
                    return ({
                        id: c.id,
                        title: c.title,
                        handle: c.handle,
                        type: 'smart',
                        image: ((_a = c.image) === null || _a === void 0 ? void 0 : _a.src) || null,
                        productsCount: c.products_count,
                    });
                }),
            ];
            // Sort by title
            collections.sort((a, b) => a.title.localeCompare(b.title));
            res.json({
                collections,
                shop: session.shop,
            });
        }
        catch (error) {
            console.error('Error fetching collections:', error);
            res.status(500).json({ error: 'Failed to fetch collections' });
        }
    });
});
/**
 * Search products
 */
exports.shopifySearchProducts = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Verify session
        const session = await (0, shopify_auth_1.verifyRequestSession)(req);
        if (!session.valid || !session.shop) {
            res.status(401).json({ error: session.error || 'Unauthorized' });
            return;
        }
        const query = req.query.q;
        if (!query) {
            res.status(400).json({ error: 'Missing search query' });
            return;
        }
        // Get access token
        const accessToken = await (0, shopify_auth_1.getShopAccessToken)(session.shop);
        if (!accessToken) {
            res.status(401).json({ error: 'Shop access token not found' });
            return;
        }
        try {
            // Shopify REST API doesn't have great search, so we use title filter
            // For better search, GraphQL would be preferred
            const params = new URLSearchParams();
            params.set('limit', '50');
            params.set('title', query);
            params.set('fields', 'id,title,body_html,vendor,product_type,handle,status,images,variants');
            const data = await shopifyFetch(session.shop, `/products.json?${params.toString()}`, accessToken);
            const products = data.products.map((product) => {
                var _a, _b, _c;
                return ({
                    id: product.id,
                    title: product.title,
                    description: ((_a = product.body_html) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>/g, '').substring(0, 200)) || '',
                    vendor: product.vendor,
                    productType: product.product_type,
                    handle: product.handle,
                    status: product.status,
                    featuredImage: ((_b = product.images[0]) === null || _b === void 0 ? void 0 : _b.src) || null,
                    images: product.images.map((img) => ({
                        id: img.id,
                        src: img.src,
                        alt: img.alt,
                    })),
                    price: ((_c = product.variants[0]) === null || _c === void 0 ? void 0 : _c.price) || '0.00',
                });
            });
            res.json({
                products,
                query,
                shop: session.shop,
            });
        }
        catch (error) {
            console.error('Error searching products:', error);
            res.status(500).json({ error: 'Failed to search products' });
        }
    });
});
/**
 * Get shop information
 */
exports.shopifyGetShop = functions.https.onRequest((req, res) => {
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
            const data = await shopifyFetch(session.shop, '/shop.json', accessToken);
            res.json({
                shop: {
                    domain: data.shop.domain,
                    myshopifyDomain: data.shop.myshopify_domain,
                    name: data.shop.name,
                    email: data.shop.email,
                    shopOwner: data.shop.shop_owner,
                    currency: data.shop.currency,
                    timezone: data.shop.timezone,
                    ianaTimezone: data.shop.iana_timezone,
                    planName: data.shop.plan_name,
                    country: data.shop.country_name,
                },
            });
        }
        catch (error) {
            console.error('Error fetching shop:', error);
            res.status(500).json({ error: 'Failed to fetch shop info' });
        }
    });
});
/**
 * Proxy image download (to avoid CORS issues with Shopify CDN)
 */
exports.shopifyProxyImage = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            res.status(400).json({ error: 'Missing image URL' });
            return;
        }
        // Only allow Shopify CDN URLs
        if (!imageUrl.includes('cdn.shopify.com')) {
            res.status(400).json({ error: 'Invalid image URL' });
            return;
        }
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                res.status(response.status).json({ error: 'Failed to fetch image' });
                return;
            }
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const buffer = await response.arrayBuffer();
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
            res.send(Buffer.from(buffer));
        }
        catch (error) {
            console.error('Error proxying image:', error);
            res.status(500).json({ error: 'Failed to proxy image' });
        }
    });
});
//# sourceMappingURL=shopify-api.js.map