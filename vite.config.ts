import path from 'path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Custom plugin to inject Shopify API key into HTML
 * This is required for Shopify's embedded app checks to pass
 */
function shopifyApiKeyPlugin(): Plugin {
  return {
    name: 'shopify-api-key',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Get the API key from environment variables
        const apiKey = process.env.VITE_SHOPIFY_API_KEY || '';
        
        // Replace the placeholder in the meta tag
        let transformed = html.replace(
          /__SHOPIFY_API_KEY__/g,
          apiKey
        );
        
        // Inject the API key as a global variable for runtime access
        // This allows the runtime script to update the meta tag if needed
        const scriptInjection = `<script>window.__SHOPIFY_API_KEY__ = "${apiKey}";</script>`;
        transformed = transformed.replace(
          '</head>',
          `${scriptInjection}\n  </head>`
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
