/**
 * Upgrade Modal Component
 *
 * Shown when user exhausts their quota or clicks upgrade.
 * Displays tier comparison and upgrade options.
 */

import React, { useState } from 'react';
import { X, Check, Zap, Sparkles, Building2 } from 'lucide-react';
import {
  SUBSCRIPTION_TIERS,
  SubscriptionTier,
  TierConfig,
  QuotaCheckResult,
} from '../types';
import { formatPrice, updateSubscriptionTier } from '../services/subscriptionService';

interface UpgradeModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Current quota status (if available) */
  quotaStatus?: QuotaCheckResult;
  /** Callback after successful upgrade */
  onUpgradeSuccess?: (newTier: SubscriptionTier) => void;
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
}: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTier = quotaStatus?.tier || 'free';

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === currentTier) return;
    
    setSelectedTier(tier);
    setUpgrading(true);
    setError(null);

    try {
      // In production, this would integrate with Shopify Billing API or Stripe
      // For now, we directly update the subscription (demo mode)
      await updateSubscriptionTier(tier);
      
      onUpgradeSuccess?.(tier);
      onClose();
    } catch (err) {
      console.error('Upgrade failed:', err);
      setError('Failed to process upgrade. Please try again.');
    } finally {
      setUpgrading(false);
      setSelectedTier(null);
    }
  };

  return (
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
            const isDowngrade = getTierOrder(tier.id) < getTierOrder(currentTier);
            const isSelected = selectedTier === tier.id;

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
                  } ${isDowngrade ? 'upgrade-modal__tier-btn--downgrade' : ''}`}
                  onClick={() => handleUpgrade(tier.id)}
                  disabled={isCurrent || upgrading}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : isDowngrade
                    ? 'Downgrade'
                    : isSelected && upgrading
                    ? 'Processing...'
                    : `Upgrade to ${tier.name}`}
                </button>
              </div>
            );
          })}
        </div>

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
}

function getTierOrder(tier: SubscriptionTier): number {
  const order: Record<SubscriptionTier, number> = {
    free: 0,
    pro: 1,
    business: 2,
  };
  return order[tier];
}

const styles = `
  .upgrade-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .upgrade-modal {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
`;

export default UpgradeModal;

