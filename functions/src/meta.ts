/**
 * Meta (Facebook/Instagram) Graph API Helper Functions
 */

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface MetaUserInfo {
  id: string;
  name: string;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
}

export interface InstagramAccount {
  id: string;
  username: string;
  pageId: string;
  pageName: string;
  accessToken: string;
}

/**
 * Build the OAuth authorization URL for Meta
 */
export function buildOAuthUrl(
  appId: string,
  redirectUri: string,
  sessionId: string,
  platform: 'facebook' | 'instagram'
): string {
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
    'business_management'
  ];

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes.join(','),
    response_type: 'code',
    state: JSON.stringify({ sessionId, platform })
  });

  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code: code
  });

  const response = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Get long-lived access token (lasts ~60 days)
 */
export async function getLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken
  });

  const response = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Get user info from access token
 */
export async function getUserInfo(accessToken: string): Promise<MetaUserInfo> {
  const response = await fetch(`${GRAPH_API_BASE}/me?access_token=${accessToken}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get user info: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Get Facebook Pages the user manages
 */
export async function getUserPages(accessToken: string): Promise<FacebookPage[]> {
  const response = await fetch(
    `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get pages: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Post a photo to a Facebook Page
 */
export async function postToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string
): Promise<{ id: string; post_id: string }> {
  const response = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: imageUrl,
      caption: caption,
      access_token: pageAccessToken
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to post to Facebook: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Create an Instagram media container (step 1 of posting)
 */
export async function createInstagramMediaContainer(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption: caption,
    access_token: accessToken
  });

  const response = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create IG media container: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Check Instagram media container status
 */
async function checkMediaStatus(
  containerId: string,
  accessToken: string
): Promise<{ status: string; status_code?: string }> {
  const response = await fetch(
    `${GRAPH_API_BASE}/${containerId}?fields=status,status_code&access_token=${accessToken}`
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to check media status: ${JSON.stringify(error)}`);
  }
  
  return response.json();
}

/**
 * Wait for media container to be ready (with polling)
 */
async function waitForMediaReady(
  containerId: string,
  accessToken: string,
  maxAttempts = 10,
  delayMs = 3000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkMediaStatus(containerId, accessToken);
    console.log(`Media status check ${attempt + 1}:`, status);
    
    if (status.status_code === 'FINISHED') {
      return; // Ready to publish
    }
    
    if (status.status_code === 'ERROR') {
      throw new Error(`Media processing failed: ${JSON.stringify(status)}`);
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error('Media processing timed out');
}

/**
 * Publish an Instagram media container (step 2 of posting)
 */
export async function publishInstagramMedia(
  igUserId: string,
  accessToken: string,
  creationId: string
): Promise<{ id: string }> {
  // Wait for media to be ready before publishing
  await waitForMediaReady(creationId, accessToken);
  
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken
  });

  const response = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to publish IG media: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Upload image to a temporary hosting service and get URL
 * For production, use Firebase Storage or similar
 */
export async function uploadImageForPosting(
  base64Image: string
): Promise<string> {
  // For now, we'll use imgbb as a free image host
  // In production, use Firebase Storage
  const formData = new URLSearchParams();
  formData.append('image', base64Image.replace(/^data:image\/\w+;base64,/, ''));
  
  const response = await fetch('https://api.imgbb.com/1/upload?key=free', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload image for posting');
  }

  const data = await response.json();
  return data.data.url;
}

