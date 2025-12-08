import path from 'path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Custom plugin to inject Shopify API key into HTML
 * This is required for Shopify's embedded app checks to pass
 * 
 * Only replaces the API key in the meta tag - the CDN reads it from there.
 * Simple and clean - no extra scripts needed.
 */
function shopifyApiKeyPlugin(): Plugin {
  return {
    name: 'shopify-api-key',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Get the API key from environment variables
        // IMPORTANT: trim() removes any accidental whitespace/newlines
        const apiKey = (process.env.VITE_SHOPIFY_API_KEY || '').trim();
        
        // Only replace in the meta tag content attribute (not globally!)
        // This prevents accidentally replacing variable names in scripts
        const transformed = html.replace(
          /(<meta name="shopify-api-key" content=")__SHOPIFY_API_KEY__(")/,
          `$1${apiKey}$2`
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
