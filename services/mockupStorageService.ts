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
import { SavedMockup } from '../types';
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
  designId: string
): Promise<SavedMockup> => {
  const userId = getCurrentUserId();
  
  // Upload image to Firebase Storage
  const storageRef = ref(storage, getMockupStoragePath(mockupId));
  const imageBlob = base64ToBlob(base64Image);
  
  await uploadBytes(storageRef, imageBlob, {
    contentType: 'image/png',
    customMetadata: {
      styleDescription,
      designId,
      userId,
    },
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
  }>
): Promise<SavedMockup[]> => {
  const results = await Promise.allSettled(
    mockups.map(m => saveMockupToFirebase(m.id, m.base64Image, m.styleDescription, m.designId))
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
    } as SavedMockup;
  });
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

