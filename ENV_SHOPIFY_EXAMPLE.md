# Shopify App Environment Variables

Copy these to your `.env.local` file when running as a Shopify app:

```env
# Set to 'shopify' to enable Shopify embedded app mode
VITE_APP_MODE=shopify

# Shopify App Credentials (from Partners Dashboard)
VITE_SHOPIFY_API_KEY=your_shopify_api_key_here
VITE_SHOPIFY_API_SECRET=your_shopify_api_secret_here
VITE_SHOPIFY_REDIRECT_URI=https://your-app-url.com/api/shopify/auth/callback

# Firebase Configuration (keep same as web app)
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_FUNCTIONS_URL=https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net

# Google Gemini API (same as web app)
VITE_GEMINI_API_KEY=your-gemini-api-key

# Optional: Set to false for production
VITE_USE_EMULATORS=false
```


