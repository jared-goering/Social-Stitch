/**
 * Shopify App Bridge Provider
 * 
 * Wraps the app with Shopify App Bridge when running in embedded mode
 */

import React, { useEffect, useState } from 'react';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { shopifyConfig, validateShopifyConfig } from '../shopify.config';
import { 
  getShopifySession, 
  isShopifyAuthenticated,
  getShopFromUrl,
  initiateShopifyAuth 
} from '../services/shopifyAuthService';

interface ShopifyProviderProps {
  children: React.ReactNode;
}

/**
 * Provides Shopify App Bridge context when running as embedded app
 * Falls through to children when not in Shopify mode
 */
export function ShopifyProvider({ children }: ShopifyProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!shopifyConfig.isEmbedded) {
      // Not running as Shopify app, skip initialization
      setIsReady(true);
      return;
    }
    
    try {
      validateShopifyConfig();
      
      // Check if we have a valid session
      if (!isShopifyAuthenticated()) {
        const shop = getShopFromUrl();
        if (shop) {
          // Initiate OAuth flow
          initiateShopifyAuth(shop);
          return;
        } else {
          setError('Shop parameter missing. Please install the app from Shopify admin.');
          return;
        }
      }
      
      setIsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Shopify');
    }
  }, []);
  
  // Show loading state
  if (!isReady && !error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #e2e8f0',
            borderTop: '3px solid #5c6ac4',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#637381' }}>Loading Shopify app...</p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ 
          textAlign: 'center', 
          maxWidth: '400px', 
          padding: '24px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: '#fef2f2',
            color: '#dc2626',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '24px'
          }}>
            ⚠️
          </div>
          <h2 style={{ color: '#111827', marginBottom: '8px' }}>Configuration Error</h2>
          <p style={{ color: '#637381', fontSize: '14px' }}>{error}</p>
        </div>
      </div>
    );
  }
  
  // If not in Shopify mode, just render children
  if (!shopifyConfig.isEmbedded) {
    return <>{children}</>;
  }
  
  // Wrap with Shopify App Bridge
  const session = getShopifySession();
  if (!session) {
    return <div>Session error</div>;
  }
  
  const config = {
    apiKey: shopifyConfig.apiKey,
    host: shopifyConfig.host,
    forceRedirect: true,
  };
  
  return (
    <AppBridgeProvider config={config}>
      {children}
    </AppBridgeProvider>
  );
}

// Add CSS animation for loading spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

