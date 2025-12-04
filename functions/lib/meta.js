"use strict";
/**
 * Meta (Facebook/Instagram) Graph API Helper Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOAuthUrl = buildOAuthUrl;
exports.exchangeCodeForToken = exchangeCodeForToken;
exports.getLongLivedToken = getLongLivedToken;
exports.getUserInfo = getUserInfo;
exports.getUserPages = getUserPages;
exports.postToFacebookPage = postToFacebookPage;
exports.createInstagramMediaContainer = createInstagramMediaContainer;
exports.publishInstagramMedia = publishInstagramMedia;
exports.uploadImageForPosting = uploadImageForPosting;
exports.createInstagramCarouselItem = createInstagramCarouselItem;
exports.createInstagramCarouselContainer = createInstagramCarouselContainer;
exports.postMultiPhotoToFacebook = postMultiPhotoToFacebook;
const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
/**
 * Build the OAuth authorization URL for Meta
 */
function buildOAuthUrl(appId, redirectUri, sessionId, platform, frontendUrl) {
    const scopes = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_posts',
        'instagram_basic',
        'instagram_content_publish',
        'business_management'
    ];
    // Include frontendUrl in state so callback knows where to redirect
    const stateData = { sessionId, platform };
    if (frontendUrl) {
        stateData.frontendUrl = frontendUrl;
    }
    const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        scope: scopes.join(','),
        response_type: 'code',
        state: JSON.stringify(stateData)
    });
    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}
/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code, appId, appSecret, redirectUri) {
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
async function getLongLivedToken(shortLivedToken, appId, appSecret) {
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
async function getUserInfo(accessToken) {
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
async function getUserPages(accessToken) {
    const response = await fetch(`${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`);
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
async function postToFacebookPage(pageId, pageAccessToken, imageUrl, caption) {
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
async function createInstagramMediaContainer(igUserId, accessToken, imageUrl, caption) {
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
async function checkMediaStatus(containerId, accessToken) {
    const response = await fetch(`${GRAPH_API_BASE}/${containerId}?fields=status,status_code&access_token=${accessToken}`);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to check media status: ${JSON.stringify(error)}`);
    }
    return response.json();
}
/**
 * Wait for media container to be ready (with polling)
 */
async function waitForMediaReady(containerId, accessToken, maxAttempts = 10, delayMs = 3000) {
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
async function publishInstagramMedia(igUserId, accessToken, creationId) {
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
async function uploadImageForPosting(base64Image) {
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
/**
 * Create an Instagram carousel item container (for carousel posts)
 * These containers don't have captions - the caption is on the parent carousel
 * This function waits for the item to be ready before returning
 */
async function createInstagramCarouselItem(igUserId, accessToken, imageUrl) {
    const params = new URLSearchParams({
        image_url: imageUrl,
        is_carousel_item: 'true',
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
        throw new Error(`Failed to create IG carousel item: ${JSON.stringify(error)}`);
    }
    const result = await response.json();
    // Wait for the carousel item to be ready before returning
    // This is critical - carousel items must be FINISHED before being added to carousel container
    await waitForMediaReady(result.id, accessToken);
    return result;
}
/**
 * Create an Instagram carousel container with multiple children
 */
async function createInstagramCarouselContainer(igUserId, accessToken, childrenIds, caption) {
    const params = new URLSearchParams({
        media_type: 'CAROUSEL',
        children: childrenIds.join(','),
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
        throw new Error(`Failed to create IG carousel container: ${JSON.stringify(error)}`);
    }
    return response.json();
}
/**
 * Post multiple photos to a Facebook Page
 * Uses unpublished photos approach for multi-photo posts
 */
async function postMultiPhotoToFacebook(pageId, pageAccessToken, imageUrls, caption) {
    // Step 1: Upload each photo as unpublished
    const photoIds = [];
    for (const imageUrl of imageUrls) {
        const photoResponse = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: imageUrl,
                published: false,
                access_token: pageAccessToken
            })
        });
        if (!photoResponse.ok) {
            const error = await photoResponse.json();
            throw new Error(`Failed to upload photo to Facebook: ${JSON.stringify(error)}`);
        }
        const photoData = await photoResponse.json();
        photoIds.push(photoData.id);
    }
    // Step 2: Create a post with all the photos attached
    const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
    const postResponse = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: caption,
            attached_media: attachedMedia,
            access_token: pageAccessToken
        })
    });
    if (!postResponse.ok) {
        const error = await postResponse.json();
        throw new Error(`Failed to create Facebook multi-photo post: ${JSON.stringify(error)}`);
    }
    return postResponse.json();
}
//# sourceMappingURL=meta.js.map