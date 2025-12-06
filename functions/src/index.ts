import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import {
  buildOAuthUrl,
  exchangeCodeForToken,
  getLongLivedToken,
  getUserPages,
  postToFacebookPage,
  createInstagramMediaContainer,
  publishInstagramMedia,
  createInstagramCarouselItem,
  createInstagramCarouselContainer,
  postMultiPhotoToFacebook
} from './meta';

// Export scheduler functions
export { processScheduledPosts, triggerScheduledPosts } from './scheduler';

// Export Shopify OAuth and authentication functions
export {
  shopifyAuthStart,
  shopifyAuthCallback,
  shopifyVerifySession,
  shopifyCheckInstall,
  shopifyAppUninstalled,
} from './shopify-auth';

// Export Shopify API proxy functions
export {
  shopifyGetProducts,
  shopifyGetProduct,
  shopifyGetProductImages,
  shopifyGetCollections,
  shopifySearchProducts,
  shopifyGetShop,
  shopifyProxyImage,
} from './shopify-api';

// Export Shopify GDPR webhooks
export {
  gdprCustomersDataRequest,
  gdprCustomersRedact,
  gdprShopRedact,
  exportShopData,
} from './shopify-gdpr';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

/**
 * Upload base64 image to Firebase Storage and return public URL
 */
async function uploadImageToStorage(base64Data: string, sessionId: string): Promise<string> {
  // Remove data URL prefix if present
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Image, 'base64');
  
  // Generate unique filename
  const filename = `posts/${sessionId}/${Date.now()}.jpg`;
  const bucket = storage.bucket();
  const file = bucket.file(filename);
  
  // Upload the image
  await file.save(buffer, {
    metadata: {
      contentType: 'image/jpeg',
    },
  });
  
  // Make the file publicly accessible
  await file.makePublic();
  
  // Return the public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
  return publicUrl;
}

// CORS middleware
const corsHandler = cors({ origin: true });

// Environment variables (set via Firebase config)
const getConfig = () => {
  const config = functions.config();
  return {
    appId: config.meta?.app_id || process.env.META_APP_ID || '',
    appSecret: config.meta?.app_secret || process.env.META_APP_SECRET || '',
    functionsUrl: config.app?.functions_url || process.env.FUNCTIONS_URL || '',
    // Use custom domain for OAuth
    hostingUrl: config.app?.hosting_url || process.env.HOSTING_URL || 'https://api.socialstitch.io',
    frontendUrl: config.app?.frontend_url || process.env.FRONTEND_URL || 'http://localhost:5173'
  };
};

/**
 * Start OAuth flow - redirects to Meta's OAuth page
 */
export const authStart = functions.https.onRequest((req, res) => {
  const config = getConfig();
  
  // Debug: log raw query params
  console.log('authStart - raw req.query:', JSON.stringify(req.query));
  console.log('authStart - raw platform:', req.query.platform, 'type:', typeof req.query.platform);
  
  // Ensure sessionId, platform, and redirectUrl are strings (req.query can return arrays)
  let sessionId = Array.isArray(req.query.sessionId) 
    ? req.query.sessionId[0] 
    : req.query.sessionId;
  let platform = Array.isArray(req.query.platform) 
    ? req.query.platform[0] 
    : req.query.platform;
  let redirectUrl = Array.isArray(req.query.redirectUrl)
    ? req.query.redirectUrl[0]
    : req.query.redirectUrl;
  
  // Force to string
  sessionId = String(sessionId);
  platform = String(platform);
  // Use provided redirectUrl or fall back to config
  const frontendUrl = redirectUrl ? String(redirectUrl) : config.frontendUrl;
  
  console.log('authStart - processed platform:', platform, 'frontendUrl:', frontendUrl);

  if (!sessionId || !platform) {
    res.status(400).json({ error: 'Missing sessionId or platform parameter' });
    return;
  }

  if (!config.appId) {
    res.status(500).json({ error: 'Meta App ID not configured' });
    return;
  }

  // Use Firebase Hosting URL for OAuth callback to avoid Safe Browsing warnings
  const redirectUri = `${config.hostingUrl}/api/auth/callback`;
  const oauthUrl = buildOAuthUrl(
    config.appId,
    redirectUri,
    String(sessionId),
    String(platform) as 'facebook' | 'instagram',
    frontendUrl
  );

  res.redirect(oauthUrl);
});

/**
 * OAuth callback - exchanges code for token and stores in Firestore
 */
export const authCallback = functions.https.onRequest(async (req, res) => {
  const config = getConfig();
  const { code, state, error, error_description } = req.query;

  // Parse state early to get frontendUrl for error redirects
  let frontendUrl = config.frontendUrl;
  if (state) {
    try {
      const stateStr = Array.isArray(state) ? state[0] : state;
      const parsedState = JSON.parse(stateStr as string);
      if (parsedState.frontendUrl) {
        frontendUrl = String(parsedState.frontendUrl);
      }
    } catch (e) {
      // Use default frontendUrl if state parsing fails
    }
  }

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, error_description);
    res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(error_description as string || 'Unknown error')}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state parameter' });
    return;
  }

  try {
    // Parse state to get sessionId and platform
    // Handle case where state might be an array
    const stateStr = Array.isArray(state) ? state[0] : state;
    const parsedState = JSON.parse(stateStr as string);
    
    // Ensure sessionId and platform are strings (handle arrays if somehow present)
    const sessionId = Array.isArray(parsedState.sessionId) 
      ? String(parsedState.sessionId[0]) 
      : String(parsedState.sessionId);
    const platform = Array.isArray(parsedState.platform) 
      ? String(parsedState.platform[0]) 
      : String(parsedState.platform);
    // Use frontendUrl from state if provided, otherwise use config
    if (parsedState.frontendUrl) {
      frontendUrl = String(parsedState.frontendUrl);
    }
    
    console.log('Auth callback - sessionId:', sessionId, 'platform:', platform, 'frontendUrl:', frontendUrl);
    // Use Firebase Hosting URL for OAuth callback (must match what was used in authStart)
    const redirectUri = `${config.hostingUrl}/api/auth/callback`;

    // Exchange code for short-lived token
    const tokenResponse = await exchangeCodeForToken(
      code as string,
      config.appId,
      config.appSecret,
      redirectUri
    );

    // Get long-lived token
    const longLivedToken = await getLongLivedToken(
      tokenResponse.access_token,
      config.appId,
      config.appSecret
    );

    // Get user's Facebook Pages (with Instagram business accounts)
    const pages = await getUserPages(longLivedToken.access_token);

    if (pages.length === 0) {
      res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent('No Facebook Pages found. Please create a Page first.')}`);
      return;
    }

    // Use the first page for simplicity (could add page selection UI later)
    const selectedPage = pages[0];

    // Store account info in Firestore
    const accountData: Record<string, unknown> = {
      connected: true,
      pageId: selectedPage.id,
      pageName: selectedPage.name,
      pageAccessToken: selectedPage.access_token,
      userAccessToken: longLivedToken.access_token,
      connectedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // If this is Instagram and the page has an IG business account
    if (platform === 'instagram' && selectedPage.instagram_business_account) {
      accountData.instagramId = selectedPage.instagram_business_account.id;
      accountData.instagramUsername = selectedPage.instagram_business_account.username || 'Connected Account';
    } else if (platform === 'instagram' && !selectedPage.instagram_business_account) {
      res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent('No Instagram Business Account linked to your Facebook Page.')}`);
      return;
    }

    // Save to Firestore
    await db.collection('sessions').doc(sessionId).collection('accounts').doc(platform).set(accountData);

    // Redirect back to frontend with success
    res.redirect(`${frontendUrl}?auth_success=${platform}`);

  } catch (err) {
    console.error('Auth callback error:', err);
    res.redirect(`${config.frontendUrl}?auth_error=${encodeURIComponent('Authentication failed. Please try again.')}`);
  }
});

/**
 * Get connected accounts for a session
 */
export const getConnectedAccounts = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const { sessionId } = req.query;

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId parameter' });
      return;
    }

    try {
      const accountsSnapshot = await db
        .collection('sessions')
        .doc(sessionId as string)
        .collection('accounts')
        .get();

      const accounts: Record<string, unknown> = {};
      
      accountsSnapshot.forEach((doc) => {
        const data = doc.data();
        accounts[doc.id] = {
          connected: data.connected,
          username: data.instagramUsername || data.pageName,
          pageId: data.pageId,
          pageName: data.pageName
        };
      });

      res.json({ accounts });
    } catch (err) {
      console.error('Error getting accounts:', err);
      res.status(500).json({ error: 'Failed to get accounts' });
    }
  });
});

/**
 * Post to Facebook Page
 */
export const postToFacebook = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { sessionId, imageUrl, imageBase64, caption } = req.body;

    if (!sessionId || (!imageUrl && !imageBase64) || !caption) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    try {
      // Get account from Firestore
      const accountDoc = await db
        .collection('sessions')
        .doc(sessionId)
        .collection('accounts')
        .doc('facebook')
        .get();

      if (!accountDoc.exists) {
        res.status(401).json({ error: 'Facebook account not connected' });
        return;
      }

      const account = accountDoc.data()!;

      // Determine the public image URL
      let publicImageUrl = imageUrl;
      
      // If base64 image is provided, or if imageUrl is a data URL or localhost, upload to Storage
      if (imageBase64 || (imageUrl && (imageUrl.startsWith('data:') || imageUrl.includes('localhost') || imageUrl.startsWith('blob:')))) {
        const imageData = imageBase64 || imageUrl;
        console.log('Uploading image to Firebase Storage...');
        publicImageUrl = await uploadImageToStorage(imageData, sessionId);
        console.log('Image uploaded:', publicImageUrl);
      }

      // Post to Facebook
      const result = await postToFacebookPage(
        account.pageId,
        account.pageAccessToken,
        publicImageUrl,
        caption
      );

      res.json({ success: true, postId: result.post_id || result.id });
    } catch (err) {
      console.error('Error posting to Facebook:', err);
      res.status(500).json({ error: 'Failed to post to Facebook' });
    }
  });
});

/**
 * Post to Instagram Business Account
 */
export const postToInstagram = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { sessionId, imageUrl, imageBase64, caption } = req.body;

    if (!sessionId || (!imageUrl && !imageBase64) || !caption) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    try {
      // Get account from Firestore
      const accountDoc = await db
        .collection('sessions')
        .doc(sessionId)
        .collection('accounts')
        .doc('instagram')
        .get();

      if (!accountDoc.exists) {
        res.status(401).json({ error: 'Instagram account not connected' });
        return;
      }

      const account = accountDoc.data()!;

      if (!account.instagramId) {
        res.status(400).json({ error: 'No Instagram Business Account linked' });
        return;
      }

      // Determine the public image URL
      let publicImageUrl = imageUrl;
      
      // If base64 image is provided, or if imageUrl is a data URL or localhost, upload to Storage
      if (imageBase64 || (imageUrl && (imageUrl.startsWith('data:') || imageUrl.includes('localhost') || imageUrl.startsWith('blob:')))) {
        const imageData = imageBase64 || imageUrl;
        console.log('Uploading image to Firebase Storage...');
        publicImageUrl = await uploadImageToStorage(imageData, sessionId);
        console.log('Image uploaded:', publicImageUrl);
      }

      // Step 1: Create media container
      const container = await createInstagramMediaContainer(
        account.instagramId,
        account.pageAccessToken,
        publicImageUrl,
        caption
      );

      // Step 2: Publish the media
      const result = await publishInstagramMedia(
        account.instagramId,
        account.pageAccessToken,
        container.id
      );

      res.json({ success: true, postId: result.id });
    } catch (err) {
      console.error('Error posting to Instagram:', err);
      res.status(500).json({ error: 'Failed to post to Instagram' });
    }
  });
});

/**
 * Post a carousel to Instagram Business Account
 */
export const postCarouselToInstagram = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { sessionId, imagesBase64, caption } = req.body;

    if (!sessionId || !imagesBase64 || !Array.isArray(imagesBase64) || imagesBase64.length < 2 || !caption) {
      res.status(400).json({ error: 'Missing required fields. Carousel requires at least 2 images.' });
      return;
    }

    if (imagesBase64.length > 10) {
      res.status(400).json({ error: 'Instagram carousel supports maximum 10 images.' });
      return;
    }

    try {
      // Get account from Firestore
      const accountDoc = await db
        .collection('sessions')
        .doc(sessionId)
        .collection('accounts')
        .doc('instagram')
        .get();

      if (!accountDoc.exists) {
        res.status(401).json({ error: 'Instagram account not connected' });
        return;
      }

      const account = accountDoc.data()!;

      if (!account.instagramId) {
        res.status(400).json({ error: 'No Instagram Business Account linked' });
        return;
      }

      // Step 1: Upload all images to Firebase Storage and get public URLs
      console.log(`Uploading ${imagesBase64.length} images to Firebase Storage...`);
      const publicUrls: string[] = [];
      for (let i = 0; i < imagesBase64.length; i++) {
        const publicUrl = await uploadImageToStorage(imagesBase64[i], sessionId);
        publicUrls.push(publicUrl);
        console.log(`Uploaded image ${i + 1}/${imagesBase64.length}: ${publicUrl}`);
      }

      // Step 2: Create carousel item containers for each image
      console.log('Creating Instagram carousel item containers...');
      const childrenIds: string[] = [];
      for (const imageUrl of publicUrls) {
        const container = await createInstagramCarouselItem(
          account.instagramId,
          account.pageAccessToken,
          imageUrl
        );
        childrenIds.push(container.id);
        console.log(`Created carousel item: ${container.id}`);
      }

      // Step 3: Create the carousel container
      console.log('Creating Instagram carousel container...');
      const carouselContainer = await createInstagramCarouselContainer(
        account.instagramId,
        account.pageAccessToken,
        childrenIds,
        caption
      );
      console.log(`Created carousel container: ${carouselContainer.id}`);

      // Step 4: Publish the carousel
      console.log('Publishing Instagram carousel...');
      const result = await publishInstagramMedia(
        account.instagramId,
        account.pageAccessToken,
        carouselContainer.id
      );

      res.json({ success: true, postId: result.id });
    } catch (err) {
      console.error('Error posting carousel to Instagram:', err);
      res.status(500).json({ error: 'Failed to post carousel to Instagram' });
    }
  });
});

/**
 * Post a carousel/multi-photo to Facebook Page
 */
export const postCarouselToFacebook = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { sessionId, imagesBase64, caption } = req.body;

    if (!sessionId || !imagesBase64 || !Array.isArray(imagesBase64) || imagesBase64.length < 2 || !caption) {
      res.status(400).json({ error: 'Missing required fields. Multi-photo post requires at least 2 images.' });
      return;
    }

    try {
      // Get account from Firestore
      const accountDoc = await db
        .collection('sessions')
        .doc(sessionId)
        .collection('accounts')
        .doc('facebook')
        .get();

      if (!accountDoc.exists) {
        res.status(401).json({ error: 'Facebook account not connected' });
        return;
      }

      const account = accountDoc.data()!;

      // Upload all images to Firebase Storage and get public URLs
      console.log(`Uploading ${imagesBase64.length} images to Firebase Storage...`);
      const publicUrls: string[] = [];
      for (let i = 0; i < imagesBase64.length; i++) {
        const publicUrl = await uploadImageToStorage(imagesBase64[i], sessionId);
        publicUrls.push(publicUrl);
        console.log(`Uploaded image ${i + 1}/${imagesBase64.length}: ${publicUrl}`);
      }

      // Post multi-photo to Facebook
      console.log('Creating Facebook multi-photo post...');
      const result = await postMultiPhotoToFacebook(
        account.pageId,
        account.pageAccessToken,
        publicUrls,
        caption
      );

      res.json({ success: true, postId: result.post_id || result.id });
    } catch (err) {
      console.error('Error posting carousel to Facebook:', err);
      res.status(500).json({ error: 'Failed to post carousel to Facebook' });
    }
  });
});

/**
 * Disconnect an account
 */
export const disconnectAccount = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { sessionId, platform } = req.body;

    if (!sessionId || !platform) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    try {
      await db
        .collection('sessions')
        .doc(sessionId)
        .collection('accounts')
        .doc(platform)
        .delete();

      res.json({ success: true });
    } catch (err) {
      console.error('Error disconnecting account:', err);
      res.status(500).json({ error: 'Failed to disconnect account' });
    }
  });
});

