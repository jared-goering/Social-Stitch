/**
 * Shopify App Bridge Provider
 *
 * Provides Shopify App Bridge context for the embedded app experience.
 * App Bridge handles authentication automatically for embedded apps.
 * 
 * IMPORTANT: When a user installs from App Store, they must complete OAuth first.
 * This provider checks if OAuth is complete and redirects if needed.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Provider as AppBridgeProvider, useAppBridge } from '@shopify/app-bridge-react';
import { getSessionToken } from '@shopify/app-bridge-utils';
import { shopifyConfig } from '../shopify.config';
import { setShopifyShop } from '../services/socialAuthService';
import { setSessionToken, setShopDomain, setAppBridgeApp, redirectToOAuth, isOAuthRequired } from '../services/shopifyProductService';

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
 * Inner component that handles session token fetching
 * Must be inside AppBridgeProvider to use useAppBridge hook
 */
function SessionTokenProvider({ 
  children, 
  shop 
}: { 
  children: React.ReactNode; 
  shop: string | null;
}) {
  const app = useAppBridge();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Set the shop domain and app bridge for OAuth redirects
  useEffect(() => {
    if (shop) {
      setShopDomain(shop);
    }
    // Set the App Bridge instance for redirects
    setAppBridgeApp(app);
  }, [shop, app]);

  const fetchSessionToken = useCallback(async () => {
    try {
      console.log('[SessionTokenProvider] Fetching session token...');
      console.log('[SessionTokenProvider] App Bridge state:', app ? 'initialized' : 'null');
      
      // Add timeout to prevent hanging forever
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Session token fetch timed out after 10s')), 10000);
      });
      
      const token = await Promise.race([
        getSessionToken(app),
        timeoutPromise
      ]);
      
      console.log('[SessionTokenProvider] Session token obtained:', token ? 'yes' : 'no');
      setSessionToken(token);
      setIsAuthenticated(true);
      return token;
    } catch (error) {
      console.error('[SessionTokenProvider] Failed to get session token:', error);
      setSessionToken(null);
      setIsAuthenticated(false);
      throw error;
    }
  }, [app]);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout;

    const initializeToken = async () => {
      try {
        await fetchSessionToken();
        console.log('[SessionTokenProvider] Session token initialized successfully');
      } catch (error) {
        console.error('[SessionTokenProvider] Initial token fetch failed:', error);
        // Even if session token fails, proceed with the app
        // We can still make API calls using the access token stored on the backend
        console.log('[SessionTokenProvider] Proceeding without session token - API calls will use backend access token');
        setIsAuthenticated(true); // Allow app to load
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeToken();

    // Refresh token every 50 seconds (tokens expire after ~60 seconds)
    refreshInterval = setInterval(async () => {
      try {
        await fetchSessionToken();
      } catch (error) {
        console.error('[SessionTokenProvider] Token refresh failed:', error);
        // Don't change authentication state on refresh failure
      }
    }, 50000);

    return () => {
      mounted = false;
      clearInterval(refreshInterval);
    };
  }, [fetchSessionToken]);

  // Get host from sessionStorage since we're inside the provider
  const host = (() => {
    try {
      return sessionStorage.getItem('shopify_host');
    } catch {
      return null;
    }
  })();

  // Handler to trigger OAuth redirect for app reinstallation
  const triggerOAuthRedirect = useCallback(() => {
    if (shop) {
      console.log('[SessionTokenProvider] Triggering OAuth redirect for shop:', shop);
      redirectToOAuth(shop);
    } else {
      console.error('[SessionTokenProvider] Cannot trigger OAuth redirect: no shop domain');
    }
  }, [shop]);

  const contextValue: ShopifyContextValue = {
    shop,
    isAuthenticated,
    isLoading,
    host,
    refreshToken: async () => { await fetchSessionToken(); },
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
 * Check if the store has completed OAuth installation
 */
async function checkStoreInstallation(shop: string): Promise<boolean> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/shopifyCheckInstall?shop=${encodeURIComponent(shop)}`);
    if (!response.ok) {
      console.error('[ShopifyProvider] Failed to check installation status');
      return false;
    }
    const data = await response.json();
    console.log('[ShopifyProvider] Installation check result:', data);
    return data.installed === true;
  } catch (error) {
    console.error('[ShopifyProvider] Error checking installation:', error);
    return false;
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
      
      const installed = await checkStoreInstallation(shop);
      
      if (!mounted) return;

      setIsInstalled(installed);
      setInstallationChecked(true);

      if (!installed) {
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

  // App Bridge config for embedded apps
  // Note: forceRedirect removed as it can cause issues with session tokens
  const config = {
    apiKey: shopifyConfig.apiKey,
    host: host,
  };
  
  console.log('[ShopifyProvider] App Bridge config:', { 
    apiKey: shopifyConfig.apiKey?.substring(0, 8) + '...', 
    hostPresent: !!host,
    hostLength: host?.length 
  });

  return (
    <AppBridgeProvider config={config}>
      <SessionTokenProvider shop={shop}>
        {children}
      </SessionTokenProvider>
    </AppBridgeProvider>
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
