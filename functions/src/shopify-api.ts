/**
 * Shopify API Proxy Module
 *
 * Provides authenticated access to Shopify APIs for the frontend:
 * - Products API (list, get, images)
 * - Handles pagination and rate limiting
 * - Uses stored access tokens from Firestore
 */

import * as functions from 'firebase-functions';
import cors from 'cors';
import { verifyRequestSession, getShopAccessToken } from './shopify-auth';

const corsHandler = cors({ origin: true });

// Shopify API version
const API_VERSION = '2024-01';

/**
 * Shopify Product type
 */
interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  status: string;
  tags: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  created_at: string;
  updated_at: string;
}

interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  width: number;
  height: number;
  alt: string | null;
}

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
  image_id: number | null;
}

/**
 * Make authenticated request to Shopify API
 */
async function shopifyFetch<T>(
  shop: string,
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `https://${shop}/admin/api/${API_VERSION}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Shopify API error (${response.status}):`, errorText);
    throw new Error(`Shopify API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get products list
 * Supports pagination and filtering
 */
export const shopifyGetProducts = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Verify session
    const session = await verifyRequestSession(req);
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
    const accessToken = await getShopAccessToken(session.shop);
    if (!accessToken) {
      console.error('[shopifyGetProducts] No access token found for shop:', session.shop);
      res.status(401).json({ error: 'Shop access token not found. Please reinstall the app.' });
      return;
    }
    console.log('[shopifyGetProducts] Access token found, fetching products...');

    try {
      // Build query parameters
      const params = new URLSearchParams();

      // Pagination
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 250);
      params.set('limit', limit.toString());

      if (req.query.page_info) {
        params.set('page_info', req.query.page_info as string);
      }

      // Filtering
      if (req.query.product_type) {
        params.set('product_type', req.query.product_type as string);
      }
      if (req.query.vendor) {
        params.set('vendor', req.query.vendor as string);
      }
      if (req.query.status) {
        params.set('status', req.query.status as string);
      }
      if (req.query.collection_id) {
        params.set('collection_id', req.query.collection_id as string);
      }
      if (req.query.ids) {
        params.set('ids', req.query.ids as string);
      }

      // Fields to return
      params.set('fields', 'id,title,body_html,vendor,product_type,handle,status,tags,images,variants,created_at,updated_at');

      const endpoint = `/products.json?${params.toString()}`;
      const data = await shopifyFetch<{ products: ShopifyProduct[] }>(
        session.shop,
        endpoint,
        accessToken
      );

      // Transform products for frontend
      const products = data.products.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
        vendor: product.vendor,
        productType: product.product_type,
        handle: product.handle,
        status: product.status,
        tags: product.tags ? product.tags.split(', ') : [],
        featuredImage: product.images[0]?.src || null,
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
      }));

      res.json({
        products,
        shop: session.shop,
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });
});

/**
 * Get single product by ID
 */
export const shopifyGetProduct = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Verify session
    const session = await verifyRequestSession(req);
    if (!session.valid || !session.shop) {
      res.status(401).json({ error: session.error || 'Unauthorized' });
      return;
    }

    const productId = req.query.id as string;
    if (!productId) {
      res.status(400).json({ error: 'Missing product ID' });
      return;
    }

    // Get access token
    const accessToken = await getShopAccessToken(session.shop);
    if (!accessToken) {
      res.status(401).json({ error: 'Shop access token not found' });
      return;
    }

    try {
      const data = await shopifyFetch<{ product: ShopifyProduct }>(
        session.shop,
        `/products/${productId}.json`,
        accessToken
      );

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
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  });
});

/**
 * Get product images
 */
export const shopifyGetProductImages = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Verify session
    const session = await verifyRequestSession(req);
    if (!session.valid || !session.shop) {
      res.status(401).json({ error: session.error || 'Unauthorized' });
      return;
    }

    const productId = req.query.product_id as string;
    if (!productId) {
      res.status(400).json({ error: 'Missing product_id' });
      return;
    }

    // Get access token
    const accessToken = await getShopAccessToken(session.shop);
    if (!accessToken) {
      res.status(401).json({ error: 'Shop access token not found' });
      return;
    }

    try {
      const data = await shopifyFetch<{ images: ShopifyImage[] }>(
        session.shop,
        `/products/${productId}/images.json`,
        accessToken
      );

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
    } catch (error) {
      console.error('Error fetching product images:', error);
      res.status(500).json({ error: 'Failed to fetch product images' });
    }
  });
});

/**
 * Get collections list
 */
export const shopifyGetCollections = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Verify session
    const session = await verifyRequestSession(req);
    if (!session.valid || !session.shop) {
      res.status(401).json({ error: session.error || 'Unauthorized' });
      return;
    }

    // Get access token
    const accessToken = await getShopAccessToken(session.shop);
    if (!accessToken) {
      res.status(401).json({ error: 'Shop access token not found' });
      return;
    }

    try {
      // Fetch both custom collections and smart collections
      const [customCollections, smartCollections] = await Promise.all([
        shopifyFetch<{ custom_collections: any[] }>(
          session.shop,
          '/custom_collections.json?limit=250',
          accessToken
        ),
        shopifyFetch<{ smart_collections: any[] }>(
          session.shop,
          '/smart_collections.json?limit=250',
          accessToken
        ),
      ]);

      const collections = [
        ...customCollections.custom_collections.map((c) => ({
          id: c.id,
          title: c.title,
          handle: c.handle,
          type: 'custom',
          image: c.image?.src || null,
          productsCount: c.products_count,
        })),
        ...smartCollections.smart_collections.map((c) => ({
          id: c.id,
          title: c.title,
          handle: c.handle,
          type: 'smart',
          image: c.image?.src || null,
          productsCount: c.products_count,
        })),
      ];

      // Sort by title
      collections.sort((a, b) => a.title.localeCompare(b.title));

      res.json({
        collections,
        shop: session.shop,
      });
    } catch (error) {
      console.error('Error fetching collections:', error);
      res.status(500).json({ error: 'Failed to fetch collections' });
    }
  });
});

/**
 * Search products
 */
export const shopifySearchProducts = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Verify session
    const session = await verifyRequestSession(req);
    if (!session.valid || !session.shop) {
      res.status(401).json({ error: session.error || 'Unauthorized' });
      return;
    }

    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: 'Missing search query' });
      return;
    }

    // Get access token
    const accessToken = await getShopAccessToken(session.shop);
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

      const data = await shopifyFetch<{ products: ShopifyProduct[] }>(
        session.shop,
        `/products.json?${params.toString()}`,
        accessToken
      );

      const products = data.products.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.body_html?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
        vendor: product.vendor,
        productType: product.product_type,
        handle: product.handle,
        status: product.status,
        featuredImage: product.images[0]?.src || null,
        images: product.images.map((img) => ({
          id: img.id,
          src: img.src,
          alt: img.alt,
        })),
        price: product.variants[0]?.price || '0.00',
      }));

      res.json({
        products,
        query,
        shop: session.shop,
      });
    } catch (error) {
      console.error('Error searching products:', error);
      res.status(500).json({ error: 'Failed to search products' });
    }
  });
});

/**
 * Get shop information
 */
export const shopifyGetShop = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Verify session
    const session = await verifyRequestSession(req);
    if (!session.valid || !session.shop) {
      res.status(401).json({ error: session.error || 'Unauthorized' });
      return;
    }

    // Get access token
    const accessToken = await getShopAccessToken(session.shop);
    if (!accessToken) {
      res.status(401).json({ error: 'Shop access token not found' });
      return;
    }

    try {
      const data = await shopifyFetch<{ shop: any }>(
        session.shop,
        '/shop.json',
        accessToken
      );

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
    } catch (error) {
      console.error('Error fetching shop:', error);
      res.status(500).json({ error: 'Failed to fetch shop info' });
    }
  });
});

/**
 * Proxy image download (to avoid CORS issues with Shopify CDN)
 */
export const shopifyProxyImage = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const imageUrl = req.query.url as string;

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
    } catch (error) {
      console.error('Error proxying image:', error);
      res.status(500).json({ error: 'Failed to proxy image' });
    }
  });
});

