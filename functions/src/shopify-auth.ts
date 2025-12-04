/**
 * Shopify OAuth and Authentication Module
 *
 * Handles OAuth 2.0 flow for Shopify app installation:
 * - OAuth callback to exchange code for access token
 * - HMAC verification for request authenticity
 * - Session token verification for embedded app requests
 * - Secure token storage in Firestore
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import cors from 'cors';

const corsHandler = cors({ origin: true });

// Get Shopify configuration from Firebase config or environment
const getShopifyConfig = () => {
  const config = functions.config();
  return {
    apiKey: config.shopify?.api_key || process.env.SHOPIFY_API_KEY || '',
    apiSecret: config.shopify?.api_secret || process.env.SHOPIFY_API_SECRET || '',
    scopes: config.shopify?.scopes || process.env.SHOPIFY_SCOPES || 'read_products',
    appUrl: config.shopify?.app_url || process.env.SHOPIFY_APP_URL || '',
  };
};

/**
 * Verify HMAC signature from Shopify
 * Used to validate OAuth callbacks and webhook requests
 */
export function verifyHmac(query: Record<string, any>, secret: string): boolean {
  const { hmac, ...params } = query;

  if (!hmac) return false;

  // Sort parameters and create query string
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => {
      const value = Array.isArray(params[key]) ? params[key].join(',') : params[key];
      return `${key}=${value}`;
    })
    .join('&');

  // Calculate HMAC
  const calculatedHmac = crypto
    .createHmac('sha256', secret)
    .update(sortedParams)
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac as string, 'hex'),
      Buffer.from(calculatedHmac, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Verify Shopify webhook HMAC
 * Webhooks use a different HMAC calculation than OAuth
 */
export function verifyWebhookHmac(body: string, hmacHeader: string, secret: string): boolean {
  const calculatedHmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(calculatedHmac)
    );
  } catch {
    return false;
  }
}

/**
 * Verify Shopify session token (JWT)
 * Used for authenticated requests from the embedded app
 */
export function verifySessionToken(token: string, apiKey: string, apiSecret: string): {
  valid: boolean;
  payload?: {
    iss: string;
    dest: string;
    aud: string;
    sub: string;
    exp: number;
    nbf: number;
    iat: number;
    jti: string;
    sid: string;
  };
  error?: string;
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const signatureInput = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureInput)
      .digest('base64url');

    if (signatureB64 !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Verify audience matches our API key
    if (payload.aud !== apiKey) {
      return { valid: false, error: 'Invalid audience' };
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    // Verify not before
    if (payload.nbf > now) {
      return { valid: false, error: 'Token not yet valid' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Extract shop domain from session token destination
 */
export function getShopFromToken(dest: string): string {
  // dest is like "https://myshop.myshopify.com"
  const url = new URL(dest);
  return url.hostname;
}

/**
 * Start Shopify OAuth flow
 * Generates the OAuth URL and redirects the merchant
 */
export const shopifyAuthStart = functions.https.onRequest((req, res) => {
  const config = getShopifyConfig();
  const shop = req.query.shop as string;

  if (!shop) {
    res.status(400).json({ error: 'Missing shop parameter' });
    return;
  }

  // Validate shop domain format
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  if (!shopRegex.test(shop)) {
    res.status(400).json({ error: 'Invalid shop domain' });
    return;
  }

  if (!config.apiKey || !config.appUrl) {
    res.status(500).json({ error: 'Shopify app not configured' });
    return;
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Store state temporarily (expires in 10 minutes)
  const db = admin.firestore();
  db.collection('shopifyOAuthStates').doc(state).set({
    shop,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // Build OAuth URL
  const redirectUri = `${config.appUrl}/api/auth/callback`;
  const scopes = config.scopes;

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', config.apiKey);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

/**
 * Shopify OAuth callback
 * Exchanges authorization code for access token
 */
export const shopifyAuthCallback = functions.https.onRequest(async (req, res) => {
  const config = getShopifyConfig();
  const { code, shop, state, hmac } = req.query;

  // Validate required parameters
  if (!code || !shop || !state) {
    res.status(400).json({ error: 'Missing required OAuth parameters' });
    return;
  }

  // Verify HMAC
  if (!verifyHmac(req.query as Record<string, any>, config.apiSecret)) {
    res.status(401).json({ error: 'Invalid HMAC signature' });
    return;
  }

  // Verify state to prevent CSRF
  const db = admin.firestore();
  const stateDoc = await db.collection('shopifyOAuthStates').doc(state as string).get();

  if (!stateDoc.exists) {
    res.status(401).json({ error: 'Invalid or expired state parameter' });
    return;
  }

  const stateData = stateDoc.data()!;
  if (stateData.shop !== shop) {
    res.status(401).json({ error: 'State shop mismatch' });
    return;
  }

  // Delete used state
  await stateDoc.ref.delete();

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.apiKey,
        client_secret: config.apiSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      res.status(500).json({ error: 'Failed to exchange authorization code' });
      return;
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      scope: string;
    };

    // Fetch shop information
    const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': tokenData.access_token,
      },
    });

    let shopInfo: Record<string, any> = {};
    if (shopResponse.ok) {
      const shopData = await shopResponse.json() as { shop: Record<string, any> };
      shopInfo = shopData.shop;
    }

    // Store access token securely in Firestore
    await db.collection('shopifyStores').doc(shop as string).set({
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      shopDomain: shop,
      shopName: shopInfo.name || shop,
      shopEmail: shopInfo.email || '',
      shopOwner: shopInfo.shop_owner || '',
      installedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Create initial settings document for the shop
    await db.collection('shops').doc(shop as string).set({
      shopDomain: shop,
      shopName: shopInfo.name || shop,
      installedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Redirect back to the app (embedded in Shopify)
    const redirectUrl = `https://${shop}/admin/apps/${config.apiKey}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * Verify session token for API requests
 * Called by frontend to validate the embedded app session
 */
export const shopifyVerifySession = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const config = getShopifyConfig();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    const verification = verifySessionToken(token, config.apiKey, config.apiSecret);

    if (!verification.valid) {
      res.status(401).json({ error: verification.error || 'Invalid session token' });
      return;
    }

    const payload = verification.payload!;
    const shop = getShopFromToken(payload.dest);

    // Verify the shop has installed the app
    const db = admin.firestore();
    const storeDoc = await db.collection('shopifyStores').doc(shop).get();

    if (!storeDoc.exists) {
      res.status(401).json({ error: 'Shop has not installed the app' });
      return;
    }

    res.json({
      valid: true,
      shop,
      sessionId: payload.sid,
      userId: payload.sub,
    });
  });
});

/**
 * Get shop access token (internal use only)
 * Used by other functions to make authenticated Shopify API calls
 */
export async function getShopAccessToken(shop: string): Promise<string | null> {
  const db = admin.firestore();
  const storeDoc = await db.collection('shopifyStores').doc(shop).get();

  if (!storeDoc.exists) {
    return null;
  }

  return storeDoc.data()?.accessToken || null;
}

/**
 * Middleware to verify session token and extract shop
 * Returns the shop domain if valid, null if invalid
 */
export async function verifyRequestSession(req: functions.https.Request): Promise<{
  valid: boolean;
  shop?: string;
  error?: string;
}> {
  const config = getShopifyConfig();
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const token = authHeader.substring(7);
  const verification = verifySessionToken(token, config.apiKey, config.apiSecret);

  if (!verification.valid) {
    return { valid: false, error: verification.error };
  }

  const shop = getShopFromToken(verification.payload!.dest);
  return { valid: true, shop };
}

/**
 * Check if a shop has installed the app
 */
export const shopifyCheckInstall = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const shop = req.query.shop as string;

    if (!shop) {
      res.status(400).json({ error: 'Missing shop parameter' });
      return;
    }

    const db = admin.firestore();
    const storeDoc = await db.collection('shopifyStores').doc(shop).get();

    res.json({
      installed: storeDoc.exists,
      shop,
    });
  });
});

/**
 * Uninstall webhook handler
 * Called by Shopify when the app is uninstalled
 */
export const shopifyAppUninstalled = functions.https.onRequest(async (req, res) => {
  const config = getShopifyConfig();

  // Verify webhook HMAC
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
  const rawBody = (req as any).rawBody?.toString() || JSON.stringify(req.body);

  if (!verifyWebhookHmac(rawBody, hmacHeader, config.apiSecret)) {
    console.error('Invalid webhook HMAC');
    res.status(401).send('Unauthorized');
    return;
  }

  const shopDomain = req.headers['x-shopify-shop-domain'] as string;

  if (!shopDomain) {
    res.status(400).send('Missing shop domain');
    return;
  }

  console.log(`App uninstalled from shop: ${shopDomain}`);

  const db = admin.firestore();

  try {
    // Mark the store as uninstalled (don't delete data immediately for GDPR compliance)
    await db.collection('shopifyStores').doc(shopDomain).update({
      uninstalledAt: admin.firestore.FieldValue.serverTimestamp(),
      accessToken: admin.firestore.FieldValue.delete(),
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling uninstall webhook:', error);
    res.status(500).send('Internal error');
  }
});

