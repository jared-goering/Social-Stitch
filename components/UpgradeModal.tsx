/**
 * Upgrade Modal Component
 *
 * Shown when user exhausts their quota or clicks upgrade.
 * Displays tier comparison and upgrade options.
 * 
 * Integrates with Shopify Billing API for embedded apps,
 * with fallback to direct update for development/standalone mode.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Zap, Sparkles, Building2, ExternalLink, Loader2 } from 'lucide-react';
import {
  SUBSCRIPTION_TIERS,
  SubscriptionTier,
  TierConfig,
  QuotaCheckResult,
} from '../types';
import { formatPrice, updateSubscriptionTier } from '../services/subscriptionService';
import {
  initiateUpgrade,
  redirectToPaymentApproval,
  isUpgrade as checkIsUpgrade,
  isDowngrade as checkIsDowngrade,
  BillingError,
} from '../services/shopifyBillingService';
import { getSessionToken, getShopDomain, redirectToOAuth } from '../services/shopifyProductService';

interface UpgradeModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Current quota status (if available) */
  quotaStatus?: QuotaCheckResult;
  /** Callback after successful upgrade */
  onUpgradeSuccess?: (newTier: SubscriptionTier) => void;
  /** Force demo mode (bypass Shopify billing) */
  demoMode?: boolean;
}

/**
 * Check if we're running as a Shopify embedded app
 */
function isShopifyContext(): boolean {
  // Check if we have a Shopify session token or shop domain
  const hasSessionToken = !!getSessionToken();
  const hasShopDomain = !!getShopDomain();
  // Check if we're in an iframe (embedded app)
  const isEmbedded = window.top !== window.self;
  // Check for Shopify-specific URL params
  const hasShopParam = new URLSearchParams(window.location.search).has('shop');
  
  return hasSessionToken || hasShopDomain || (isEmbedded && hasShopParam);
}

// Map tiers to icons
const TIER_ICONS: Record<SubscriptionTier, React.ReactNode> = {
  free: <Zap size={24} />,
  pro: <Sparkles size={24} />,
  business: <Building2 size={24} />,
};

export function UpgradeModal({
  isOpen,
  onClose,
  quotaStatus,
  onUpgradeSuccess,
  demoMode = false,
}: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if we should use Shopify billing
  const useShopifyBilling = !demoMode && isShopifyContext();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTier = quotaStatus?.tier || 'free';

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === currentTier) return;
    
    console.log('[UpgradeModal] handleUpgrade called with tier:', tier);
    console.log('[UpgradeModal] useShopifyBilling:', useShopifyBilling);
    console.log('[UpgradeModal] demoMode:', demoMode);
    console.log('[UpgradeModal] isShopifyContext:', isShopifyContext());
    
    setSelectedTier(tier);
    setUpgrading(true);
    setError(null);

    try {
      // Check if this is an upgrade to a paid tier
      const isUpgradeToPaid = checkIsUpgrade(currentTier, tier) && tier !== 'free';
      console.log('[UpgradeModal] isUpgradeToPaid:', isUpgradeToPaid);
      
      if (useShopifyBilling && isUpgradeToPaid) {
        // Use Shopify Billing API for upgrades to paid tiers
        console.log('[UpgradeModal] Initiating Shopify billing for tier:', tier);
        
        const { confirmationUrl } = await initiateUpgrade(tier);
        console.log('[UpgradeModal] Got confirmationUrl:', confirmationUrl);
        
        // Show redirecting state
        setRedirecting(true);
        
        // Redirect to Shopify payment approval page
        // This will navigate away from the app
        redirectToPaymentApproval(confirmationUrl);
        
        // Note: The page will redirect, so we don't close the modal here
        // The success callback will be triggered when the user returns
        return;
      }
      
      // For downgrades or demo mode, update directly
      // In demo mode, we bypass Shopify billing
      console.log('[UpgradeModal] Direct tier update (demo/downgrade):', tier);
      await updateSubscriptionTier(tier);
      
      onUpgradeSuccess?.(tier);
      onClose();
    } catch (err) {
      console.error('[UpgradeModal] Upgrade failed:', err);
      
      let errorMessage = 'Failed to process upgrade. Please try again.';
      let errorDetails = '';
      let needsReauth = false;
      
      if (err instanceof BillingError) {
        // Check if this requires re-authentication
        needsReauth = err.requiresReinstall();
        
        // Log additional details for debugging
        console.error('[UpgradeModal] BillingError details:', {
          code: err.code,
          message: err.message,
          requestId: err.requestId,
          action: err.action,
          hint: err.hint,
          userErrors: err.userErrors,
          needsReauth,
        });
        
        if (needsReauth) {
          // Automatically redirect to OAuth to get fresh token
          console.log('[UpgradeModal] Token expired - redirecting to OAuth for fresh token');
          setError('Refreshing authorization... Please wait.');
          setRedirecting(true);
          
          // Small delay so user sees the message
          setTimeout(() => {
            redirectToOAuth();
          }, 1000);
          return; // Don't reset state - we're redirecting
        } else {
          errorMessage = err.hint || err.message;
        }
        
        // Build error details for display
        const details: string[] = [];
        if (err.code) details.push(err.code);
        if (err.requestId) details.push(err.requestId);
        errorDetails = details.join(' | ');
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      // Add error details to help with debugging/support
      if (errorDetails) {
        setError(`${errorMessage} (${errorDetails})`);
      } else {
        setError(errorMessage);
      }
      
      // Reset state (only if not redirecting)
      setUpgrading(false);
      setSelectedTier(null);
    }
  };

  const handleDowngrade = async (tier: SubscriptionTier) => {
    if (tier === currentTier) return;
    
    setSelectedTier(tier);
    setUpgrading(true);
    setError(null);

    try {
      // Downgrades go through direct update
      // The subscription will remain active until end of billing period
      // then automatically revert to the free tier via webhook
      console.log('[UpgradeModal] Processing downgrade to:', tier);
      
      if (tier === 'free') {
        // For downgrade to free, we just update the local record
        // The actual cancellation is handled by Shopify webhook
        // when the current billing period ends
        await updateSubscriptionTier(tier);
      } else {
        // Downgrade to a lower paid tier - use Shopify billing
        if (useShopifyBilling) {
          const { confirmationUrl } = await initiateUpgrade(tier);
          setRedirecting(true);
          redirectToPaymentApproval(confirmationUrl);
          return;
        }
        await updateSubscriptionTier(tier);
      }
      
      onUpgradeSuccess?.(tier);
      onClose();
    } catch (err) {
      console.error('[UpgradeModal] Downgrade failed:', err);
      
      // Check if this requires re-authentication
      if (err instanceof BillingError && err.requiresReinstall()) {
        console.log('[UpgradeModal] Token expired during downgrade - redirecting to OAuth');
        setError('Refreshing authorization... Please wait.');
        setRedirecting(true);
        setTimeout(() => {
          redirectToOAuth();
        }, 1000);
        return;
      }
      
      setError('Failed to process plan change. Please try again.');
      setUpgrading(false);
      setSelectedTier(null);
    }
  };

  const modalContent = (
    <div className="upgrade-modal-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <button className="upgrade-modal__close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="upgrade-modal__header">
          {quotaStatus && quotaStatus.remaining === 0 ? (
            <>
              <div className="upgrade-modal__icon upgrade-modal__icon--warning">
                <Zap size={32} />
              </div>
              <h2>Monthly Quota Reached</h2>
              <p>
                You've used all {quotaStatus.quota} image generations this month.
                Upgrade to continue creating amazing mockups.
              </p>
            </>
          ) : (
            <>
              <div className="upgrade-modal__icon">
                <Sparkles size={32} />
              </div>
              <h2>Upgrade Your Plan</h2>
              <p>
                Get more AI-generated mockups and unlock your creative potential.
              </p>
            </>
          )}
        </div>

        <div className="upgrade-modal__tiers">
          {SUBSCRIPTION_TIERS.map((tier) => {
            const isCurrent = tier.id === currentTier;
            const tierIsDowngrade = checkIsDowngrade(currentTier, tier.id);
            const tierIsUpgrade = checkIsUpgrade(currentTier, tier.id);
            const isSelected = selectedTier === tier.id;
            const isProcessing = isSelected && (upgrading || redirecting);

            return (
              <div
                key={tier.id}
                className={`upgrade-modal__tier ${
                  tier.recommended ? 'upgrade-modal__tier--recommended' : ''
                } ${isCurrent ? 'upgrade-modal__tier--current' : ''}`}
              >
                {tier.recommended && !isCurrent && (
                  <div className="upgrade-modal__tier-badge">Most Popular</div>
                )}

                <div className="upgrade-modal__tier-header">
                  <div className="upgrade-modal__tier-icon">
                    {TIER_ICONS[tier.id]}
                  </div>
                  <h3>{tier.name}</h3>
                  <p className="upgrade-modal__tier-desc">{tier.description}</p>
                </div>

                <div className="upgrade-modal__tier-price">
                  <span className="upgrade-modal__price-value">
                    {formatPrice(tier.monthlyPriceCents)}
                  </span>
                  {tier.monthlyPriceCents > 0 && (
                    <span className="upgrade-modal__price-period">/month</span>
                  )}
                </div>

                <div className="upgrade-modal__tier-quota">
                  <Zap size={16} />
                  <span>{tier.imageQuota} images/month</span>
                </div>

                <ul className="upgrade-modal__tier-features">
                  {tier.features.map((feature, idx) => (
                    <li key={idx}>
                      <Check size={14} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`upgrade-modal__tier-btn ${
                    isCurrent ? 'upgrade-modal__tier-btn--current' : ''
                  } ${tierIsDowngrade ? 'upgrade-modal__tier-btn--downgrade' : ''}`}
                  onClick={() => tierIsDowngrade ? handleDowngrade(tier.id) : handleUpgrade(tier.id)}
                  disabled={isCurrent || upgrading || redirecting}
                >
                  {isCurrent ? (
                    'Current Plan'
                  ) : isProcessing && redirecting ? (
                    <>
                      <Loader2 size={14} className="upgrade-modal__spinner" />
                      Redirecting to Shopify...
                    </>
                  ) : isProcessing ? (
                    <>
                      <Loader2 size={14} className="upgrade-modal__spinner" />
                      Processing...
                    </>
                  ) : tierIsDowngrade ? (
                    'Downgrade'
                  ) : tierIsUpgrade && useShopifyBilling && tier.monthlyPriceCents > 0 ? (
                    <>
                      Upgrade to {tier.name}
                      <ExternalLink size={12} style={{ marginLeft: 4, opacity: 0.7 }} />
                    </>
                  ) : (
                    `Upgrade to ${tier.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {useShopifyBilling && !error && (
          <div className="upgrade-modal__info">
            You'll be redirected to Shopify to confirm your subscription. 
            Charges will appear on your Shopify bill.
          </div>
        )}

        {error && <div className="upgrade-modal__error">{error}</div>}

        <div className="upgrade-modal__footer">
          <p>
            Questions? <a href="mailto:support@socialstitch.io">Contact support</a>
          </p>
        </div>

        <style>{styles}</style>
      </div>
    </div>
  );

  // Use portal to render at document.body level, escaping iframe/container constraints
  return createPortal(modalContent, document.body);
}

// Note: getTierOrder replaced by checkIsUpgrade/checkIsDowngrade from shopifyBillingService

const styles = `
  .upgrade-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 20px;
    font-family: system-ui, -apple-system, sans-serif;
    box-sizing: border-box;
  }

  .upgrade-modal {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 900px;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    position: relative;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    margin: auto;
  }

  .upgrade-modal__close {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .upgrade-modal__close:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .upgrade-modal__header {
    text-align: center;
    padding: 40px 40px 24px;
  }

  .upgrade-modal__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    border-radius: 16px;
    color: #4338ca;
    margin-bottom: 16px;
  }

  .upgrade-modal__icon--warning {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #92400e;
  }

  .upgrade-modal__header h2 {
    font-size: 24px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 8px;
  }

  .upgrade-modal__header p {
    font-size: 15px;
    color: #64748b;
    margin: 0;
    max-width: 400px;
    margin: 0 auto;
  }

  .upgrade-modal__tiers {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    padding: 0 40px 24px;
  }

  @media (max-width: 800px) {
    .upgrade-modal__tiers {
      grid-template-columns: 1fr;
    }
  }

  .upgrade-modal__tier {
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
    position: relative;
    transition: all 0.2s;
  }

  .upgrade-modal__tier:hover {
    border-color: #cbd5e1;
  }

  .upgrade-modal__tier--recommended {
    border-color: #4f46e5;
    background: white;
    box-shadow: 0 4px 20px rgba(79, 70, 229, 0.15);
  }

  .upgrade-modal__tier--current {
    border-color: #10b981;
    background: #f0fdf4;
  }

  .upgrade-modal__tier-badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: #4f46e5;
    color: white;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 12px;
    border-radius: 20px;
  }

  .upgrade-modal__tier-header {
    text-align: center;
    margin-bottom: 16px;
  }

  .upgrade-modal__tier-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: #e2e8f0;
    border-radius: 12px;
    color: #475569;
    margin-bottom: 12px;
  }

  .upgrade-modal__tier--recommended .upgrade-modal__tier-icon {
    background: #e0e7ff;
    color: #4338ca;
  }

  .upgrade-modal__tier-header h3 {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 4px;
  }

  .upgrade-modal__tier-desc {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }

  .upgrade-modal__tier-price {
    text-align: center;
    margin-bottom: 16px;
  }

  .upgrade-modal__price-value {
    font-size: 32px;
    font-weight: 800;
    color: #1e293b;
  }

  .upgrade-modal__price-period {
    font-size: 14px;
    color: #64748b;
  }

  .upgrade-modal__tier-quota {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    background: #fef3c7;
    color: #92400e;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .upgrade-modal__tier-features {
    list-style: none;
    padding: 0;
    margin: 0 0 20px;
  }

  .upgrade-modal__tier-features li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: #475569;
    padding: 6px 0;
  }

  .upgrade-modal__tier-features li svg {
    color: #10b981;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .upgrade-modal__tier-btn {
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    background: #4f46e5;
    color: white;
  }

  .upgrade-modal__tier-btn:hover:not(:disabled) {
    background: #4338ca;
  }

  .upgrade-modal__tier-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .upgrade-modal__tier-btn--current {
    background: #10b981;
    cursor: default;
  }

  .upgrade-modal__tier-btn--current:hover {
    background: #10b981;
  }

  .upgrade-modal__tier-btn--downgrade {
    background: #94a3b8;
  }

  .upgrade-modal__tier-btn--downgrade:hover:not(:disabled) {
    background: #64748b;
  }

  .upgrade-modal__error {
    margin: 0 40px 16px;
    padding: 12px 16px;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
  }

  .upgrade-modal__footer {
    text-align: center;
    padding: 16px 40px 32px;
    border-top: 1px solid #e2e8f0;
  }

  .upgrade-modal__footer p {
    font-size: 13px;
    color: #64748b;
    margin: 0;
  }

  .upgrade-modal__footer a {
    color: #4f46e5;
    text-decoration: none;
    font-weight: 500;
  }

  .upgrade-modal__footer a:hover {
    text-decoration: underline;
  }

  .upgrade-modal__spinner {
    animation: spin 1s linear infinite;
    margin-right: 6px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .upgrade-modal__tier-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .upgrade-modal__info {
    margin: 0 40px 16px;
    padding: 12px 16px;
    background: #e0f2fe;
    color: #0369a1;
    border-radius: 8px;
    font-size: 13px;
    text-align: center;
  }
`;

export default UpgradeModal;

