"use strict";
/**
 * Scheduled Post Processor
 * Runs on a schedule to publish posts that are due
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerScheduledPosts = exports.processScheduledPosts = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const meta_1 = require("./meta");
// Lazy getter for Firestore to avoid initialization issues
const getDb = () => admin.firestore();
/**
 * Process a single post for a specific platform
 */
async function processPostForPlatform(post, platform, account) {
    try {
        const caption = post.captions[platform] || post.captions.instagram || post.captions.facebook || '';
        const imageUrls = post.imageUrls;
        const isCarousel = imageUrls.length > 1;
        if (platform === 'facebook') {
            if (isCarousel) {
                // Multi-photo Facebook post
                const result = await (0, meta_1.postMultiPhotoToFacebook)(account.pageId, account.pageAccessToken, imageUrls, caption);
                return { success: true, postId: result.post_id || result.id };
            }
            else {
                // Single photo Facebook post
                const result = await (0, meta_1.postToFacebookPage)(account.pageId, account.pageAccessToken, imageUrls[0], caption);
                return { success: true, postId: result.post_id || result.id };
            }
        }
        else if (platform === 'instagram') {
            if (!account.instagramId) {
                return { success: false, error: 'No Instagram Business Account linked' };
            }
            if (isCarousel) {
                // Create carousel item containers for each image
                const childrenIds = [];
                for (const imageUrl of imageUrls) {
                    const container = await (0, meta_1.createInstagramCarouselItem)(account.instagramId, account.pageAccessToken, imageUrl);
                    childrenIds.push(container.id);
                }
                // Create the carousel container
                const carouselContainer = await (0, meta_1.createInstagramCarouselContainer)(account.instagramId, account.pageAccessToken, childrenIds, caption);
                // Publish the carousel
                const result = await (0, meta_1.publishInstagramMedia)(account.instagramId, account.pageAccessToken, carouselContainer.id);
                return { success: true, postId: result.id };
            }
            else {
                // Single image Instagram post
                const container = await (0, meta_1.createInstagramMediaContainer)(account.instagramId, account.pageAccessToken, imageUrls[0], caption);
                const result = await (0, meta_1.publishInstagramMedia)(account.instagramId, account.pageAccessToken, container.id);
                return { success: true, postId: result.id };
            }
        }
        return { success: false, error: 'Unknown platform' };
    }
    catch (error) {
        console.error(`Error posting to ${platform}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
/**
 * Process a single scheduled post
 */
async function processScheduledPost(postDoc) {
    const post = Object.assign({ id: postDoc.id }, postDoc.data());
    console.log(`Processing scheduled post: ${post.id}`);
    const errors = [];
    const successfulPlatforms = [];
    for (const platform of post.platforms) {
        // Get the account for this platform
        const accountDoc = await getDb()
            .collection('sessions')
            .doc(post.sessionId)
            .collection('accounts')
            .doc(platform)
            .get();
        if (!accountDoc.exists) {
            errors.push(`${platform}: Account not connected`);
            continue;
        }
        const account = accountDoc.data();
        const result = await processPostForPlatform(post, platform, account);
        if (result.success) {
            successfulPlatforms.push(platform);
            console.log(`Successfully posted to ${platform}: ${result.postId}`);
        }
        else {
            errors.push(`${platform}: ${result.error}`);
            console.error(`Failed to post to ${platform}: ${result.error}`);
        }
    }
    // Update the post status
    const allSuccessful = errors.length === 0 && successfulPlatforms.length === post.platforms.length;
    await postDoc.ref.update({
        status: allSuccessful ? 'published' : 'failed',
        publishedAt: allSuccessful ? admin.firestore.FieldValue.serverTimestamp() : null,
        error: errors.length > 0 ? errors.join('; ') : null
    });
    console.log(`Post ${post.id} ${allSuccessful ? 'published' : 'failed'}`);
}
/**
 * Scheduled function that runs every minute to process due posts
 *
 * Note: This uses Cloud Functions v1 syntax for compatibility.
 * In production, consider upgrading to v2 for better cold start performance.
 */
exports.processScheduledPosts = functions.pubsub
    .schedule('every 1 minutes')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('Running scheduled post processor...');
    const now = admin.firestore.Timestamp.now();
    try {
        // Query for posts that are due
        const duePostsSnapshot = await getDb()
            .collection('scheduledPosts')
            .where('status', '==', 'scheduled')
            .where('scheduledFor', '<=', now)
            .limit(10) // Process in batches to avoid timeout
            .get();
        if (duePostsSnapshot.empty) {
            console.log('No posts due for publishing');
            return null;
        }
        console.log(`Found ${duePostsSnapshot.size} posts to process`);
        // Process each post
        const promises = duePostsSnapshot.docs.map(doc => processScheduledPost(doc));
        await Promise.allSettled(promises);
        console.log('Scheduled post processing complete');
        return null;
    }
    catch (error) {
        console.error('Error in scheduled post processor:', error);
        throw error;
    }
});
/**
 * HTTP function to manually trigger post processing (useful for testing)
 */
exports.triggerScheduledPosts = functions.https.onRequest(async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    console.log('Manual trigger: Running scheduled post processor...');
    const now = admin.firestore.Timestamp.now();
    try {
        const duePostsSnapshot = await getDb()
            .collection('scheduledPosts')
            .where('status', '==', 'scheduled')
            .where('scheduledFor', '<=', now)
            .limit(10)
            .get();
        if (duePostsSnapshot.empty) {
            res.json({ message: 'No posts due for publishing', count: 0 });
            return;
        }
        console.log(`Found ${duePostsSnapshot.size} posts to process`);
        const results = await Promise.allSettled(duePostsSnapshot.docs.map(doc => processScheduledPost(doc)));
        const processed = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        res.json({
            message: 'Processing complete',
            total: duePostsSnapshot.size,
            processed,
            failed
        });
    }
    catch (error) {
        console.error('Error in manual trigger:', error);
        res.status(500).json({
            error: 'Failed to process scheduled posts',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
//# sourceMappingURL=scheduler.js.map