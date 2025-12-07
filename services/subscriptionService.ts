/**
 * Subscription Service
 *
 * Manages subscription tiers, usage tracking, and quota enforcement.
 * Data is scoped by shop domain (Shopify embedded) or user ID (standalone).
 *
 * Firestore structure:
 * - shops/{shopDomain}/subscription (single doc)
 * - shops/{shopDomain}/usage/{YYYY-MM} (monthly usage docs)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getCurrentIdentity } from './shopScopedStorageService';
import {
  SubscriptionTier,
  ShopSubscription,
  UsageRecord,
  QuotaCheckResult,
  QuotaExceededError,
  SUBSCRIPTION_TIERS,
  TierConfig,
} from '../types';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the base path for the current identity (shop or user)
 */
function getBasePath(): string {
  const identity = getCurrentIdentity();
  return identity.type === 'shop'
    ? `shops/${identity.id}`
    : `users/${identity.id}`;
}

/**
 * Get current month key in YYYY-MM format
 */
function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get tier config by ID
 */
export function getTierConfig(tier: SubscriptionTier): TierConfig {
  const config = SUBSCRIPTION_TIERS.find((t) => t.id === tier);
  if (!config) {
    throw new Error(`Unknown tier: ${tier}`);
  }
  return config;
}

/**
 * Calculate billing cycle dates (first of month to last of month)
 */
function getBillingCycleDates(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * Get the current subscription for the shop/user
 * Creates a free tier subscription if none exists
 */
export async function getSubscription(): Promise<ShopSubscription> {
  const basePath = getBasePath();
  const docRef = doc(db, basePath, 'subscription');
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      tier: data.tier as SubscriptionTier,
      imageQuota: data.imageQuota,
      billingCycleStart: data.billingCycleStart?.toDate() || new Date(),
      billingCycleEnd: data.billingCycleEnd?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      externalSubscriptionId: data.externalSubscriptionId,
      status: data.status,
    };
  }

  // Create default free tier subscription
  const freeTier = getTierConfig('free');
  const { start, end } = getBillingCycleDates();
  const now = new Date();

  const newSubscription: ShopSubscription = {
    tier: 'free',
    imageQuota: freeTier.imageQuota,
    billingCycleStart: start,
    billingCycleEnd: end,
    createdAt: now,
    updatedAt: now,
    status: 'active',
  };

  await setDoc(docRef, {
    ...newSubscription,
    billingCycleStart: Timestamp.fromDate(start),
    billingCycleEnd: Timestamp.fromDate(end),
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  return newSubscription;
}

/**
 * Update subscription tier
 * Used when upgrading/downgrading or after successful payment
 */
export async function updateSubscriptionTier(
  newTier: SubscriptionTier,
  externalSubscriptionId?: string
): Promise<ShopSubscription> {
  const basePath = getBasePath();
  const docRef = doc(db, basePath, 'subscription');
  const tierConfig = getTierConfig(newTier);
  const { start, end } = getBillingCycleDates();
  const now = new Date();

  const updates: Record<string, unknown> = {
    tier: newTier,
    imageQuota: tierConfig.imageQuota,
    billingCycleStart: Timestamp.fromDate(start),
    billingCycleEnd: Timestamp.fromDate(end),
    updatedAt: Timestamp.fromDate(now),
    status: 'active',
  };

  if (externalSubscriptionId) {
    updates.externalSubscriptionId = externalSubscriptionId;
  }

  // Check if document exists
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    await updateDoc(docRef, updates);
  } else {
    await setDoc(docRef, {
      ...updates,
      createdAt: Timestamp.fromDate(now),
    });
  }

  return {
    tier: newTier,
    imageQuota: tierConfig.imageQuota,
    billingCycleStart: start,
    billingCycleEnd: end,
    createdAt: docSnap.exists() ? docSnap.data().createdAt?.toDate() : now,
    updatedAt: now,
    externalSubscriptionId,
    status: 'active',
  };
}

/**
 * Subscribe to real-time subscription updates
 */
export function subscribeToSubscription(
  callback: (subscription: ShopSubscription | null) => void
): Unsubscribe {
  const basePath = getBasePath();
  const docRef = doc(db, basePath, 'subscription');

  return onSnapshot(docRef, (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }

    const data = docSnap.data();
    callback({
      tier: data.tier as SubscriptionTier,
      imageQuota: data.imageQuota,
      billingCycleStart: data.billingCycleStart?.toDate() || new Date(),
      billingCycleEnd: data.billingCycleEnd?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      externalSubscriptionId: data.externalSubscriptionId,
      status: data.status,
    });
  });
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

/**
 * Get usage for the current month
 */
export async function getCurrentUsage(): Promise<UsageRecord> {
  const basePath = getBasePath();
  const monthKey = getCurrentMonthKey();
  const docRef = doc(db, basePath, 'usage', monthKey);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      imagesGenerated: data.imagesGenerated || 0,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    };
  }

  // No usage record yet this month
  return {
    imagesGenerated: 0,
    lastUpdated: new Date(),
  };
}

/**
 * Get usage for a specific month
 */
export async function getUsageForMonth(year: number, month: number): Promise<UsageRecord> {
  const basePath = getBasePath();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const docRef = doc(db, basePath, 'usage', monthKey);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      imagesGenerated: data.imagesGenerated || 0,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    };
  }

  return {
    imagesGenerated: 0,
    lastUpdated: new Date(),
  };
}

/**
 * Increment usage count after generating an image
 */
export async function incrementUsage(): Promise<UsageRecord> {
  const basePath = getBasePath();
  const monthKey = getCurrentMonthKey();
  const docRef = doc(db, basePath, 'usage', monthKey);
  const now = new Date();

  // Check if document exists
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    await updateDoc(docRef, {
      imagesGenerated: increment(1),
      lastUpdated: Timestamp.fromDate(now),
    });
    
    const data = docSnap.data();
    return {
      imagesGenerated: (data.imagesGenerated || 0) + 1,
      lastUpdated: now,
    };
  } else {
    // Create new usage document
    await setDoc(docRef, {
      imagesGenerated: 1,
      lastUpdated: Timestamp.fromDate(now),
    });
    
    return {
      imagesGenerated: 1,
      lastUpdated: now,
    };
  }
}

/**
 * Subscribe to real-time usage updates
 */
export function subscribeToUsage(callback: (usage: UsageRecord) => void): Unsubscribe {
  const basePath = getBasePath();
  const monthKey = getCurrentMonthKey();
  const docRef = doc(db, basePath, 'usage', monthKey);

  return onSnapshot(docRef, (docSnap) => {
    if (!docSnap.exists()) {
      callback({ imagesGenerated: 0, lastUpdated: new Date() });
      return;
    }

    const data = docSnap.data();
    callback({
      imagesGenerated: data.imagesGenerated || 0,
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
    });
  });
}

// =============================================================================
// QUOTA CHECKING
// =============================================================================

/**
 * Check if the user can generate another image
 * Returns detailed quota information
 */
export async function canGenerateImage(): Promise<QuotaCheckResult> {
  const [subscription, usage] = await Promise.all([
    getSubscription(),
    getCurrentUsage(),
  ]);

  const remaining = Math.max(0, subscription.imageQuota - usage.imagesGenerated);
  const allowed = remaining > 0;

  return {
    allowed,
    used: usage.imagesGenerated,
    quota: subscription.imageQuota,
    remaining,
    tier: subscription.tier,
  };
}

/**
 * Enforce quota before generating an image
 * Throws QuotaExceededError if quota is exhausted
 */
export async function enforceQuota(): Promise<QuotaCheckResult> {
  const result = await canGenerateImage();

  if (!result.allowed) {
    throw new QuotaExceededError(result.used, result.quota, result.tier);
  }

  return result;
}

/**
 * Combined function: check quota, execute generation, increment usage
 * This ensures atomic quota management around image generation
 */
export async function withQuotaEnforcement<T>(
  generateFn: () => Promise<T>
): Promise<T> {
  // Check quota before generation
  await enforceQuota();

  // Generate the image
  const result = await generateFn();

  // Increment usage after successful generation
  await incrementUsage();

  return result;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format price in dollars from cents
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Get next tier for upgrade
 */
export function getUpgradeTier(currentTier: SubscriptionTier): TierConfig | null {
  const tierOrder: SubscriptionTier[] = ['free', 'pro', 'business'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  if (currentIndex < tierOrder.length - 1) {
    return getTierConfig(tierOrder[currentIndex + 1]);
  }
  
  return null; // Already on highest tier
}

/**
 * Calculate days remaining in billing cycle
 */
export function getDaysRemainingInCycle(subscription: ShopSubscription): number {
  const now = new Date();
  const end = subscription.billingCycleEnd;
  const diffTime = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

