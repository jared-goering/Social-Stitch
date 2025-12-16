/**
 * Shopify API Proxy Module
 *
 * Provides authenticated access to Shopify APIs for the frontend:
 * - Products API (list, get, images) via GraphQL
 * - Handles pagination and rate limiting
 * - Uses stored access tokens from Firestore
 * 
 * MIGRATED TO GRAPHQL: As of 2024-04, REST Admin API /products and /variants
 * endpoints are deprecated. This module now uses GraphQL for all product operations.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import { verifyRequestSession, getShopAccessToken } from './shopify-auth';

const corsHandler = cors({ origin: true });

// Shopify API version
const API_VERSION = '2024-10';

// ============================================================================
// GID Conversion Utilities
// ============================================================================

/**
 * Convert a Shopify GID to numeric ID
 * e.g., "gid://shopify/Product/123" -> 123
 */
function gidToId(gid: string): number {
  const match = gid.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Convert a numeric ID to a Shopify GID
 * e.g., 123 -> "gid://shopify/Product/123"
 */
function idToGid(id: number | string, type: 'Product' | 'ProductImage' | 'ProductVariant' | 'Collection' | 'MediaImage'): string {
  return `gid://shopify/${type}/${id}`;
}

// ============================================================================
// GraphQL Types
// ============================================================================

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; locations?: Array<{ line: number; column: number }> }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

interface GraphQLProductNode {
  id: string;
  title: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  handle: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  featuredImage?: {
    id: string;
    url: string;
    width: number;
    height: number;
    altText: string | null;
  } | null;
  images: {
    edges: Array<{
      node: {
        id: string;
        url: string;
        width: number;
        height: number;
        altText: string | null;
      };
    }>;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: string;
        sku: string | null;
        inventoryQuantity: number | null;
        image?: {
          id: string;
        } | null;
      };
    }>;
  };
}

interface GraphQLCollectionNode {
  id: string;
  title: string;
  handle: string;
  image?: {
    url: string;
  } | null;
  productsCount: {
    count: number;
  };
}

// ============================================================================
// GraphQL Helper
// ============================================================================

/**
 * Make authenticated GraphQL request to Shopify API
 */
async function shopifyGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Shopify GraphQL error (${response.status}):`, errorText);
    
    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
    
    throw new Error(`Shopify GraphQL error: ${response.status}`);
  }

  const result = await response.json() as GraphQLResponse<T>;

  if (result.errors && result.errors.length > 0) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(`GraphQL error: ${result.errors[0].message}`);
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL');
  }

  return result.data;
}

/**
 * Legacy REST fetch (kept for non-deprecated endpoints like /shop.json)
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
    
    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
    
    throw new Error(`Shopify API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const PRODUCTS_QUERY = `
  query getProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          title
          descriptionHtml
          vendor
          productType
          handle
          status
          tags
          createdAt
          updatedAt
          featuredImage {
            id
            url
            width
            height
            altText
          }
          images(first: 20) {
            edges {
              node {
                id
                url
                width
                height
                altText
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
                image {
                  id
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PRODUCT_BY_ID_QUERY = `
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      descriptionHtml
      vendor
      productType
      handle
      status
      tags
      createdAt
      updatedAt
      images(first: 50) {
        edges {
          node {
            id
            url
            width
            height
            altText
          }
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            price
            sku
            inventoryQuantity
            image {
              id
            }
          }
        }
      }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query getCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          image {
            url
          }
          productsCount {
            count
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const COLLECTION_PRODUCTS_QUERY = `
  query getCollectionProducts($id: ID!, $first: Int!, $after: String) {
    collection(id: $id) {
      products(first: $first, after: $after) {
        edges {
          node {
            id
            title
            descriptionHtml
            vendor
            productType
            handle
            status
            tags
            createdAt
            updatedAt
            featuredImage {
              id
              url
              width
              height
              altText
            }
            images(first: 20) {
              edges {
                node {
                  id
                  url
                  width
                  height
                  altText
                }
              }
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  inventoryQuantity
                  image {
                    id
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const CREATE_PRODUCT_MEDIA_MUTATION = `
  mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage {
          id
          image {
            url
            width
            height
            altText
          }
        }
      }
      mediaUserErrors {
        field
        message
      }
      product {
        id
      }
    }
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform GraphQL product node to frontend format
 */
function transformProduct(node: GraphQLProductNode) {
  return {
    id: gidToId(node.id),
    title: node.title,
    description: node.descriptionHtml?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
    vendor: node.vendor,
    productType: node.productType,
    handle: node.handle,
    status: node.status.toLowerCase(),
    tags: node.tags,
    featuredImage: node.featuredImage?.url || node.images.edges[0]?.node.url || null,
    images: node.images.edges.map((edge) => ({
      id: gidToId(edge.node.id),
      src: edge.node.url,
      width: edge.node.width,
      height: edge.node.height,
      alt: edge.node.altText,
    })),
    variants: node.variants.edges.map((edge) => ({
      id: gidToId(edge.node.id),
      title: edge.node.title,
      price: edge.node.price,
      sku: edge.node.sku || '',
      inventoryQuantity: edge.node.inventoryQuantity || 0,
      imageId: edge.node.image ? gidToId(edge.node.image.id) : null,
    })),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

/**
 * Build GraphQL query string from filter parameters
 */
function buildProductQueryString(params: {
  productType?: string;
  vendor?: string;
  status?: string;
  ids?: string;
  title?: string;
}): string | undefined {
  const queryParts: string[] = [];

  if (params.productType) {
    queryParts.push(`product_type:${params.productType}`);
  }
  if (params.vendor) {
    queryParts.push(`vendor:${params.vendor}`);
  }
  if (params.status) {
    queryParts.push(`status:${params.status}`);
  }
  if (params.ids) {
    // Convert comma-separated IDs to GraphQL query format
    const ids = params.ids.split(',').map(id => `id:${id.trim()}`).join(' OR ');
    queryParts.push(`(${ids})`);
  }
  if (params.title) {
    queryParts.push(`title:*${params.title}*`);
  }

  return queryParts.length > 0 ? queryParts.join(' AND ') : undefined;
}

// ============================================================================
// Cloud Functions
// ============================================================================

/**
 * Get products list
 * Supports pagination and filtering via GraphQL
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
    console.log('[shopifyGetProducts] Access token found:', accessToken.substring(0, 10) + '...');
    console.log('[shopifyGetProducts] Fetching products via GraphQL...');

    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 250);
      const after = req.query.page_info as string | undefined;
      const collectionId = req.query.collection_id as string | undefined;

      // Build query string for filtering
      const queryString = buildProductQueryString({
        productType: req.query.product_type as string,
        vendor: req.query.vendor as string,
        status: req.query.status as string,
        ids: req.query.ids as string,
      });

      let products: ReturnType<typeof transformProduct>[] = [];
      let pageInfo: { hasNextPage: boolean; endCursor?: string } = { hasNextPage: false };

      if (collectionId) {
        // Fetch products from a specific collection
        const collectionGid = idToGid(collectionId, 'Collection');
        const data = await shopifyGraphQL<{
          collection: {
            products: {
              edges: Array<{ node: GraphQLProductNode }>;
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
            };
          } | null;
        }>(session.shop, accessToken, COLLECTION_PRODUCTS_QUERY, {
          id: collectionGid,
          first: limit,
          after: after || null,
        });

        if (data.collection) {
          products = data.collection.products.edges.map((edge) => transformProduct(edge.node));
          pageInfo = {
            hasNextPage: data.collection.products.pageInfo.hasNextPage,
            endCursor: data.collection.products.pageInfo.endCursor || undefined,
          };
        }
      } else {
        // Fetch all products with optional filtering
        const data = await shopifyGraphQL<{
          products: {
            edges: Array<{ node: GraphQLProductNode }>;
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        }>(session.shop, accessToken, PRODUCTS_QUERY, {
          first: limit,
          after: after || null,
          query: queryString || null,
        });

        products = data.products.edges.map((edge) => transformProduct(edge.node));
        pageInfo = {
          hasNextPage: data.products.pageInfo.hasNextPage,
          endCursor: data.products.pageInfo.endCursor || undefined,
        };
      }

      res.json({
        products,
        shop: session.shop,
        pageInfo,
      });
    } catch (error: any) {
      console.error('Error fetching products:', error);
      
      if (error.message === 'INVALID_ACCESS_TOKEN') {
        console.log('[shopifyGetProducts] Deleting invalid token for shop:', session.shop);
        const db = admin.firestore();
        await db.collection('shopifyStores').doc(session.shop!).delete();
        
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
 * Get single product by ID via GraphQL
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
      const productGid = idToGid(productId, 'Product');
      
      const data = await shopifyGraphQL<{
        product: GraphQLProductNode | null;
      }>(session.shop, accessToken, PRODUCT_BY_ID_QUERY, {
        id: productGid,
      });

      if (!data.product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const product = data.product;

      res.json({
        product: {
          id: gidToId(product.id),
          title: product.title,
          description: product.descriptionHtml,
          vendor: product.vendor,
          productType: product.productType,
          handle: product.handle,
          status: product.status.toLowerCase(),
          tags: product.tags,
          images: product.images.edges.map((edge, index) => ({
            id: gidToId(edge.node.id),
            src: edge.node.url,
            width: edge.node.width,
            height: edge.node.height,
            alt: edge.node.altText,
            position: index + 1,
          })),
          variants: product.variants.edges.map((edge) => ({
            id: gidToId(edge.node.id),
            title: edge.node.title,
            price: edge.node.price,
            sku: edge.node.sku || '',
            inventoryQuantity: edge.node.inventoryQuantity || 0,
            imageId: edge.node.image ? gidToId(edge.node.image.id) : null,
          })),
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
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
 * Get product images via GraphQL
 * Uses the product query to fetch images
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
      const productGid = idToGid(productId, 'Product');
      
      // Query for product images
      const PRODUCT_IMAGES_QUERY = `
        query getProductImages($id: ID!) {
          product(id: $id) {
            id
            images(first: 100) {
              edges {
                node {
                  id
                  url
                  width
                  height
                  altText
                }
              }
            }
          }
        }
      `;
      
      const data = await shopifyGraphQL<{
        product: {
          id: string;
          images: {
            edges: Array<{
              node: {
                id: string;
                url: string;
                width: number;
                height: number;
                altText: string | null;
              };
            }>;
          };
        } | null;
      }>(session.shop, accessToken, PRODUCT_IMAGES_QUERY, {
        id: productGid,
      });

      if (!data.product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      res.json({
        images: data.product.images.edges.map((edge, index) => ({
          id: gidToId(edge.node.id),
          productId: parseInt(productId, 10),
          src: edge.node.url,
          width: edge.node.width,
          height: edge.node.height,
          alt: edge.node.altText,
          position: index + 1,
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
 * Get collections list via GraphQL
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
      // Response type for collections query
      interface CollectionsResponse {
        collections: {
          edges: Array<{ node: GraphQLCollectionNode }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      }
      
      // Fetch all collections (paginated)
      const allCollections: Array<{
        id: number;
        title: string;
        handle: string;
        type: string;
        image: string | null;
        productsCount: number;
      }> = [];
      
      let hasNextPage = true;
      let cursor: string | null = null;
      
      while (hasNextPage) {
        const data: CollectionsResponse = await shopifyGraphQL<CollectionsResponse>(
          session.shop, 
          accessToken, 
          COLLECTIONS_QUERY, 
          {
            first: 250,
            after: cursor,
          }
        );

        for (const edge of data.collections.edges) {
          allCollections.push({
            id: gidToId(edge.node.id),
            title: edge.node.title,
            handle: edge.node.handle,
            type: 'collection', // GraphQL doesn't distinguish custom vs smart in basic query
            image: edge.node.image?.url || null,
            productsCount: edge.node.productsCount.count,
          });
        }

        hasNextPage = data.collections.pageInfo.hasNextPage;
        cursor = data.collections.pageInfo.endCursor;
      }

      // Sort by title
      allCollections.sort((a, b) => a.title.localeCompare(b.title));

      res.json({
        collections: allCollections,
        shop: session.shop,
      });
    } catch (error) {
      console.error('Error fetching collections:', error);
      res.status(500).json({ error: 'Failed to fetch collections' });
    }
  });
});

/**
 * Search products via GraphQL
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
      // GraphQL search query - searches across multiple fields
      const searchQuery = `title:*${query}* OR vendor:*${query}* OR product_type:*${query}*`;
      
      const data = await shopifyGraphQL<{
        products: {
          edges: Array<{ node: GraphQLProductNode }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      }>(session.shop, accessToken, PRODUCTS_QUERY, {
        first: 50,
        after: null,
        query: searchQuery,
      });

      const products = data.products.edges.map((edge) => {
        const node = edge.node;
        return {
          id: gidToId(node.id),
          title: node.title,
          description: node.descriptionHtml?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
          vendor: node.vendor,
          productType: node.productType,
          handle: node.handle,
          status: node.status.toLowerCase(),
          featuredImage: node.featuredImage?.url || node.images.edges[0]?.node.url || null,
          images: node.images.edges.map((imgEdge) => ({
            id: gidToId(imgEdge.node.id),
            src: imgEdge.node.url,
            alt: imgEdge.node.altText,
          })),
          price: node.variants.edges[0]?.node.price || '0.00',
        };
      });

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
 * Note: /shop.json REST endpoint is NOT deprecated
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
    } catch (error: any) {
      console.error('Error fetching shop:', error);
      
      if (error.message === 'INVALID_ACCESS_TOKEN') {
        console.log('[shopifyGetShop] Deleting invalid token for shop:', session.shop);
        const db = admin.firestore();
        await db.collection('shopifyStores').doc(session.shop!).delete();
        
        res.status(401).json({ 
          error: 'Access token is invalid. Please reinstall the app.',
          code: 'INVALID_ACCESS_TOKEN'
        });
        return;
      }
      
      res.status(500).json({ error: 'Failed to fetch shop info' });
    }
  });
});

/**
 * Add an image to a product via GraphQL productCreateMedia mutation
 * Accepts either a URL or base64 image data
 */
export const shopifyAddProductImage = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Verify session
    const session = await verifyRequestSession(req);
    if (!session.valid || !session.shop) {
      res.status(401).json({ error: session.error || 'Unauthorized' });
      return;
    }

    const { productId, imageUrl, imageBase64, alt } = req.body;

    if (!productId) {
      res.status(400).json({ error: 'Missing product_id' });
      return;
    }

    if (!imageUrl && !imageBase64) {
      res.status(400).json({ error: 'Missing image data (provide imageUrl or imageBase64)' });
      return;
    }

    // Get access token
    const accessToken = await getShopAccessToken(session.shop);
    if (!accessToken) {
      res.status(401).json({ error: 'Shop access token not found' });
      return;
    }

    try {
      const productGid = idToGid(productId, 'Product');
      
      // For base64 images, we need to use staged uploads
      // For URL images, we can use originalSource directly
      let mediaInput: { originalSource: string; alt?: string; mediaContentType: string };
      
      if (imageUrl) {
        mediaInput = {
          originalSource: imageUrl,
          alt: alt || '',
          mediaContentType: 'IMAGE',
        };
      } else {
        // For base64, we need to first upload via staged uploads
        // This is a simplified approach - for large files, use stagedUploadsCreate
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        const mimeType = imageBase64.includes('data:') 
          ? imageBase64.split(';')[0].split(':')[1] 
          : 'image/jpeg';
        
        // Create a data URL that Shopify can fetch
        const dataUrl = `data:${mimeType};base64,${cleanBase64}`;
        
        mediaInput = {
          originalSource: dataUrl,
          alt: alt || '',
          mediaContentType: 'IMAGE',
        };
      }

      const data = await shopifyGraphQL<{
        productCreateMedia: {
          media: Array<{
            id: string;
            image?: {
              url: string;
              width: number;
              height: number;
              altText: string | null;
            };
          }>;
          mediaUserErrors: Array<{ field: string[]; message: string }>;
          product: { id: string } | null;
        };
      }>(session.shop, accessToken, CREATE_PRODUCT_MEDIA_MUTATION, {
        productId: productGid,
        media: [mediaInput],
      });

      if (data.productCreateMedia.mediaUserErrors.length > 0) {
        const errors = data.productCreateMedia.mediaUserErrors;
        console.error('Media creation errors:', errors);
        res.status(400).json({ 
          error: errors[0].message,
          details: errors,
        });
        return;
      }

      const createdMedia = data.productCreateMedia.media[0];
      
      if (!createdMedia || !createdMedia.image) {
        // Media was created but image might still be processing
        res.json({
          image: {
            id: createdMedia ? gidToId(createdMedia.id) : 0,
            productId: parseInt(productId, 10),
            src: createdMedia?.image?.url || '',
            width: createdMedia?.image?.width || 0,
            height: createdMedia?.image?.height || 0,
            alt: createdMedia?.image?.altText || alt || null,
            position: 1,
          },
          shop: session.shop,
          status: 'processing', // Indicate media might still be processing
        });
        return;
      }

      res.json({
        image: {
          id: gidToId(createdMedia.id),
          productId: parseInt(productId, 10),
          src: createdMedia.image.url,
          width: createdMedia.image.width,
          height: createdMedia.image.height,
          alt: createdMedia.image.altText,
          position: 1,
        },
        shop: session.shop,
      });
    } catch (error: any) {
      console.error('Error adding product image:', error);
      res.status(500).json({ error: 'Failed to add product image' });
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
