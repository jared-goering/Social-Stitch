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
  publishInstagramMedia
} from './meta';

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
    frontendUrl: config.app?.frontend_url || process.env.FRONTEND_URL || 'http://localhost:5173'
  };
};

/**
 * Start OAuth flow - redirects to Meta's OAuth page
 */
export const authStart = functions.https.onRequest((req, res) => {
  const config = getConfig();
  const { sessionId, platform } = req.query;

  if (!sessionId || !platform) {
    res.status(400).json({ error: 'Missing sessionId or platform parameter' });
    return;
  }

  if (!config.appId) {
    res.status(500).json({ error: 'Meta App ID not configured' });
    return;
  }

  const redirectUri = `${config.functionsUrl}/authCallback`;
  const oauthUrl = buildOAuthUrl(
    config.appId,
    redirectUri,
    sessionId as string,
    platform as 'facebook' | 'instagram'
  );

  res.redirect(oauthUrl);
});

/**
 * OAuth callback - exchanges code for token and stores in Firestore
 */
export const authCallback = functions.https.onRequest(async (req, res) => {
  const config = getConfig();
  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, error_description);
    res.redirect(`${config.frontendUrl}?auth_error=${encodeURIComponent(error_description as string || 'Unknown error')}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state parameter' });
    return;
  }

  try {
    // Parse state to get sessionId and platform
    const { sessionId, platform } = JSON.parse(state as string);
    const redirectUri = `${config.functionsUrl}/authCallback`;

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
      res.redirect(`${config.frontendUrl}?auth_error=${encodeURIComponent('No Facebook Pages found. Please create a Page first.')}`);
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
      res.redirect(`${config.frontendUrl}?auth_error=${encodeURIComponent('No Instagram Business Account linked to your Facebook Page.')}`);
      return;
    }

    // Save to Firestore
    await db.collection('sessions').doc(sessionId).collection('accounts').doc(platform).set(accountData);

    // Redirect back to frontend with success
    res.redirect(`${config.frontendUrl}?auth_success=${platform}`);

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

