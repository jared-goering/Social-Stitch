/**
 * Usage Indicator Component
 *
 * Displays the user's current image generation quota usage
 * with a progress bar and remaining count.
 */

import React, { useEffect, useState } from 'react';
import { Zap, TrendingUp } from 'lucide-react';
import {
  getSubscription,
  getCurrentUsage,
  subscribeToUsage,
  subscribeToSubscription,
  getTierConfig,
  formatPrice,
  getUpgradeTier,
} from '../services/subscriptionService';
import { ShopSubscription, UsageRecord, TierConfig } from '../types';

interface UsageIndicatorProps {
  /** Compact mode for tight spaces */
  compact?: boolean;
  /** Show upgrade button when available */
  showUpgrade?: boolean;
  /** Callback when upgrade is clicked */
  onUpgradeClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function UsageIndicator({
  compact = false,
  showUpgrade = true,
  onUpgradeClick,
  className = '',
}: UsageIndicatorProps) {
  const [subscription, setSubscription] = useState<ShopSubscription | null>(null);
  const [usage, setUsage] = useState<UsageRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initial fetch
    const fetchData = async () => {
      try {
        const [sub, use] = await Promise.all([getSubscription(), getCurrentUsage()]);
        if (mounted) {
          setSubscription(sub);
          setUsage(use);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching usage data:', error);
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    // Real-time subscriptions
    const unsubUsage = subscribeToUsage((newUsage) => {
      if (mounted) setUsage(newUsage);
    });

    const unsubSubscription = subscribeToSubscription((newSub) => {
      if (mounted && newSub) setSubscription(newSub);
    });

    return () => {
      mounted = false;
      unsubUsage();
      unsubSubscription();
    };
  }, []);

  if (loading || !subscription || !usage) {
    return (
      <div className={`usage-indicator usage-indicator--loading ${className}`}>
        <div className="usage-indicator__skeleton" />
      </div>
    );
  }

  const used = usage.imagesGenerated;
  const quota = subscription.imageQuota;
  const remaining = Math.max(0, quota - used);
  const percentUsed = Math.min(100, (used / quota) * 100);
  const tierConfig = getTierConfig(subscription.tier);
  const upgradeTier = getUpgradeTier(subscription.tier);

  // Determine status color
  const getStatusColor = () => {
    if (percentUsed >= 100) return 'var(--usage-critical, #ef4444)';
    if (percentUsed >= 80) return 'var(--usage-warning, #f59e0b)';
    return 'var(--usage-healthy, #10b981)';
  };

  const statusColor = getStatusColor();

  if (compact) {
    return (
      <div className={`usage-indicator usage-indicator--compact ${className}`}>
        <div className="usage-indicator__compact-content">
          <Zap size={14} style={{ color: statusColor }} />
          <span className="usage-indicator__compact-text">
            {remaining} left
          </span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className={`usage-indicator ${className}`}>
      <div className="usage-indicator__header">
        <div className="usage-indicator__title">
          <Zap size={16} style={{ color: statusColor }} />
          <span>Image Generations</span>
        </div>
        <div className="usage-indicator__tier-badge">
          {tierConfig.name}
        </div>
      </div>

      <div className="usage-indicator__progress-container">
        <div className="usage-indicator__progress-bar">
          <div
            className="usage-indicator__progress-fill"
            style={{
              width: `${percentUsed}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
      </div>

      <div className="usage-indicator__stats">
        <span className="usage-indicator__count">
          <strong>{used}</strong> / {quota} used
        </span>
        <span className="usage-indicator__remaining" style={{ color: statusColor }}>
          {remaining > 0 ? `${remaining} remaining` : 'Quota exhausted'}
        </span>
      </div>

      {showUpgrade && upgradeTier && (
        <button
          className="usage-indicator__upgrade-btn"
          onClick={onUpgradeClick}
        >
          <TrendingUp size={14} />
          Upgrade to {upgradeTier.name} ({formatPrice(upgradeTier.monthlyPriceCents)}/mo)
        </button>
      )}

      {percentUsed >= 80 && remaining > 0 && (
        <div className="usage-indicator__warning">
          Running low on generations this month
        </div>
      )}

      {remaining === 0 && (
        <div className="usage-indicator__exhausted">
          Upgrade to continue generating mockups
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .usage-indicator {
    background: var(--usage-bg, #f8fafc);
    border: 1px solid var(--usage-border, #e2e8f0);
    border-radius: 12px;
    padding: 16px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .usage-indicator--loading {
    min-height: 100px;
  }

  .usage-indicator__skeleton {
    background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
    height: 80px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .usage-indicator__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .usage-indicator__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--usage-text, #1e293b);
  }

  .usage-indicator__tier-badge {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--usage-badge-bg, #e0e7ff);
    color: var(--usage-badge-text, #4338ca);
  }

  .usage-indicator__progress-container {
    margin-bottom: 8px;
  }

  .usage-indicator__progress-bar {
    height: 8px;
    background: var(--usage-progress-bg, #e2e8f0);
    border-radius: 4px;
    overflow: hidden;
  }

  .usage-indicator__progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  .usage-indicator__stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--usage-text-secondary, #64748b);
    margin-bottom: 12px;
  }

  .usage-indicator__count strong {
    color: var(--usage-text, #1e293b);
  }

  .usage-indicator__remaining {
    font-weight: 500;
  }

  .usage-indicator__upgrade-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    background: var(--usage-upgrade-bg, #4f46e5);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .usage-indicator__upgrade-btn:hover {
    background: var(--usage-upgrade-hover, #4338ca);
  }

  .usage-indicator__warning {
    margin-top: 12px;
    padding: 8px 12px;
    background: #fef3c7;
    color: #92400e;
    border-radius: 6px;
    font-size: 12px;
    text-align: center;
  }

  .usage-indicator__exhausted {
    margin-top: 12px;
    padding: 8px 12px;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 6px;
    font-size: 12px;
    text-align: center;
    font-weight: 500;
  }

  /* Compact mode */
  .usage-indicator--compact {
    background: transparent;
    border: none;
    padding: 0;
  }

  .usage-indicator__compact-content {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--usage-text-secondary, #64748b);
  }

  .usage-indicator__compact-text {
    font-weight: 500;
  }
`;

export default UsageIndicator;



