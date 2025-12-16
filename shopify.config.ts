/**
 * Shopify App Configuration
 * 
 * This file contains the configuration for the Shopify embedded app.
 * Set these values in your .env.local file.
 */

export const shopifyConfig = {
  // Your Shopify App API Key (from Partners dashboard)
  apiKey: import.meta.env.VITE_SHOPIFY_API_KEY || '',
  
  // Your Shopify App Host (passed as query param by Shopify)
  // This will be automatically extracted from URL params
  host: new URLSearchParams(window.location.search).get('host') || '',
  
  // Whether this is running as a Shopify embedded app
  isEmbedded: import.meta.env.VITE_APP_MODE === 'shopify',
  
  // Shopify scopes required by your app
  // - read_products: Display merchant's product catalog for content creation
  // - write_products: Save generated mockups back to product images
  // - read_content: Access store content for brand profile analysis
  scopes: ['read_products', 'write_products', 'read_content'],
  
  // Redirect URL after authentication
  redirectUri: import.meta.env.VITE_SHOPIFY_REDIRECT_URI || '',
};

// Validate required config
export function validateShopifyConfig() {
  if (shopifyConfig.isEmbedded) {
    if (!shopifyConfig.apiKey) {
      throw new Error('VITE_SHOPIFY_API_KEY is required for Shopify mode');
    }
    if (!shopifyConfig.host) {
      console.warn('Shopify host parameter not found in URL');
    }
  }
}


