/**
 * Shopify App Bridge Provider
 *
 * Provides Shopify App Bridge context for the embedded app experience.
 * App Bridge handles authentication automatically for embedded apps.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { shopifyConfig } from '../shopify.config';
import { setShopifyShop } from '../services/socialAuthService';

// Shopify context types
interface ShopifyContextValue {
  shop: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  host: string | null;
}

const ShopifyContext = createContext<ShopifyContextValue>({
  shop: null,
  isAuthenticated: false,
  isLoading: true,
  host: null,
});

/**
 * Hook to access Shopify context
 */
export function useShopifyContext() {
  return useContext(ShopifyContext);
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
 * Provides Shopify App Bridge context when running as embedded app
 * Falls through to children when not in Shopify mode
 */
export function ShopifyProvider({ children }: ShopifyProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { shop, host } = getShopifyParams();

  useEffect(() => {
    // Set the shop domain for social auth service
    if (shop) {
      setShopifyShop(shop);
    }
    // Small delay to ensure we have URL params
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, [shop]);

  // If not in Shopify mode, just render children directly
  if (!shopifyConfig.isEmbedded) {
    return (
      <ShopifyContext.Provider value={{ shop: null, isAuthenticated: false, isLoading: false, host: null }}>
        {children}
      </ShopifyContext.Provider>
    );
  }

  // Show loading state briefly
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
          <p style={{ color: '#637381' }}>Loading...</p>
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
  const config = {
    apiKey: shopifyConfig.apiKey,
    host: host,
    forceRedirect: true,
  };

  const contextValue: ShopifyContextValue = {
    shop,
    isAuthenticated: true,
    isLoading: false,
    host,
  };

  return (
    <AppBridgeProvider config={config}>
      <ShopifyContext.Provider value={contextValue}>
        {children}
      </ShopifyContext.Provider>
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
