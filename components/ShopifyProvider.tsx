/**
 * Shopify App Bridge Provider
 *
 * Provides Shopify App Bridge context for the embedded app experience.
 * 
 * MODERN APPROACH: Uses ONLY the CDN-loaded App Bridge (window.shopify)
 * No npm AppBridgeProvider - that was causing conflicts with the CDN version.
 * 
 * IMPORTANT: When a user installs from App Store, they must complete OAuth first.
 * This provider checks if OAuth is complete and redirects if needed.
 * 
 * SESSION TOKEN STRATEGY:
 * - Session tokens are fetched per-request via window.shopify.idToken()
 * - The CDN handles everything - no need for npm packages
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { shopifyConfig } from '../shopify.config';
import { setShopifyShop } from '../services/socialAuthService';
import { setShopDomain, redirectToOAuth } from '../services/shopifyProductService';

// Type for global Shopify object from CDN
declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
    };
    __SHOPIFY_API_KEY__?: string;
  }
}

// Firebase Functions base URL
const FUNCTIONS_URL = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://us-central1-social-stitch.cloudfunctions.net';

// Shopify context types
interface ShopifyContextValue {
  shop: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  host: string | null;
  refreshToken: () => Promise<void>;
  /** Trigger OAuth redirect to reinstall/reconnect the app */
  triggerOAuthRedirect: () => void;
}

const ShopifyContext = createContext<ShopifyContextValue>({
  shop: null,
  isAuthenticated: false,
  isLoading: true,
  host: null,
  refreshToken: async () => {},
  triggerOAuthRedirect: () => {},
});

/**
 * Hook to access Shopify context
 */
export function useShopifyContext() {
  return useContext(ShopifyContext);
}

/**
 * Inner component that sets up shop context
 * Uses ONLY the CDN's window.shopify - no npm AppBridgeProvider needed
 * 
 * Session tokens are fetched per-request via window.shopify.idToken()
 */
function ShopContextProvider({ 
  children, 
  shop,
  host
}: { 
  children: React.ReactNode; 
  shop: string | null;
  host: string | null;
}) {
  const [isLoading, setIsLoading] = useState(true);

  // Set the shop domain for API requests
  useEffect(() => {
    if (shop) {
      setShopDomain(shop);
    }
    
    // Log CDN availability
    console.log('[ShopContextProvider] Global shopify CDN available:', !!window.shopify);
    console.log('[ShopContextProvider] Shop domain set:', shop);
    console.log('[ShopContextProvider] Host available:', !!host);
    
    // Brief delay to ensure CDN is ready, then proceed
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [shop, host]);

  // Handler to trigger OAuth redirect for app reinstallation
  const triggerOAuthRedirect = useCallback(() => {
    if (shop) {
      console.log('[ShopContextProvider] Triggering OAuth redirect for shop:', shop);
      redirectToOAuth(shop);
    } else {
      console.error('[ShopContextProvider] Cannot trigger OAuth redirect: no shop domain');
    }
  }, [shop]);

  // Always authenticated since we have backend fallback auth
  const contextValue: ShopifyContextValue = {
    shop,
    isAuthenticated: true, // Backend auth always works
    isLoading,
    host, // Passed from props
    refreshToken: async () => { /* Session tokens fetched per-request now */ },
    triggerOAuthRedirect,
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f6f6f7',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e2e8f0',
              borderTop: '3px solid #5c6ac4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: '#637381' }}>Authenticating with Shopify...</p>
        </div>
      </div>
    );
  }

  return (
    <ShopifyContext.Provider value={contextValue}>
      {children}
    </ShopifyContext.Provider>
  );
}

interface ShopifyProviderProps {
  children: React.ReactNode;
}

/**
 * Decode shop domain from Shopify host parameter
 * The host param is base64 encoded and contains the shop domain
 */
function decodeShopFromHost(host: string): string | null {
  try {
    const decoded = atob(host);
    // Format is typically "shop-name.myshopify.com/admin"
    const match = decoded.match(/([^\/]+\.myshopify\.com)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extract shop and host from URL params or sessionStorage
 */
function getShopifyParams() {
  const params = new URLSearchParams(window.location.search);
  let shop = params.get('shop');
  let host = params.get('host');
  
  // If not in URL, try sessionStorage
  if (!shop) {
    try {
      shop = sessionStorage.getItem('shopify_shop_domain');
    } catch { /* ignore */ }
  }
  if (!host) {
    try {
      host = sessionStorage.getItem('shopify_host');
    } catch { /* ignore */ }
  }
  
  // If we have host but no shop, try to decode shop from host
  if (!shop && host) {
    shop = decodeShopFromHost(host);
    console.log('[ShopifyProvider] Decoded shop from host:', shop);
  }
  
  // Store in sessionStorage for persistence
  if (shop) {
    try {
      sessionStorage.setItem('shopify_shop_domain', shop);
    } catch { /* ignore */ }
  }
  if (host) {
    try {
      sessionStorage.setItem('shopify_host', host);
    } catch { /* ignore */ }
  }
  
  console.log('[ShopifyProvider] shop:', shop, 'host:', host ? 'present' : 'missing');
  
  return { shop, host };
}

/**
 * Result of installation check
 */
interface InstallCheckResult {
  installed: boolean;
  reason?: string;
}

/**
 * Check if the store has completed OAuth installation
 * Returns both installed status and reason if not installed
 */
async function checkStoreInstallation(shop: string): Promise<InstallCheckResult> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/shopifyCheckInstall?shop=${encodeURIComponent(shop)}`);
    if (!response.ok) {
      console.error('[ShopifyProvider] Failed to check installation status');
      return { installed: false };
    }
    const data = await response.json();
    console.log('[ShopifyProvider] Installation check result:', data);
    return { 
      installed: data.installed === true,
      reason: data.reason,
    };
  } catch (error) {
    console.error('[ShopifyProvider] Error checking installation:', error);
    return { installed: false };
  }
}

/**
 * Get the OAuth URL for a shop
 */
function getOAuthUrl(shop: string): string {
  return `${FUNCTIONS_URL}/shopifyAuthStart?shop=${encodeURIComponent(shop)}`;
}

/**
 * Provides Shopify App Bridge context when running as embedded app
 * Falls through to children when not in Shopify mode
 */
export function ShopifyProvider({ children }: ShopifyProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [installationChecked, setInstallationChecked] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { shop, host } = getShopifyParams();

  useEffect(() => {
    // Set the shop domain for social auth service
    if (shop) {
      setShopifyShop(shop);
    }
  }, [shop]);

  // Check if the store has completed OAuth
  useEffect(() => {
    if (!shopifyConfig.isEmbedded || !shop) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const checkInstallation = async () => {
      console.log('[ShopifyProvider] Checking if shop has completed OAuth:', shop);
      
      const result = await checkStoreInstallation(shop);
      
      if (!mounted) return;

      setIsInstalled(result.installed);
      setInstallationChecked(true);

      if (!result.installed) {
        // Check if this is a token expiration/invalidation - auto-redirect to OAuth
        const shouldAutoRedirect = result.reason === 'token_expired' || 
                                    result.reason === 'token_invalid' ||
                                    result.reason === 'different_app';
        
        if (shouldAutoRedirect) {
          console.log(`[ShopifyProvider] Token issue detected (${result.reason}), auto-redirecting to OAuth`);
          // Redirect to OAuth immediately to get fresh token
          redirectToOAuth(shop);
          return; // Don't update state - we're redirecting
        }
        
        console.log('[ShopifyProvider] Shop not installed, showing connect screen');
        setIsLoading(false); // Stop loading to show connect screen
      } else {
        console.log('[ShopifyProvider] Shop is installed, proceeding with App Bridge');
        setIsLoading(false);
      }
    };

    checkInstallation();

    return () => {
      mounted = false;
    };
  }, [shop]);

  // If not in Shopify mode, just render children directly
  if (!shopifyConfig.isEmbedded) {
    return (
      <ShopifyContext.Provider value={{ 
        shop: null, 
        isAuthenticated: false, 
        isLoading: false, 
        host: null, 
        refreshToken: async () => {},
        triggerOAuthRedirect: () => {},
      }}>
        {children}
      </ShopifyContext.Provider>
    );
  }

  // Show loading/checking state
  if (isLoading || !installationChecked) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f6f6f7',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e2e8f0',
              borderTop: '3px solid #5c6ac4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: '#637381' }}>
            {!installationChecked ? 'Checking installation...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // If not installed, show connect button
  // We can't auto-redirect from iframe due to security restrictions
  if (!isInstalled && shop) {
    const oauthUrl = getOAuthUrl(shop);
    
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f6f6f7',
        }}
      >
        <div 
          style={{ 
            textAlign: 'center',
            maxWidth: '400px',
            padding: '32px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #5c6ac4 0%, #202e78 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h2 style={{ color: '#111827', marginBottom: '8px', fontSize: '20px', fontWeight: '600' }}>
            Welcome to SocialStitch
          </h2>
          <p style={{ color: '#637381', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
            To get started, we need to connect to your store. Click the button below to authorize the app.
          </p>
          <a
            href={oauthUrl}
            target="_top"
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #5c6ac4 0%, #202e78 100%)',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 2px 8px rgba(92, 106, 196, 0.3)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(92, 106, 196, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(92, 106, 196, 0.3)';
            }}
          >
            Connect Store
          </a>
          <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '16px' }}>
            This will request permission to access your products
          </p>
        </div>
      </div>
    );
  }

  // Check if we have the required host parameter
  if (!host) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f6f6f7',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: '400px',
            padding: '24px',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <h2 style={{ color: '#111827', marginBottom: '8px' }}>Access Error</h2>
          <p style={{ color: '#637381', fontSize: '14px' }}>
            Please access this app through your Shopify admin panel.
          </p>
        </div>
      </div>
    );
  }

  // Log config (CDN handles App Bridge initialization via meta tag)
  console.log('[ShopifyProvider] Using CDN App Bridge (no npm provider)');
  console.log('[ShopifyProvider] Config:', { 
    apiKey: shopifyConfig.apiKey?.substring(0, 8) + '...', 
    hostPresent: !!host,
    hostLength: host?.length,
    cdnAvailable: !!window.shopify
  });

  // Use only CDN - no AppBridgeProvider from npm
  return (
    <ShopContextProvider shop={shop} host={host}>
      {children}
    </ShopContextProvider>
  );
}

/**
 * Hook to check if running in Shopify embedded mode
 */
export function useIsShopifyEmbedded() {
  return shopifyConfig.isEmbedded;
}

// Add CSS animation for loading spinner
if (typeof document !== 'undefined') {
  const styleId = 'shopify-provider-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}
