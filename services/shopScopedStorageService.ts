/**
 * Shop-Scoped Storage Service
 *
 * Provides data storage scoped by Shopify shop domain.
 * Used when running as an embedded Shopify app.
 *
 * Data structure:
 * - shops/{shopDomain}/mockups/{mockupId}
 * - shops/{shopDomain}/scheduledPosts/{postId}
 * - shops/{shopDomain}/settings
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, uploadString } from 'firebase/storage';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  where,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, storage } from './firebaseConfig';
import { SavedMockup, ScheduledPost, CreateScheduledPostData, PostStatus, SocialPlatform } from '../types';
import { shopifyConfig } from '../shopify.config';
import { getSessionId } from './socialAuthService';

/**
 * Get the current identity (shop domain or user ID)
 * Returns shop domain when running as Shopify app, user ID otherwise
 */
export function getCurrentIdentity(): { type: 'shop' | 'user'; id: string } {
  const sessionId = getSessionId();
  
  // Check if this is a shop domain (contains .myshopify.com)
  if (sessionId.includes('.myshopify.com') || shopifyConfig.isEmbedded) {
    return { type: 'shop', id: sessionId };
  }
  
  return { type: 'user', id: sessionId };
}

/**
 * Get the collection path for the current identity
 */
function getCollectionPath(subcollection: string): string {
  const identity = getCurrentIdentity();
  return identity.type === 'shop'
    ? `shops/${identity.id}/${subcollection}`
    : `users/${identity.id}/${subcollection}`;
}

/**
 * Get the storage path for the current identity
 */
function getStoragePath(folder: string, filename: string): string {
  const identity = getCurrentIdentity();
  return identity.type === 'shop'
    ? `shops/${identity.id}/${folder}/${filename}`
    : `${folder}/${identity.id}/${filename}`;
}

// =============================================================================
// MOCKUPS
// =============================================================================

/**
 * Convert a base64 data URL to a Blob
 */
const base64ToBlob = (base64: string): Blob => {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const mimeType = base64.includes('data:')
    ? base64.split(';')[0].split(':')[1]
    : 'image/png';

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Save a mockup to Firebase Storage and Firestore
 */
export async function saveMockup(
  mockupId: string,
  base64Image: string,
  styleDescription: string,
  designId: string,
  productId?: number
): Promise<SavedMockup> {
  const identity = getCurrentIdentity();

  // Upload image to Firebase Storage
  const storagePath = getStoragePath('mockups', `${mockupId}.png`);
  const storageRef = ref(storage, storagePath);
  const imageBlob = base64ToBlob(base64Image);

  await uploadBytes(storageRef, imageBlob, {
    contentType: 'image/png',
    customMetadata: {
      styleDescription,
      designId,
      ...(identity.type === 'shop' ? { shop: identity.id } : { userId: identity.id }),
      ...(productId ? { productId: productId.toString() } : {}),
    },
  });

  // Get the download URL
  const imageUrl = await getDownloadURL(storageRef);

  // Save metadata to Firestore
  const mockupData: SavedMockup & { productId?: number } = {
    id: mockupId,
    imageUrl,
    styleDescription,
    designId,
    createdAt: new Date(),
    ...(productId ? { productId } : {}),
  };

  const collectionPath = getCollectionPath('mockups');
  const docRef = doc(collection(db, collectionPath), mockupId);
  await setDoc(docRef, {
    ...mockupData,
    createdAt: Timestamp.fromDate(mockupData.createdAt),
  });

  return mockupData;
}

/**
 * Fetch all mockups
 */
export async function fetchMockups(): Promise<SavedMockup[]> {
  const collectionPath = getCollectionPath('mockups');
  const mockupsQuery = query(
    collection(db, collectionPath),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(mockupsQuery);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      imageUrl: data.imageUrl,
      styleDescription: data.styleDescription,
      designId: data.designId,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as SavedMockup;
  });
}

/**
 * Delete a mockup
 */
export async function deleteMockup(mockupId: string): Promise<void> {
  // Delete from Storage
  const storagePath = getStoragePath('mockups', `${mockupId}.png`);
  const storageRef = ref(storage, storagePath);
  try {
    await deleteObject(storageRef);
  } catch (error: any) {
    if (error.code !== 'storage/object-not-found') {
      throw error;
    }
  }

  // Delete from Firestore
  const collectionPath = getCollectionPath('mockups');
  const docRef = doc(collection(db, collectionPath), mockupId);
  await deleteDoc(docRef);
}

// =============================================================================
// SCHEDULED POSTS
// =============================================================================

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
    error: data.error as string | undefined,
  };
}

/**
 * Upload images to Firebase Storage
 */
export async function uploadImages(images: string[]): Promise<string[]> {
  const urls: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const imageData = images[i];

    // If already a remote URL, keep it
    if (
      imageData.startsWith('https://storage.googleapis.com') ||
      imageData.startsWith('https://firebasestorage.googleapis.com')
    ) {
      urls.push(imageData);
      continue;
    }

    // Upload to Firebase Storage
    const filename = `${Date.now()}_${i}.jpg`;
    const storagePath = getStoragePath('scheduled', filename);
    const storageRef = ref(storage, storagePath);

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
 * Create a scheduled post
 */
export async function createScheduledPost(data: CreateScheduledPostData): Promise<ScheduledPost> {
  const identity = getCurrentIdentity();

  // Upload images first if they're base64/blob
  const imageUrls = await uploadImages(data.imageUrls);

  // Build a clean document
  const docData: Record<string, unknown> = {
    sessionId: identity.id,
    identityType: identity.type,
    platforms: data.platforms.map((p) => String(p)),
    scheduledFor: Timestamp.fromDate(data.scheduledFor),
    status: 'scheduled',
    captions: {
      facebook: String(data.captions.facebook || ''),
      instagram: String(data.captions.instagram || ''),
    },
    imageUrls: imageUrls.map((url) => String(url)),
    createdAt: Timestamp.now(),
  };

  const collectionPath = getCollectionPath('scheduledPosts');
  const docRef = await addDoc(collection(db, collectionPath), docData);

  return {
    id: docRef.id,
    sessionId: identity.id,
    platforms: data.platforms,
    scheduledFor: data.scheduledFor,
    status: 'scheduled',
    captions: data.captions,
    imageUrls,
    mockupData: data.mockupData,
    createdAt: new Date(),
  };
}

/**
 * Get all scheduled posts
 */
export async function getScheduledPosts(): Promise<ScheduledPost[]> {
  const collectionPath = getCollectionPath('scheduledPosts');
  const q = query(collection(db, collectionPath), orderBy('scheduledFor', 'asc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToScheduledPost);
}

/**
 * Get posts for a specific month
 */
export async function getPostsForMonth(year: number, month: number): Promise<ScheduledPost[]> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const collectionPath = getCollectionPath('scheduledPosts');
  const q = query(
    collection(db, collectionPath),
    where('scheduledFor', '>=', Timestamp.fromDate(startDate)),
    where('scheduledFor', '<=', Timestamp.fromDate(endDate)),
    orderBy('scheduledFor', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToScheduledPost);
}

/**
 * Get a single scheduled post
 */
export async function getScheduledPost(postId: string): Promise<ScheduledPost | null> {
  const collectionPath = getCollectionPath('scheduledPosts');
  const docRef = doc(db, collectionPath, postId);
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
  const collectionPath = getCollectionPath('scheduledPosts');
  const docRef = doc(db, collectionPath, postId);

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
 * Reschedule a post
 */
export async function reschedulePost(postId: string, newDate: Date): Promise<void> {
  await updateScheduledPost(postId, {
    scheduledFor: newDate,
    status: 'scheduled',
    error: undefined,
  });
}

/**
 * Delete a scheduled post
 */
export async function deleteScheduledPost(postId: string): Promise<void> {
  const collectionPath = getCollectionPath('scheduledPosts');
  const docRef = doc(db, collectionPath, postId);
  await deleteDoc(docRef);
}

/**
 * Subscribe to real-time updates
 */
export function subscribeToScheduledPosts(callback: (posts: ScheduledPost[]) => void): Unsubscribe {
  const collectionPath = getCollectionPath('scheduledPosts');
  const q = query(collection(db, collectionPath), orderBy('scheduledFor', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(docToScheduledPost);
    callback(posts);
  });
}

/**
 * Record an immediately published post
 */
export async function recordPublishedPost(data: {
  platforms: ('facebook' | 'instagram')[];
  captions: { facebook?: string; instagram?: string };
  imageUrls: string[];
  mockupData: CreateScheduledPostData['mockupData'];
}): Promise<ScheduledPost> {
  const identity = getCurrentIdentity();

  // Upload images first if they're base64/blob
  const imageUrls = await uploadImages(data.imageUrls);
  const now = new Date();

  const docData: Record<string, unknown> = {
    sessionId: identity.id,
    identityType: identity.type,
    platforms: data.platforms.map((p) => String(p)),
    scheduledFor: Timestamp.fromDate(now),
    status: 'published',
    captions: {
      facebook: String(data.captions.facebook || ''),
      instagram: String(data.captions.instagram || ''),
    },
    imageUrls: imageUrls.map((url) => String(url)),
    createdAt: Timestamp.now(),
    publishedAt: Timestamp.now(),
  };

  const collectionPath = getCollectionPath('scheduledPosts');
  const docRef = await addDoc(collection(db, collectionPath), docData);

  return {
    id: docRef.id,
    sessionId: identity.id,
    platforms: data.platforms,
    scheduledFor: now,
    status: 'published',
    captions: data.captions,
    imageUrls,
    mockupData: data.mockupData,
    createdAt: now,
    publishedAt: now,
  };
}

// =============================================================================
// SHOP SETTINGS
// =============================================================================

export interface ShopSettings {
  defaultCaptionTone?: string;
  preferredPlatforms?: SocialPlatform[];
  autoScheduleTime?: string; // e.g., "09:00"
  timezone?: string;
}

/**
 * Get shop settings
 */
export async function getSettings(): Promise<ShopSettings> {
  const collectionPath = getCollectionPath('settings');
  const docRef = doc(db, collectionPath, 'preferences');
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return {};
  }

  return docSnap.data() as ShopSettings;
}

/**
 * Update shop settings
 */
export async function updateSettings(settings: Partial<ShopSettings>): Promise<void> {
  const collectionPath = getCollectionPath('settings');
  const docRef = doc(db, collectionPath, 'preferences');
  await setDoc(docRef, settings, { merge: true });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a local date key (YYYY-MM-DD) from a Date object
 */
export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get posts grouped by date
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
 * Get post status counts
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

