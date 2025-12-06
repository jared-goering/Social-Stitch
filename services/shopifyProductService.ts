/**
 * Shopify Product Service
 *
 * Frontend service for fetching products from the Shopify API
 * via our Firebase Functions proxy. Uses session tokens for authentication.
 */

import { shopifyConfig } from '../shopify.config';

// Types for Shopify products
export interface ShopifyProductImage {
  id: number;
  src: string;
  width?: number;
  height?: number;
  alt: string | null;
  position?: number;
}

export interface ShopifyProductVariant {
  id: number;
  title: string;
  price: string;
  sku: string;
  inventoryQuantity: number;
  imageId?: number | null;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  handle: string;
  status: string;
  tags: string[];
  featuredImage: string | null;
  images: ShopifyProductImage[];
  variants: ShopifyProductVariant[];
  price?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyCollection {
  id: number;
  title: string;
  handle: string;
  type: 'custom' | 'smart';
  image: string | null;
  productsCount?: number;
}

export interface ShopInfo {
  domain: string;
  myshopifyDomain: string;
  name: string;
  email: string;
  shopOwner: string;
  currency: string;
  timezone: string;
  ianaTimezone: string;
  planName: string;
  country: string;
}

// Get the functions URL from environment
const getFunctionsUrl = () => {
  return import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || '';
};

// Session token storage
let currentSessionToken: string | null = null;

// Shop domain storage (for OAuth redirect)
let currentShopDomain: string | null = null;

/**
 * Set the current shop domain (for OAuth redirects)
 */
export function setShopDomain(shop: string | null) {
  currentShopDomain = shop;
}

/**
 * Get the current shop domain
 */
export function getShopDomain(): string | null {
  return currentShopDomain;
}

/**
 * Check if an error indicates the shop needs to complete OAuth
 */
export function isOAuthRequired(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('access token not found') || 
         message.includes('shop has not installed') ||
         message.includes('invalid') ||
         message.includes('reinstall');
}

// Store App Bridge app instance for redirects
let appBridgeApp: any = null;

/**
 * Set the App Bridge app instance for redirects
 */
export function setAppBridgeApp(app: any): void {
  appBridgeApp = app;
}

/**
 * Redirect to OAuth flow to install/reinstall the app
 */
export function redirectToOAuth(shop?: string): void {
  const shopDomain = shop || currentShopDomain;
  if (!shopDomain) {
    console.error('[shopifyProductService] Cannot redirect to OAuth: no shop domain');
    return;
  }
  
  const functionsUrl = getFunctionsUrl();
  if (!functionsUrl) {
    console.error('[shopifyProductService] Cannot redirect to OAuth: no functions URL');
    return;
  }
  
  const oauthUrl = `${functionsUrl}/shopifyAuthStart?shop=${encodeURIComponent(shopDomain)}`;
  console.log('[shopifyProductService] Redirecting to OAuth:', oauthUrl);
  
  // For embedded apps, use App Bridge Redirect
  if (appBridgeApp) {
    try {
      // Use App Bridge redirect for embedded apps
      const { Redirect } = require('@shopify/app-bridge/actions');
      const redirect = Redirect.create(appBridgeApp);
      redirect.dispatch(Redirect.Action.REMOTE, oauthUrl);
      return;
    } catch (e) {
      console.error('[shopifyProductService] App Bridge redirect failed:', e);
    }
  }
  
  // Fallback: try to break out of iframe
  if (window.top !== window.self) {
    // We're in an iframe - try to redirect the top frame
    try {
      window.top!.location.href = oauthUrl;
    } catch (e) {
      // If that fails, open in new window
      window.open(oauthUrl, '_top');
    }
  } else {
    window.location.href = oauthUrl;
  }
}

/**
 * Set the session token for API requests
 * Called by the ShopifyProvider after App Bridge authentication
 */
export function setSessionToken(token: string | null) {
  currentSessionToken = token;
}

/**
 * Get the current session token
 */
export function getSessionToken(): string | null {
  return currentSessionToken;
}

/**
 * Make an authenticated request to our Shopify API proxy
 */
async function shopifyApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!currentSessionToken) {
    throw new Error('No session token available. Please authenticate with Shopify.');
  }

  const functionsUrl = getFunctionsUrl();
  if (!functionsUrl) {
    throw new Error('Firebase Functions URL not configured');
  }

  const url = `${functionsUrl}/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${currentSessionToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch products from the merchant's Shopify store
 */
export async function fetchProducts(options: {
  limit?: number;
  pageInfo?: string;
  productType?: string;
  vendor?: string;
  status?: string;
  collectionId?: string;
} = {}): Promise<{ products: ShopifyProduct[]; shop: string; pageInfo?: { hasNextPage: boolean; endCursor?: string } }> {
  const params = new URLSearchParams();

  if (options.limit) params.set('limit', options.limit.toString());
  if (options.pageInfo) params.set('page_info', options.pageInfo);
  if (options.productType) params.set('product_type', options.productType);
  if (options.vendor) params.set('vendor', options.vendor);
  if (options.status) params.set('status', options.status);
  if (options.collectionId) params.set('collection_id', options.collectionId);

  const queryString = params.toString();
  const endpoint = `shopifyGetProducts${queryString ? `?${queryString}` : ''}`;

  return shopifyApiRequest<{ products: ShopifyProduct[]; shop: string; pageInfo?: { hasNextPage: boolean; endCursor?: string } }>(endpoint);
}

/**
 * Fetch all products (handles pagination automatically)
 */
export async function fetchAllProducts(options: {
  collectionId?: string;
  onProgress?: (loaded: number) => void;
} = {}): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let pageInfo: string | undefined;
  let hasMore = true;
  
  while (hasMore) {
    const result = await fetchProducts({
      limit: 250, // Shopify max
      pageInfo,
      collectionId: options.collectionId,
    });
    
    allProducts.push(...result.products);
    options.onProgress?.(allProducts.length);
    
    // Check if there are more pages
    if (result.pageInfo?.hasNextPage && result.pageInfo.endCursor) {
      pageInfo = result.pageInfo.endCursor;
    } else if (result.products.length === 250) {
      // Fallback: if we got exactly 250, there might be more
      // But since we don't have pageInfo, we'll stop here
      hasMore = false;
    } else {
      hasMore = false;
    }
  }
  
  return allProducts;
}

/**
 * Fetch a single product by ID
 */
export async function fetchProduct(productId: number): Promise<{
  product: ShopifyProduct;
  shop: string;
}> {
  return shopifyApiRequest<{ product: ShopifyProduct; shop: string }>(
    `shopifyGetProduct?id=${productId}`
  );
}

/**
 * Fetch product images
 */
export async function fetchProductImages(productId: number): Promise<{
  images: ShopifyProductImage[];
  shop: string;
}> {
  return shopifyApiRequest<{ images: ShopifyProductImage[]; shop: string }>(
    `shopifyGetProductImages?product_id=${productId}`
  );
}

/**
 * Fetch collections
 */
export async function fetchCollections(): Promise<{
  collections: ShopifyCollection[];
  shop: string;
}> {
  return shopifyApiRequest<{ collections: ShopifyCollection[]; shop: string }>(
    'shopifyGetCollections'
  );
}

/**
 * Search products
 */
export async function searchProducts(query: string): Promise<{
  products: ShopifyProduct[];
  query: string;
  shop: string;
}> {
  return shopifyApiRequest<{ products: ShopifyProduct[]; query: string; shop: string }>(
    `shopifySearchProducts?q=${encodeURIComponent(query)}`
  );
}

/**
 * Fetch shop information
 */
export async function fetchShopInfo(): Promise<{ shop: ShopInfo }> {
  return shopifyApiRequest<{ shop: ShopInfo }>('shopifyGetShop');
}

/**
 * Get proxied image URL (to avoid CORS issues)
 */
export function getProxiedImageUrl(imageUrl: string): string {
  const functionsUrl = getFunctionsUrl();
  if (!functionsUrl || !imageUrl) return imageUrl;

  // Only proxy Shopify CDN images
  if (!imageUrl.includes('cdn.shopify.com')) return imageUrl;

  return `${functionsUrl}/shopifyProxyImage?url=${encodeURIComponent(imageUrl)}`;
}

/**
 * Convert Shopify image URL to different size
 * Shopify CDN supports image resizing via URL parameters
 */
export function getResizedImageUrl(
  imageUrl: string,
  size: 'pico' | 'icon' | 'thumb' | 'small' | 'compact' | 'medium' | 'large' | 'grande' | '1024x1024' | '2048x2048' | 'master'
): string {
  if (!imageUrl) return '';

  // Insert size before file extension
  const extensionMatch = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i);
  if (!extensionMatch) return imageUrl;

  const ext = extensionMatch[1];
  const query = extensionMatch[2] || '';

  return imageUrl.replace(
    new RegExp(`\\.${ext}(\\?.*)?$`, 'i'),
    `_${size}.${ext}${query}`
  );
}

/**
 * Convert image to base64 for mockup generation
 */
export async function imageUrlToBase64(imageUrl: string): Promise<string> {
  // Use proxied URL to avoid CORS
  const url = getProxiedImageUrl(imageUrl);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch image');
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Local cache for products
const productCache = new Map<string, { data: ShopifyProduct[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch products with caching
 */
export async function fetchProductsCached(options: {
  limit?: number;
  collectionId?: string;
  forceRefresh?: boolean;
  loadAll?: boolean;
  onProgress?: (loaded: number) => void;
} = {}): Promise<ShopifyProduct[]> {
  const cacheKey = `products_${options.collectionId || 'all'}_${options.loadAll ? 'all' : options.limit || 250}`;
  const cached = productCache.get(cacheKey);

  if (cached && !options.forceRefresh && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  let products: ShopifyProduct[];
  
  if (options.loadAll) {
    products = await fetchAllProducts({
      collectionId: options.collectionId,
      onProgress: options.onProgress,
    });
  } else {
    const result = await fetchProducts({
      limit: options.limit || 250, // Increased default from 50 to 250
      collectionId: options.collectionId,
    });
    products = result.products;
  }

  productCache.set(cacheKey, {
    data: products,
    timestamp: Date.now(),
  });

  return products;
}

/**
 * Clear product cache
 */
export function clearProductCache() {
  productCache.clear();
}

