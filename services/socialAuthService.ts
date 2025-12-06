/**
 * Social Authentication Service
 * Handles OAuth flows and posting to social platforms via Firebase Functions
 * Works in both standalone (Firebase Auth) and Shopify embedded modes
 */

import { getFunctionUrl, auth } from './firebaseConfig';
import { SocialPlatform } from '../types';

// Store the Shopify shop domain for Shopify mode
let shopifyShopDomain: string | null = null;

// Try to restore from sessionStorage on load
try {
  const stored = sessionStorage.getItem('shopify_shop_domain');
  if (stored) {
    shopifyShopDomain = stored;
  }
} catch {
  // sessionStorage not available
}

/**
 * Set the Shopify shop domain (called by ShopifyProvider)
 */
export function setShopifyShop(shop: string | null) {
  shopifyShopDomain = shop;
  // Persist to sessionStorage for page navigations
  try {
    if (shop) {
      sessionStorage.setItem('shopify_shop_domain', shop);
    } else {
      sessionStorage.removeItem('shopify_shop_domain');
    }
  } catch {
    // sessionStorage not available
  }
}

/**
 * Check if we're running in Shopify mode
 */
function isShopifyMode(): boolean {
  // Check env var first
  if (import.meta.env.VITE_APP_MODE === 'shopify') {
    return true;
  }
  // Check if we're in a Shopify iframe (has shop or host param)
  const params = new URLSearchParams(window.location.search);
  if (params.get('shop') || params.get('host')) {
    return true;
  }
  // Check if we're embedded in Shopify admin
  if (window.location.hostname.includes('myshopify.com') || 
      window.location.ancestorOrigins?.contains('https://admin.shopify.com')) {
    return true;
  }
  // Check if we have a stored shop domain
  if (shopifyShopDomain) {
    return true;
  }
  return false;
}

/**
 * Get the current session identifier
 * Returns Firebase user ID in standalone mode, or shop domain in Shopify mode
 */
function getSessionId(): string {
  // Try to get shop from stored value or URL
  const params = new URLSearchParams(window.location.search);
  const shopFromUrl = params.get('shop');
  
  if (shopFromUrl) {
    shopifyShopDomain = shopFromUrl;
    try {
      sessionStorage.setItem('shopify_shop_domain', shopFromUrl);
    } catch { /* ignore */ }
  }
  
  // If we have a shop domain (from URL, sessionStorage, or previously set), use it
  if (shopifyShopDomain) {
    console.log('[SocialAuth] Using shop domain:', shopifyShopDomain);
    return shopifyShopDomain;
  }
  
  // Try to get from sessionStorage
  try {
    const stored = sessionStorage.getItem('shopify_shop_domain');
    if (stored) {
      shopifyShopDomain = stored;
      console.log('[SocialAuth] Using stored shop domain:', stored);
      return stored;
    }
  } catch { /* ignore */ }
  
  // Check if we're in Shopify mode without a shop domain
  if (isShopifyMode()) {
    console.error('[SocialAuth] In Shopify mode but no shop domain found');
    throw new Error('No Shopify shop context. Please access through Shopify admin.');
  }
  
  // Standalone mode - use Firebase Auth
  const user = auth.currentUser;
  if (!user) {
    console.error('[SocialAuth] No Firebase user and not in Shopify mode');
    throw new Error('No authenticated user. Please sign in.');
  }
  console.log('[SocialAuth] Using Firebase user:', user.uid);
  return user.uid;
}

export interface ConnectedAccount {
  connected: boolean;
  username: string;
  pageId?: string;
  pageName?: string;
}

export type AccountsMap = Record<SocialPlatform, ConnectedAccount>;

const DEFAULT_ACCOUNTS: AccountsMap = {
  facebook: { connected: false, username: '' },
  instagram: { connected: false, username: '' }
};

/**
 * Open OAuth popup window for connecting a social account
 */
export function startOAuthFlow(platform: SocialPlatform): Promise<boolean> {
  return new Promise((resolve) => {
    const sessionId = getSessionId();
    // Include current origin so the callback redirects back to the right place
    const redirectUrl = encodeURIComponent(window.location.origin);
    const authUrl = `${getFunctionUrl('authStart')}?sessionId=${sessionId}&platform=${platform}&redirectUrl=${redirectUrl}`;
    
    // Calculate popup position (centered)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      'SocialStitch OAuth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      console.error('Popup blocked. Please allow popups for this site.');
      resolve(false);
      return;
    }

    let authDetected = false;
    let lastKnownUrl = '';

    // Poll for popup close and check URL params
    const pollTimer = setInterval(() => {
      try {
        // Try to read popup location (will fail if on different origin)
        const popupUrl = popup.location.href;
        
        // Only process if URL has changed and contains our origin
        if (popupUrl && popupUrl !== lastKnownUrl && popupUrl.includes(window.location.origin)) {
          lastKnownUrl = popupUrl;
          
          const popupParams = new URLSearchParams(new URL(popupUrl).search);
          if (popupParams.get('auth_success')) {
            authDetected = true;
            clearInterval(pollTimer);
            popup.close();
            resolve(true);
            return;
          } else if (popupParams.get('auth_error')) {
            const error = popupParams.get('auth_error');
            console.error('OAuth error:', error);
            authDetected = true;
            clearInterval(pollTimer);
            popup.close();
            resolve(false);
            return;
          }
        }
      } catch {
        // Cross-origin error - popup is still on Meta's domain, keep waiting
      }
      
      // Check if popup is closed
      if (popup.closed && !authDetected) {
        clearInterval(pollTimer);
        // Give it one more second in case there's a race condition
        setTimeout(() => {
          if (!authDetected) {
            resolve(false);
          }
        }, 1000);
      }
    }, 300); // Poll more frequently

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!authDetected) {
        clearInterval(pollTimer);
        if (!popup.closed) {
          popup.close();
        }
        resolve(false);
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Fetch connected accounts from Firebase
 */
export async function getConnectedAccounts(): Promise<AccountsMap> {
  try {
    const sessionId = getSessionId();
    const response = await fetch(
      `${getFunctionUrl('getConnectedAccounts')}?sessionId=${sessionId}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch accounts');
    }

    const data = await response.json();
    
    return {
      facebook: data.accounts?.facebook || DEFAULT_ACCOUNTS.facebook,
      instagram: data.accounts?.instagram || DEFAULT_ACCOUNTS.instagram
    };
  } catch (error) {
    console.error('Error fetching connected accounts:', error);
    return DEFAULT_ACCOUNTS;
  }
}

/**
 * Disconnect a social account
 */
export async function disconnectAccount(platform: SocialPlatform): Promise<boolean> {
  try {
    const sessionId = getSessionId();
    const response = await fetch(getFunctionUrl('disconnectAccount'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        platform
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Error disconnecting account:', error);
    return false;
  }
}

/**
 * Convert image URL to base64
 */
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Post content to a social platform (supports single image or carousel)
 */
export async function postToSocial(
  platform: SocialPlatform,
  imageUrls: string | string[],
  caption: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Normalize to array
    const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    const isCarousel = urls.length > 1;
    
    // Convert images to base64 if they're local/blob URLs
    const imagesBase64: string[] = [];
    for (const url of urls) {
      if (url.startsWith('blob:') || url.startsWith('data:') || url.includes('localhost')) {
        console.log('Converting image to base64 for upload...');
        const base64 = await imageUrlToBase64(url);
        imagesBase64.push(base64);
      } else {
        imagesBase64.push(url);
      }
    }
    
    // Choose endpoint based on carousel vs single
    let functionName: string;
    if (isCarousel) {
      functionName = platform === 'facebook' ? 'postCarouselToFacebook' : 'postCarouselToInstagram';
    } else {
      functionName = platform === 'facebook' ? 'postToFacebook' : 'postToInstagram';
    }
    
    // Build request body
    const sessionId = getSessionId();
    const body: Record<string, unknown> = {
      sessionId,
      caption
    };
    
    if (isCarousel) {
      // For carousel, send array of images
      body.imagesBase64 = imagesBase64;
    } else {
      // For single image, use existing format for backwards compatibility
      const singleImage = imagesBase64[0];
      if (singleImage.startsWith('data:') || singleImage.length > 500) {
        body.imageBase64 = singleImage;
      } else {
        body.imageUrl = singleImage;
      }
    }
    
    const response = await fetch(getFunctionUrl(functionName), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to post' };
    }

    return { success: true, postId: data.postId };
  } catch (error) {
    console.error('Error posting to social:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Check if we're running in a popup window
 */
export function isPopupWindow(): boolean {
  return window.opener !== null && window.opener !== window;
}

/**
 * Listen for auth result via URL params (called after popup redirect)
 */
export function checkAuthResult(): { success: boolean; platform?: string; error?: string } {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('auth_success');
  const error = urlParams.get('auth_error');
  
  // Don't clean up URL params if we're in a popup - the parent window needs to read them
  if (!isPopupWindow() && (success || error)) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (success) {
    return { success: true, platform: success };
  }
  
  if (error) {
    return { success: false, error: decodeURIComponent(error) };
  }

  return { success: false };
}

