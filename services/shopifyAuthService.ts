/**
 * Shopify Authentication Service
 * 
 * Handles OAuth flow for Shopify merchants
 * This replaces Firebase Auth when running as a Shopify app
 */

import { shopifyConfig } from '../shopify.config';

export interface ShopifySession {
  shop: string;
  accessToken: string;
  scope: string;
  expiresAt?: number;
}

/**
 * Initialize Shopify OAuth flow
 * Redirects merchant to Shopify authorization page
 */
export function initiateShopifyAuth(shop: string) {
  const { apiKey, scopes, redirectUri } = shopifyConfig;
  
  if (!apiKey) {
    throw new Error('Shopify API key not configured');
  }
  
  // Build OAuth URL
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', apiKey);
  authUrl.searchParams.set('scope', scopes.join(','));
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', generateState());
  
  // Redirect to Shopify
  window.location.href = authUrl.toString();
}

/**
 * Handle OAuth callback from Shopify
 * Exchange authorization code for access token
 */
export async function handleShopifyCallback(
  code: string,
  shop: string,
  state: string
): Promise<ShopifySession> {
  // Verify state parameter to prevent CSRF
  const savedState = sessionStorage.getItem('shopify_oauth_state');
  if (state !== savedState) {
    throw new Error('Invalid OAuth state parameter');
  }
  
  // In a real implementation, this would call your backend
  // to securely exchange the code for an access token
  // For now, this is a placeholder
  const response = await fetch('/api/shopify/auth/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, shop }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange authorization code');
  }
  
  const session: ShopifySession = await response.json();
  
  // Store session
  sessionStorage.setItem('shopify_session', JSON.stringify(session));
  
  return session;
}

/**
 * Get current Shopify session
 */
export function getShopifySession(): ShopifySession | null {
  const stored = sessionStorage.getItem('shopify_session');
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear Shopify session (logout)
 */
export function clearShopifySession() {
  sessionStorage.removeItem('shopify_session');
  sessionStorage.removeItem('shopify_oauth_state');
}

/**
 * Check if merchant is authenticated
 */
export function isShopifyAuthenticated(): boolean {
  const session = getShopifySession();
  if (!session) return false;
  
  // Check if token is expired
  if (session.expiresAt && Date.now() > session.expiresAt) {
    clearShopifySession();
    return false;
  }
  
  return true;
}

/**
 * Generate random state for OAuth CSRF protection
 */
function generateState(): string {
  const state = Math.random().toString(36).substring(2);
  sessionStorage.setItem('shopify_oauth_state', state);
  return state;
}

/**
 * Extract shop domain from URL
 */
export function getShopFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('shop');
}

