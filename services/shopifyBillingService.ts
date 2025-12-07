/**
 * Shopify Billing Service
 *
 * Frontend service for managing subscriptions via Shopify Billing API.
 * Handles upgrade/downgrade flows, subscription status checks, and redirects.
 */

import { SubscriptionTier, SUBSCRIPTION_TIERS, TierConfig } from '../types';
import { getSessionToken, getShopDomain } from './shopifyProductService';

// Get the functions URL from environment
const getFunctionsUrl = () => {
  return import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || '';
};

// Check if we're in development mode (bypass billing for local testing)
const isDevelopmentMode = () => {
  return import.meta.env.DEV || 
         import.meta.env.VITE_BILLING_DEV_MODE === 'true' ||
         window.location.hostname === 'localhost';
};

/**
 * Shopify subscription status from the API
 */
export interface ShopifySubscription {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  currentPeriodEnd: string | null;
  test: boolean;
  lineItems?: Array<{
    id: string;
    plan: {
      pricingDetails: {
        price: { amount: string; currencyCode: string };
        interval: string;
      };
    };
  }>;
}

/**
 * Local subscription record from Firestore
 */
export interface LocalSubscription {
  tier: SubscriptionTier;
  imageQuota: number;
  billingCycleStart: { seconds: number };
  billingCycleEnd: { seconds: number };
  externalSubscriptionId?: string;
  status: 'active' | 'cancelled' | 'past_due';
  isTest?: boolean;
  cancelledAt?: { seconds: number };
}

/**
 * Result from subscription status check
 */
export interface SubscriptionStatusResult {
  tier: SubscriptionTier;
  subscription: ShopifySubscription | null;
  localSubscription: LocalSubscription | null;
  activeSubscriptions: ShopifySubscription[];
}

/**
 * Result from initiating an upgrade
 */
export interface UpgradeResult {
  confirmationUrl: string;
  subscriptionId?: string;
}

/**
 * Error thrown for billing-related issues
 */
export class BillingError extends Error {
  public readonly code: string;
  public readonly userErrors?: Array<{ field: string; message: string }>;

  constructor(message: string, code: string = 'BILLING_ERROR', userErrors?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'BillingError';
    this.code = code;
    this.userErrors = userErrors;
  }
}

/**
 * Make an authenticated request to our billing API
 * Uses session token if available, otherwise falls back to shop domain
 */
async function billingApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const functionsUrl = getFunctionsUrl();
  if (!functionsUrl) {
    throw new BillingError('Firebase Functions URL not configured', 'CONFIG_ERROR');
  }

  // Build URL - add shop param if no session token
  let url = `${functionsUrl}/${endpoint}`;
  const sessionToken = getSessionToken();
  const shopDomain = getShopDomain();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (sessionToken) {
    // Use session token if available
    headers['Authorization'] = `Bearer ${sessionToken}`;
  } else if (shopDomain) {
    // Fall back to shop domain - backend will use stored access token
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}shop=${encodeURIComponent(shopDomain)}`;
    console.log('[billingApiRequest] Using shop domain auth:', shopDomain);
  } else {
    throw new BillingError('No session token or shop domain available. Please authenticate with Shopify.', 'NO_SESSION');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new BillingError(
      errorData.error || `Billing API error: ${response.status}`,
      errorData.code || 'API_ERROR',
      errorData.userErrors
    );
  }

  return response.json();
}

/**
 * Get the current subscription status
 * Returns both Shopify subscription and local Firestore record
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatusResult> {
  return billingApiRequest<SubscriptionStatusResult>('shopifyGetActiveSubscription');
}

/**
 * Initiate an upgrade to a paid tier
 * Returns a confirmation URL that the merchant must be redirected to
 * 
 * @param tier - The tier to upgrade to ('pro' or 'business')
 * @returns UpgradeResult with confirmationUrl
 */
export async function initiateUpgrade(tier: SubscriptionTier): Promise<UpgradeResult> {
  if (tier === 'free') {
    throw new BillingError('Cannot initiate upgrade to free tier', 'INVALID_TIER');
  }

  // In development mode, we can bypass the actual Shopify billing
  if (isDevelopmentMode() && import.meta.env.VITE_BILLING_BYPASS === 'true') {
    console.log('[shopifyBillingService] Development mode: bypassing Shopify billing');
    // Return a fake confirmation URL that would be handled by the app
    return {
      confirmationUrl: `${window.location.origin}?billing_success=${tier}&dev_bypass=true`,
      subscriptionId: `dev_${tier}_${Date.now()}`,
    };
  }

  const result = await billingApiRequest<UpgradeResult>('shopifyCreateSubscription', {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });

  return result;
}

/**
 * Cancel the current subscription
 * Note: Subscription remains active until the end of the billing period
 * 
 * @param subscriptionId - The Shopify subscription ID to cancel
 */
export async function cancelSubscription(subscriptionId: string): Promise<{ success: boolean }> {
  return billingApiRequest<{ success: boolean; subscription: ShopifySubscription }>('shopifyCancelSubscription', {
    method: 'POST',
    body: JSON.stringify({ subscriptionId }),
  });
}

/**
 * Redirect the merchant to Shopify's payment approval page
 * Uses App Bridge for embedded apps, falls back to window redirect
 * 
 * @param confirmationUrl - URL from initiateUpgrade result
 */
export function redirectToPaymentApproval(confirmationUrl: string): void {
  // Check if we have App Bridge available
  const appBridge = (window as any).__SHOPIFY_APP_BRIDGE__;
  
  if (appBridge) {
    try {
      // Use App Bridge redirect for embedded apps
      const { Redirect } = require('@shopify/app-bridge/actions');
      const redirect = Redirect.create(appBridge);
      redirect.dispatch(Redirect.Action.REMOTE, confirmationUrl);
      return;
    } catch (e) {
      console.error('[shopifyBillingService] App Bridge redirect failed:', e);
    }
  }

  // Fallback: handle iframe context
  if (window.top !== window.self) {
    try {
      window.top!.location.href = confirmationUrl;
    } catch (e) {
      window.open(confirmationUrl, '_top');
    }
  } else {
    window.location.href = confirmationUrl;
  }
}

/**
 * Full upgrade flow: create subscription and redirect to approval
 * 
 * @param tier - The tier to upgrade to
 * @returns Promise that resolves when redirect is initiated
 */
export async function upgradeToTier(tier: SubscriptionTier): Promise<void> {
  const { confirmationUrl } = await initiateUpgrade(tier);
  redirectToPaymentApproval(confirmationUrl);
}

/**
 * Handle billing callback parameters in the URL
 * Call this on app load to check for billing success/failure
 * 
 * @returns Billing callback result or null if no callback params
 */
export function handleBillingCallback(): {
  success: boolean;
  tier?: SubscriptionTier;
  error?: string;
  declined?: boolean;
} | null {
  const params = new URLSearchParams(window.location.search);
  
  // Check for success
  const billingSuccess = params.get('billing_success');
  if (billingSuccess) {
    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete('billing_success');
    url.searchParams.delete('dev_bypass');
    window.history.replaceState({}, '', url.toString());
    
    return {
      success: true,
      tier: billingSuccess as SubscriptionTier,
    };
  }
  
  // Check for declined
  if (params.get('billing_declined') === 'true') {
    const url = new URL(window.location.href);
    url.searchParams.delete('billing_declined');
    window.history.replaceState({}, '', url.toString());
    
    return {
      success: false,
      declined: true,
    };
  }
  
  // Check for error
  const billingError = params.get('billing_error');
  if (billingError) {
    const url = new URL(window.location.href);
    url.searchParams.delete('billing_error');
    window.history.replaceState({}, '', url.toString());
    
    return {
      success: false,
      error: billingError,
    };
  }
  
  return null;
}

/**
 * Get tier configuration by ID
 */
export function getTierConfig(tier: SubscriptionTier): TierConfig | undefined {
  return SUBSCRIPTION_TIERS.find(t => t.id === tier);
}

/**
 * Get the next upgrade tier from current tier
 */
export function getNextUpgradeTier(currentTier: SubscriptionTier): TierConfig | null {
  const tierOrder: SubscriptionTier[] = ['free', 'pro', 'business'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  if (currentIndex < tierOrder.length - 1) {
    const nextTier = tierOrder[currentIndex + 1];
    return SUBSCRIPTION_TIERS.find(t => t.id === nextTier) || null;
  }
  
  return null;
}

/**
 * Check if a tier is an upgrade from current
 */
export function isUpgrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
  const tierOrder: SubscriptionTier[] = ['free', 'pro', 'business'];
  return tierOrder.indexOf(targetTier) > tierOrder.indexOf(currentTier);
}

/**
 * Check if a tier is a downgrade from current
 */
export function isDowngrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
  const tierOrder: SubscriptionTier[] = ['free', 'pro', 'business'];
  return tierOrder.indexOf(targetTier) < tierOrder.indexOf(currentTier);
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Calculate days remaining until subscription ends
 */
export function getDaysRemaining(billingCycleEnd: { seconds: number } | Date): number {
  const endDate = billingCycleEnd instanceof Date 
    ? billingCycleEnd 
    : new Date(billingCycleEnd.seconds * 1000);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}


