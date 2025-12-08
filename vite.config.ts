import path from 'path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Custom plugin to inject Shopify API key into HTML
 * This is required for Shopify's embedded app checks to pass
 * 
 * IMPORTANT: The API key must be available BEFORE the App Bridge CDN script loads.
 * The CDN script reads the meta tag immediately, so we:
 * 1. Replace __SHOPIFY_API_KEY__ placeholder in the meta tag directly
 * 2. Inject window.__SHOPIFY_API_KEY__ right after <head> so it's available early
 */
function shopifyApiKeyPlugin(): Plugin {
  return {
    name: 'shopify-api-key',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Get the API key from environment variables
        const apiKey = process.env.VITE_SHOPIFY_API_KEY || '';
        
        // Replace the placeholder in the meta tag content directly
        let transformed = html.replace(
          /__SHOPIFY_API_KEY__/g,
          apiKey
        );
        
        // Also inject the API key as a global variable RIGHT AFTER <head>
        // This ensures it's available before any scripts run
        const scriptInjection = `<script>window.__SHOPIFY_API_KEY__ = "${apiKey}";</script>\n    `;
        transformed = transformed.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    ${scriptInjection}`
        );
        
        return transformed;
      },
    },
  };
}

export default defineConfig(() => {
    // Vite automatically exposes VITE_ prefixed environment variables
    // Vercel will provide these at build time
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [
        shopifyApiKeyPlugin(),
        react(),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
