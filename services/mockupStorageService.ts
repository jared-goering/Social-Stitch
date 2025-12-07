/**
 * Mockup Storage Service
 * 
 * Handles uploading mockups to Firebase Storage and saving metadata to Firestore.
 * Provides functions to fetch, save, and delete user's mockup history.
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db, storage } from './firebaseConfig';
import { SavedMockup, SourceProduct } from '../types';
import { getSessionId } from './socialAuthService';

/**
 * Get the current user/shop ID for storage
 */
function getCurrentUserId(): string {
  return getSessionId();
}

// Collection path for user mockups
const getUserMockupsCollection = () => {
  const userId = getCurrentUserId();
  return collection(db, 'users', userId, 'mockups');
};

// Storage path for mockup images
const getMockupStoragePath = (mockupId: string) => {
  const userId = getCurrentUserId();
  return `mockups/${userId}/${mockupId}.png`;
};

/**
 * Convert a base64 data URL to a Blob
 */
const base64ToBlob = (base64: string): Blob => {
  // Handle both raw base64 and data URLs
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
 * Upload a mockup image to Firebase Storage and save metadata to Firestore
 */
export const saveMockupToFirebase = async (
  mockupId: string,
  base64Image: string,
  styleDescription: string,
  designId: string,
  sourceProduct?: SourceProduct
): Promise<SavedMockup> => {
  const userId = getCurrentUserId();
  
  // Upload image to Firebase Storage
  const storageRef = ref(storage, getMockupStoragePath(mockupId));
  const imageBlob = base64ToBlob(base64Image);
  
  // Build custom metadata (Firebase Storage metadata values must be strings)
  const customMetadata: Record<string, string> = {
    styleDescription,
    designId,
    userId,
  };
  
  // Add source product metadata if provided
  if (sourceProduct) {
    customMetadata.sourceProductId = String(sourceProduct.id);
    customMetadata.sourceProductTitle = sourceProduct.title;
    customMetadata.sourceProductHandle = sourceProduct.handle;
  }
  
  await uploadBytes(storageRef, imageBlob, {
    contentType: 'image/png',
    customMetadata,
  });
  
  // Get the download URL
  const imageUrl = await getDownloadURL(storageRef);
  
  // Save metadata to Firestore
  const mockupData: SavedMockup = {
    id: mockupId,
    imageUrl,
    styleDescription,
    designId,
    createdAt: new Date(),
    sourceProduct,
  };
  
  const docRef = doc(getUserMockupsCollection(), mockupId);
  await setDoc(docRef, {
    ...mockupData,
    createdAt: Timestamp.fromDate(mockupData.createdAt),
  });
  
  return mockupData;
};

/**
 * Batch save multiple mockups to Firebase
 * Returns array of successfully saved mockups
 */
export const saveMockupsToFirebase = async (
  mockups: Array<{
    id: string;
    base64Image: string;
    styleDescription: string;
    designId: string;
    sourceProduct?: SourceProduct;
  }>
): Promise<SavedMockup[]> => {
  const results = await Promise.allSettled(
    mockups.map(m => saveMockupToFirebase(m.id, m.base64Image, m.styleDescription, m.designId, m.sourceProduct))
  );
  
  return results
    .filter((r): r is PromiseFulfilledResult<SavedMockup> => r.status === 'fulfilled')
    .map(r => r.value);
};

/**
 * Fetch all mockups for the current user from Firestore
 * Returns mockups sorted by creation date (newest first)
 */
export const fetchUserMockups = async (): Promise<SavedMockup[]> => {
  const mockupsQuery = query(
    getUserMockupsCollection(),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(mockupsQuery);
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      imageUrl: data.imageUrl,
      styleDescription: data.styleDescription,
      designId: data.designId,
      createdAt: data.createdAt?.toDate() || new Date(),
      sourceProduct: data.sourceProduct,
      originalImageUrl: data.originalImageUrl || undefined,
    } as SavedMockup;
  });
};

/**
 * Update a mockup's image (for cropping)
 * Uploads the new cropped image and preserves the original URL for revert functionality
 */
export const updateMockupImage = async (
  mockup: SavedMockup,
  croppedBase64Image: string
): Promise<SavedMockup> => {
  const userId = getCurrentUserId();
  
  // Upload cropped image to Firebase Storage (overwrites existing)
  const storageRef = ref(storage, getMockupStoragePath(mockup.id));
  const imageBlob = base64ToBlob(croppedBase64Image);
  
  await uploadBytes(storageRef, imageBlob, {
    contentType: 'image/png',
    customMetadata: {
      styleDescription: mockup.styleDescription,
      designId: mockup.designId,
      userId,
      cropped: 'true',
    },
  });
  
  // Get the new download URL (with updated token)
  const newImageUrl = await getDownloadURL(storageRef);
  
  // Preserve the original image URL if this is the first crop
  const originalImageUrl = mockup.originalImageUrl || mockup.imageUrl;
  
  // Update Firestore document
  const updatedMockup: SavedMockup = {
    ...mockup,
    imageUrl: newImageUrl,
    originalImageUrl,
  };
  
  // Build Firestore document data, excluding undefined values
  const firestoreData: Record<string, any> = {
    id: updatedMockup.id,
    imageUrl: updatedMockup.imageUrl,
    styleDescription: updatedMockup.styleDescription,
    designId: updatedMockup.designId,
    createdAt: Timestamp.fromDate(mockup.createdAt),
    originalImageUrl: updatedMockup.originalImageUrl,
  };
  
  // Only include sourceProduct if it exists
  if (updatedMockup.sourceProduct) {
    firestoreData.sourceProduct = updatedMockup.sourceProduct;
  }
  
  const docRef = doc(getUserMockupsCollection(), mockup.id);
  await setDoc(docRef, firestoreData);
  
  return updatedMockup;
};

/**
 * Revert a mockup to its original uncropped image
 */
export const revertMockupToOriginal = async (
  mockup: SavedMockup
): Promise<SavedMockup> => {
  if (!mockup.originalImageUrl) {
    throw new Error('No original image to revert to');
  }
  
  // Update Firestore to use original URL and clear originalImageUrl
  const updatedMockup: SavedMockup = {
    ...mockup,
    imageUrl: mockup.originalImageUrl,
    originalImageUrl: undefined,
  };
  
  const docRef = doc(getUserMockupsCollection(), mockup.id);
  await setDoc(docRef, {
    ...updatedMockup,
    createdAt: Timestamp.fromDate(mockup.createdAt),
    originalImageUrl: null, // Firestore needs explicit null to remove field
  });
  
  return updatedMockup;
};

/**
 * Delete a mockup from both Storage and Firestore
 */
export const deleteMockupFromFirebase = async (mockupId: string): Promise<void> => {
  // Delete from Storage
  const storageRef = ref(storage, getMockupStoragePath(mockupId));
  try {
    await deleteObject(storageRef);
  } catch (error: any) {
    // Ignore if file doesn't exist
    if (error.code !== 'storage/object-not-found') {
      throw error;
    }
  }
  
  // Delete from Firestore
  const docRef = doc(getUserMockupsCollection(), mockupId);
  await deleteDoc(docRef);
};

/**
 * Delete multiple mockups
 */
export const deleteMockupsFromFirebase = async (mockupIds: string[]): Promise<void> => {
  await Promise.all(mockupIds.map(id => deleteMockupFromFirebase(id)));
};

