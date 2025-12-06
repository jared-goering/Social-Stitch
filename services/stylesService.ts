/**
 * Styles Service - Handles saving and loading apparel styles from Firebase
 */

import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from './firebaseConfig';
import { SavedStyle } from '../types';
import { getSessionId } from './socialAuthService';

const STYLES_COLLECTION = 'styles';

/**
 * Get the current user/shop ID for storage
 */
function getCurrentUserId(): string {
  return getSessionId();
}

/**
 * Save a new style to Firebase
 */
export async function saveStyle(file: File, name?: string): Promise<SavedStyle> {
  const userId = getCurrentUserId();
  const styleId = crypto.randomUUID();
  const styleName = name || file.name.replace(/\.[^/.]+$/, '') || 'Untitled Style';
  
  // Upload image to Storage
  const storageRef = ref(storage, `styles/${userId}/${styleId}`);
  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);
  
  // Save metadata to Firestore
  const styleData = {
    userId,
    name: styleName,
    imageUrl,
    storagePath: `styles/${userId}/${styleId}`,
    createdAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, STYLES_COLLECTION), styleData);
  
  return {
    id: docRef.id,
    imageUrl,
    name: styleName,
    createdAt: styleData.createdAt.toDate(),
  };
}

/**
 * Get all saved styles for the current user
 */
export async function getSavedStyles(): Promise<SavedStyle[]> {
  const userId = getCurrentUserId();
  
  try {
    // Try the optimized query with index
    const q = query(
      collection(db, STYLES_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const styles: SavedStyle[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      styles.push({
        id: doc.id,
        imageUrl: data.imageUrl,
        name: data.name,
        createdAt: data.createdAt.toDate(),
      });
    });
    
    return styles;
  } catch (error: any) {
    // If index is building, fall back to simpler query
    if (error?.code === 'failed-precondition') {
      console.log('Index still building, using fallback query...');
      const q = query(
        collection(db, STYLES_COLLECTION),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      const styles: SavedStyle[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        styles.push({
          id: doc.id,
          imageUrl: data.imageUrl,
          name: data.name,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });
      
      // Sort in memory
      styles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return styles;
    }
    throw error;
  }
}

/**
 * Delete a saved style
 */
export async function deleteStyle(styleId: string): Promise<void> {
  const userId = getCurrentUserId();
  
  // Get the document to find the storage path
  const docRef = doc(db, STYLES_COLLECTION, styleId);
  
  // Find the storage path from the styles collection
  const q = query(collection(db, STYLES_COLLECTION), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  let storagePath: string | null = null;
  snapshot.forEach((d) => {
    if (d.id === styleId) {
      storagePath = d.data().storagePath;
    }
  });
  
  // Delete from Storage if path exists
  if (storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (e) {
      console.warn('Failed to delete image from storage:', e);
    }
  }
  
  // Delete from Firestore
  await deleteDoc(docRef);
}
