/**
 * Scheduled Posts Service
 * Handles CRUD operations for scheduled posts in Firestore
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebaseConfig';
import { ScheduledPost, CreateScheduledPostData, PostStatus, SocialPlatform } from '../types';
import { getSessionId } from './socialAuthService';

const COLLECTION_NAME = 'scheduledPosts';

/**
 * Get the current user/shop ID for storage
 */
function getCurrentUserId(): string {
  return getSessionId();
}

/**
 * Convert Firestore document to ScheduledPost
 */
function docToScheduledPost(doc: { id: string; data: () => Record<string, unknown> }): ScheduledPost {
  const data = doc.data();
  return {
    id: doc.id,
    sessionId: data.sessionId as string,
    platforms: data.platforms as SocialPlatform[],
    scheduledFor: (data.scheduledFor as Timestamp).toDate(),
    status: data.status as PostStatus,
    captions: data.captions as { facebook?: string; instagram?: string },
    imageUrls: data.imageUrls as string[],
    mockupData: data.mockupData as ScheduledPost['mockupData'],
    createdAt: (data.createdAt as Timestamp).toDate(),
    publishedAt: data.publishedAt ? (data.publishedAt as Timestamp).toDate() : undefined,
    error: data.error as string | undefined
  };
}

/**
 * Upload images to Firebase Storage and return public URLs
 */
export async function uploadImagesToStorage(images: string[]): Promise<string[]> {
  const userId = getCurrentUserId();
  const urls: string[] = [];
  
  for (let i = 0; i < images.length; i++) {
    const imageData = images[i];
    
    // If already a remote URL, keep it
    if (imageData.startsWith('https://storage.googleapis.com') || 
        imageData.startsWith('https://firebasestorage.googleapis.com')) {
      urls.push(imageData);
      continue;
    }
    
    // Upload to Firebase Storage
    const filename = `scheduled/${userId}/${Date.now()}_${i}.jpg`;
    const storageRef = ref(storage, filename);
    
    // Handle both data URLs and base64 strings
    let base64Data = imageData;
    if (!imageData.startsWith('data:')) {
      base64Data = `data:image/jpeg;base64,${imageData}`;
    }
    
    await uploadString(storageRef, base64Data, 'data_url');
    const url = await getDownloadURL(storageRef);
    urls.push(url);
  }
  
  return urls;
}

/**
 * Create a new scheduled post
 */
export async function createScheduledPost(data: CreateScheduledPostData): Promise<ScheduledPost> {
  const userId = getCurrentUserId();
  
  // Upload images first if they're base64/blob
  const imageUrls = await uploadImagesToStorage(data.imageUrls);
  
  // Build a clean document with only primitive values
  const docData: Record<string, unknown> = {
    sessionId: userId,
    platforms: data.platforms.map(p => String(p)),
    scheduledFor: Timestamp.fromDate(data.scheduledFor),
    status: 'scheduled',
    captions: {
      facebook: String(data.captions.facebook || ''),
      instagram: String(data.captions.instagram || '')
    },
    imageUrls: imageUrls.map(url => String(url)),
    createdAt: Timestamp.now()
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
  
  return {
    id: docRef.id,
    sessionId: userId,
    platforms: data.platforms,
    scheduledFor: data.scheduledFor,
    status: 'scheduled',
    captions: data.captions,
    imageUrls,
    mockupData: data.mockupData,
    createdAt: new Date()
  };
}

/**
 * Get all scheduled posts for the current user
 */
export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  const userId = getCurrentUserId();
  const q = query(
    collection(db, COLLECTION_NAME),
    where('sessionId', '==', userId),
    orderBy('scheduledFor', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToScheduledPost);
}

/**
 * Get scheduled posts for a specific date range
 */
export async function getScheduledPostsInRange(
  startDate: Date,
  endDate: Date
): Promise<ScheduledPost[]> {
  const userId = getCurrentUserId();
  const q = query(
    collection(db, COLLECTION_NAME),
    where('sessionId', '==', userId),
    where('scheduledFor', '>=', Timestamp.fromDate(startDate)),
    where('scheduledFor', '<=', Timestamp.fromDate(endDate)),
    orderBy('scheduledFor', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToScheduledPost);
}

/**
 * Get posts for a specific month (for calendar view)
 */
export async function getPostsForMonth(year: number, month: number): Promise<ScheduledPost[]> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return getScheduledPostsInRange(startDate, endDate);
}

/**
 * Get a single scheduled post by ID
 */
export async function getScheduledPost(postId: string): Promise<ScheduledPost | null> {
  const docRef = doc(db, COLLECTION_NAME, postId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return docToScheduledPost({ id: docSnap.id, data: () => docSnap.data() });
}

/**
 * Update a scheduled post
 */
export async function updateScheduledPost(
  postId: string,
  updates: Partial<Pick<ScheduledPost, 'scheduledFor' | 'captions' | 'platforms' | 'status' | 'error'>>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, postId);
  
  const updateData: Record<string, unknown> = {};
  
  if (updates.scheduledFor) {
    updateData.scheduledFor = Timestamp.fromDate(updates.scheduledFor);
  }
  if (updates.captions) {
    updateData.captions = updates.captions;
  }
  if (updates.platforms) {
    updateData.platforms = updates.platforms;
  }
  if (updates.status) {
    updateData.status = updates.status;
  }
  if (updates.error !== undefined) {
    updateData.error = updates.error;
  }
  
  await updateDoc(docRef, updateData);
}

/**
 * Reschedule a post to a new date/time
 */
export async function reschedulePost(postId: string, newDate: Date): Promise<void> {
  await updateScheduledPost(postId, { 
    scheduledFor: newDate,
    status: 'scheduled',
    error: undefined
  });
}

/**
 * Delete a scheduled post
 */
export async function deleteScheduledPost(postId: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, postId);
  await deleteDoc(docRef);
}

/**
 * Subscribe to real-time updates for scheduled posts
 */
export function subscribeToScheduledPosts(
  callback: (posts: ScheduledPost[]) => void
): Unsubscribe {
  const userId = getCurrentUserId();
  const q = query(
    collection(db, COLLECTION_NAME),
    where('sessionId', '==', userId),
    orderBy('scheduledFor', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(docToScheduledPost);
    callback(posts);
  });
}

/**
 * Get counts of posts by status
 */
export async function getPostStatusCounts(): Promise<Record<PostStatus, number>> {
  const posts = await getScheduledPosts();
  
  return posts.reduce(
    (acc, post) => {
      acc[post.status]++;
      return acc;
    },
    { scheduled: 0, published: 0, failed: 0 } as Record<PostStatus, number>
  );
}

/**
 * Create a local date key (YYYY-MM-DD) from a Date object
 * Uses local timezone to avoid UTC conversion issues
 */
export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get posts grouped by date (for calendar display)
 */
export function groupPostsByDate(posts: ScheduledPost[]): Map<string, ScheduledPost[]> {
  const grouped = new Map<string, ScheduledPost[]>();
  
  for (const post of posts) {
    const dateKey = getLocalDateKey(post.scheduledFor);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(post);
  }
  
  return grouped;
}

/**
 * Retry a failed post (reset status to scheduled)
 */
export async function retryFailedPost(postId: string, newScheduledTime?: Date): Promise<void> {
  await updateScheduledPost(postId, {
    status: 'scheduled',
    scheduledFor: newScheduledTime || new Date(Date.now() + 60000), // Default to 1 minute from now
    error: undefined
  });
}

/**
 * Record an immediately published post (for calendar history)
 */
export async function recordPublishedPost(data: {
  platforms: ('facebook' | 'instagram')[];
  captions: { facebook?: string; instagram?: string };
  imageUrls: string[];
  mockupData: CreateScheduledPostData['mockupData'];
}): Promise<ScheduledPost> {
  const userId = getCurrentUserId();
  
  // Upload images first if they're base64/blob
  const imageUrls = await uploadImagesToStorage(data.imageUrls);
  const now = new Date();
  
  // Build a clean document with only primitive values
  const docData: Record<string, unknown> = {
    sessionId: userId,
    platforms: data.platforms.map(p => String(p)),
    scheduledFor: Timestamp.fromDate(now),
    status: 'published',
    captions: {
      facebook: String(data.captions.facebook || ''),
      instagram: String(data.captions.instagram || '')
    },
    imageUrls: imageUrls.map(url => String(url)),
    createdAt: Timestamp.now(),
    publishedAt: Timestamp.now()
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
  
  return {
    id: docRef.id,
    sessionId: userId,
    platforms: data.platforms,
    scheduledFor: now,
    status: 'published',
    captions: data.captions,
    imageUrls,
    mockupData: data.mockupData,
    createdAt: now,
    publishedAt: now
  };
}

/**
 * Migrate posts from old localStorage-based session to current Firebase Auth user
 * This is a one-time migration function for users who had posts before auth was implemented
 */
export async function migratePostsToCurrentUser(): Promise<{ migrated: number; error?: string }> {
  const newUserId = getCurrentUserId();
  
  // Get the old localStorage-based session ID
  const oldSessionId = localStorage.getItem('socialstitch_user_id');
  
  if (!oldSessionId) {
    return { migrated: 0, error: 'No old session found in localStorage' };
  }
  
  // Don't migrate if old and new IDs are the same
  if (oldSessionId === newUserId) {
    return { migrated: 0, error: 'Old session ID matches current user ID - no migration needed' };
  }
  
  try {
    // Query for all posts with the old session ID
    const q = query(
      collection(db, COLLECTION_NAME),
      where('sessionId', '==', oldSessionId)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { migrated: 0, error: 'No posts found with old session ID' };
    }
    
    // Update each document to use the new user ID
    let migratedCount = 0;
    for (const docSnapshot of snapshot.docs) {
      const docRef = doc(db, COLLECTION_NAME, docSnapshot.id);
      await updateDoc(docRef, { sessionId: newUserId });
      migratedCount++;
    }
    
    // Clear the old localStorage session ID after successful migration
    // (Keep it commented out in case user needs to re-run migration)
    // localStorage.removeItem('socialstitch_user_id');
    
    console.log(`Successfully migrated ${migratedCount} posts to user ${newUserId}`);
    return { migrated: migratedCount };
  } catch (error) {
    console.error('Migration failed:', error);
    return { migrated: 0, error: String(error) };
  }
}

