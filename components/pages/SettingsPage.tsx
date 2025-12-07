/**
 * Settings Page
 *
 * Enhanced Polaris page for app settings and account management.
 * Features the new warm color scheme and improved UI.
 */

import React, { useState, useEffect } from 'react';
import {
  Page,
  Layout,
  LegacyCard,
  Text,
  Banner,
  List,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Box,
  Modal,
  TextField,
} from '@shopify/polaris';
import {
  Package,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Zap,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Mail,
  FileText,
  Shield,
  BarChart3,
  Store,
  RefreshCw,
  Target,
  Users,
  Palette,
  Tag,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Loader2,
  Link2Off,
  X,
  Edit3,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { useShopifyContext } from '../ShopifyProvider';
import { subscribeToScheduledPosts } from '../../services/scheduledPostsService';
import { fetchUserMockups } from '../../services/mockupStorageService';
import { generateBrandProfile, getBrandProfile, regenerateSection, regenerateElevatorPitch, deleteBrandProfile, BrandProfileSection } from '../../services/brandProfileService';
import { isOAuthRequired, redirectToOAuth } from '../../services/shopifyProductService';
import { getSubscription, getCurrentUsage, getTierConfig, formatPrice, getUpgradeTier, subscribeToUsage, subscribeToSubscription } from '../../services/subscriptionService';
import { ScheduledPost, SavedMockup, BrandProfile, ShopSubscription, UsageRecord, SUBSCRIPTION_TIERS, SocialPlatform } from '../../types';
import { UpgradeModal } from '../UpgradeModal';
import { getConnectedAccounts, startOAuthFlow, disconnectAccount, AccountsMap } from '../../services/socialAuthService';

interface SettingsPageProps {
  onNavigateToCreate?: () => void;
}

interface UsageStats {
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  failedPosts: number;
  totalMockups: number;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigateToCreate }) => {
  const { shop, isAuthenticated } = useShopifyContext();
  const [stats, setStats] = useState<UsageStats>({
    totalPosts: 0,
    scheduledPosts: 0,
    publishedPosts: 0,
    failedPosts: 0,
    totalMockups: 0,
  });

  // Subscription state
  const [subscription, setSubscription] = useState<ShopSubscription | null>(null);
  const [usage, setUsage] = useState<UsageRecord | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Brand Profile state
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ stage: '', progress: 0 });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isOAuthError, setIsOAuthError] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  
  // Section regeneration state
  const [regeneratingSection, setRegeneratingSection] = useState<BrandProfileSection | 'elevatorPitch' | null>(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<BrandProfileSection | 'elevatorPitch' | null>(null);
  const [sectionContext, setSectionContext] = useState('');
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  // Social accounts state
  const [connectedAccounts, setConnectedAccounts] = useState<AccountsMap>({
    facebook: { connected: false, username: '' },
    instagram: { connected: false, username: '' }
  });
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<SocialPlatform | null>(null);
  const [socialAuthError, setSocialAuthError] = useState<string | null>(null);

  // Load usage statistics
  useEffect(() => {
    // Subscribe to posts
    const unsubscribe = subscribeToScheduledPosts((posts) => {
      setStats(prev => ({
        ...prev,
        totalPosts: posts.length,
        scheduledPosts: posts.filter(p => p.status === 'scheduled').length,
        publishedPosts: posts.filter(p => p.status === 'published').length,
        failedPosts: posts.filter(p => p.status === 'failed').length,
      }));
    });

    // Load mockups count
    fetchUserMockups().then(mockups => {
      setStats(prev => ({ ...prev, totalMockups: mockups.length }));
    }).catch(console.error);

    return () => unsubscribe();
  }, []);

  // Load subscription and usage data
  useEffect(() => {
    const loadSubscriptionData = async () => {
      try {
        const [sub, use] = await Promise.all([getSubscription(), getCurrentUsage()]);
        setSubscription(sub);
        setUsage(use);
      } catch (error) {
        console.error('Error loading subscription data:', error);
      }
    };

    loadSubscriptionData();

    // Subscribe to real-time updates
    const unsubUsage = subscribeToUsage((newUsage) => {
      setUsage(newUsage);
    });

    const unsubSubscription = subscribeToSubscription((newSub) => {
      if (newSub) setSubscription(newSub);
    });

    return () => {
      unsubUsage();
      unsubSubscription();
    };
  }, []);

  // Load existing brand profile
  useEffect(() => {
    if (isAuthenticated) {
      getBrandProfile()
        .then(profile => {
          if (profile) {
            setBrandProfile(profile);
          }
        })
        .catch(err => {
          console.error('Error loading brand profile:', err);
        });
    }
  }, [isAuthenticated]);

  // Load connected social accounts
  useEffect(() => {
    const loadConnectedAccounts = async () => {
      try {
        setIsLoadingAccounts(true);
        const accounts = await getConnectedAccounts();
        setConnectedAccounts(accounts);
      } catch (error) {
        console.error('Error loading connected accounts:', error);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    loadConnectedAccounts();
  }, []);

  // Handle connecting a social account
  const handleConnectSocial = async (platform: SocialPlatform) => {
    setConnectingPlatform(platform);
    setSocialAuthError(null);

    try {
      const success = await startOAuthFlow(platform);
      if (success) {
        // Refresh accounts to get the newly connected account
        const accounts = await getConnectedAccounts();
        setConnectedAccounts(accounts);
      }
    } catch (error) {
      console.error('OAuth error:', error);
      setSocialAuthError('Failed to connect. Please try again.');
    } finally {
      setConnectingPlatform(null);
    }
  };

  // Handle disconnecting a social account
  const handleDisconnectSocial = async (platform: SocialPlatform) => {
    setDisconnectingPlatform(platform);
    setSocialAuthError(null);

    try {
      const success = await disconnectAccount(platform);
      if (success) {
        setConnectedAccounts(prev => ({
          ...prev,
          [platform]: { connected: false, username: '' }
        }));
      } else {
        setSocialAuthError('Failed to disconnect. Please try again.');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      setSocialAuthError('Failed to disconnect. Please try again.');
    } finally {
      setDisconnectingPlatform(null);
    }
  };

  // Handle brand profile generation
  const handleGenerateProfile = async () => {
    if (!shop) return;

    setIsGeneratingProfile(true);
    setProfileError(null);
    setIsOAuthError(false);
    setGenerationProgress({ stage: 'Starting...', progress: 0 });

    try {
      const profile = await generateBrandProfile(shop, (stage, progress) => {
        setGenerationProgress({ stage, progress });
      });
      setBrandProfile(profile);
      setIsProfileExpanded(true);
    } catch (error: any) {
      console.error('Error generating brand profile:', error);
      
      // Check if this is an OAuth error that requires app reinstallation
      if (isOAuthRequired(error)) {
        setIsOAuthError(true);
        setProfileError('Your app connection has expired or is invalid.');
      } else {
        setProfileError(error.message || 'Failed to generate brand profile');
      }
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  // Handle reconnecting the app (OAuth redirect)
  const handleReconnectApp = () => {
    if (shop) {
      redirectToOAuth(shop);
    }
  };

  // Handle brand profile deletion
  const handleDeleteProfile = async () => {
    if (!confirm('Are you sure you want to delete your brand profile? You can regenerate it anytime.')) {
      return;
    }

    setIsDeletingProfile(true);
    try {
      await deleteBrandProfile();
      setBrandProfile(null);
      setIsProfileExpanded(false);
    } catch (error: any) {
      console.error('Error deleting brand profile:', error);
      setProfileError(error.message || 'Failed to delete brand profile');
    } finally {
      setIsDeletingProfile(false);
    }
  };

  // Open section regeneration modal
  const openSectionModal = (section: BrandProfileSection | 'elevatorPitch') => {
    setSelectedSection(section);
    setSectionContext('');
    setSectionModalOpen(true);
  };

  // Handle section regeneration
  const handleRegenerateSection = async () => {
    if (!brandProfile || !selectedSection) return;

    setSectionModalOpen(false);
    setRegeneratingSection(selectedSection);

    try {
      let updatedProfile: BrandProfile;
      
      if (selectedSection === 'elevatorPitch') {
        updatedProfile = await regenerateElevatorPitch(brandProfile, sectionContext);
      } else {
        updatedProfile = await regenerateSection(selectedSection, brandProfile, sectionContext);
      }
      
      setBrandProfile(updatedProfile);
    } catch (error: any) {
      console.error('Error regenerating section:', error);
      setProfileError(`Failed to regenerate section: ${error.message}`);
    } finally {
      setRegeneratingSection(null);
      setSectionContext('');
    }
  };

  // Get section display name
  const getSectionName = (section: BrandProfileSection | 'elevatorPitch'): string => {
    switch (section) {
      case 'identity': return 'Brand Identity';
      case 'productIntelligence': return 'Product Intelligence';
      case 'marketPositioning': return 'Target Audience';
      case 'voiceAndAesthetic': return 'Voice & Aesthetic';
      case 'elevatorPitch': return 'Elevator Pitch';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display text-slate-warm-900 mb-2">Settings</h1>
        <p className="text-slate-warm-500">Manage your SocialStitch preferences and connections</p>
      </div>

      <div className="space-y-6">
        {/* Shop Information Card */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="icon-container icon-container-coral w-12 h-12">
              <Package size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-warm-800">Shop Information</h2>
              <p className="text-sm text-slate-warm-500">Your connected Shopify store details</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-warm-50 rounded-xl">
              <p className="text-xs text-slate-warm-500 mb-1">Shop Domain</p>
              <p className="font-medium text-slate-warm-800">{shop || 'Not connected'}</p>
            </div>
            <div className="p-4 bg-slate-warm-50 rounded-xl">
              <p className="text-xs text-slate-warm-500 mb-1">Connection Status</p>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                isAuthenticated ? 'bg-sage-100 text-sage-600' : 'bg-red-100 text-red-600'
              }`}>
                {isAuthenticated ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {isAuthenticated ? 'Connected' : 'Not Connected'}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription & Plan Card */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="icon-container w-12 h-12" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <Zap size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-warm-800">Subscription & Plan</h2>
                <p className="text-sm text-slate-warm-500">Manage your image generation quota</p>
              </div>
            </div>
            {subscription && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                subscription.tier === 'free' 
                  ? 'bg-slate-warm-100 text-slate-warm-600'
                  : subscription.tier === 'pro'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-amber-100 text-amber-600'
              }`}>
                {subscription.tier === 'free' ? 'Free' : subscription.tier === 'pro' ? 'Pro' : 'Business'}
              </span>
            )}
          </div>

          {subscription && usage ? (
            <div className="space-y-6">
              {/* Usage Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-warm-700">Monthly Image Generations</span>
                  <span className="text-sm text-slate-warm-500">
                    {usage.imagesGenerated} / {subscription.imageQuota} used
                  </span>
                </div>
                <div className="w-full bg-slate-warm-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      usage.imagesGenerated >= subscription.imageQuota
                        ? 'bg-red-500'
                        : usage.imagesGenerated >= subscription.imageQuota * 0.8
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (usage.imagesGenerated / subscription.imageQuota) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-warm-400 mt-2">
                  {Math.max(0, subscription.imageQuota - usage.imagesGenerated)} generations remaining this month
                </p>
              </div>

              {/* Plan Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-warm-50 rounded-xl">
                  <p className="text-xs text-slate-warm-500 mb-1">Current Plan</p>
                  <p className="font-semibold text-slate-warm-800 capitalize">{subscription.tier}</p>
                  <p className="text-xs text-slate-warm-400 mt-1">
                    {formatPrice(getTierConfig(subscription.tier).monthlyPriceCents)}/month
                  </p>
                </div>
                <div className="p-4 bg-slate-warm-50 rounded-xl">
                  <p className="text-xs text-slate-warm-500 mb-1">Monthly Quota</p>
                  <p className="font-semibold text-slate-warm-800">{subscription.imageQuota} images</p>
                  <p className="text-xs text-slate-warm-400 mt-1">
                    Resets monthly
                  </p>
                </div>
              </div>

              {/* Tier Comparison */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-warm-500 uppercase tracking-wide">Available Plans</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {SUBSCRIPTION_TIERS.map((tier) => {
                    const isCurrent = tier.id === subscription.tier;
                    return (
                      <div
                        key={tier.id}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isCurrent
                            ? 'border-emerald-500 bg-emerald-50/50'
                            : tier.recommended
                            ? 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-400'
                            : 'border-slate-warm-200 hover:border-slate-warm-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-slate-warm-800">{tier.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                          {tier.recommended && !isCurrent && (
                            <span className="text-[10px] font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-2xl font-bold text-slate-warm-900 mb-1">
                          {formatPrice(tier.monthlyPriceCents)}
                          {tier.monthlyPriceCents > 0 && <span className="text-sm font-normal text-slate-warm-400">/mo</span>}
                        </p>
                        <p className="text-sm text-slate-warm-600 mb-3">{tier.imageQuota} images/month</p>
                        <ul className="text-xs text-slate-warm-500 space-y-1">
                          {tier.features.slice(0, 3).map((feature, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <CheckCircle size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upgrade Button */}
              {subscription.tier !== 'business' && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full btn-primary text-white py-3 rounded-xl font-medium text-sm inline-flex items-center justify-center gap-2"
                >
                  <Zap size={18} />
                  {subscription.tier === 'free' ? 'Upgrade to Pro' : 'Upgrade to Business'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-slate-warm-400" size={24} />
            </div>
          )}
        </div>

        {/* Brand Profile Card */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="icon-container w-12 h-12" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
                <Store size={22} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-warm-800">Brand Profile</h2>
                <p className="text-sm text-slate-warm-500">AI-powered analysis of your brand identity</p>
              </div>
            </div>
            {brandProfile && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sage-100 text-sage-600">
                  <CheckCircle size={12} />
                  Generated
                </span>
                <button
                  onClick={handleDeleteProfile}
                  disabled={isDeletingProfile}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Delete brand profile"
                >
                  {isDeletingProfile ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Generation Progress */}
          {isGeneratingProfile && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 size={18} className="text-violet-500 animate-spin" />
                <span className="text-sm text-slate-warm-600">{generationProgress.stage}</span>
              </div>
              <div className="w-full bg-slate-warm-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${generationProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* OAuth Error State - Special UI for reconnection */}
          {profileError && isOAuthError && (
            <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Link2Off size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-800 mb-1">
                    App Connection Expired
                  </h4>
                  <p className="text-sm text-amber-700 mb-4">
                    Your connection to Shopify needs to be refreshed. This can happen if the app was reinstalled 
                    or if permissions were changed. Click below to reconnect.
                  </p>
                  <button
                    onClick={handleReconnectApp}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm transition-colors shadow-sm"
                  >
                    <RefreshCw size={16} />
                    Reconnect App
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Generic Error State */}
          {profileError && !isOAuthError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Error generating profile</span>
              </div>
              <p className="text-sm text-red-500 mt-1">{profileError}</p>
            </div>
          )}

          {/* No Profile Yet */}
          {!brandProfile && !isGeneratingProfile && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                <Store size={28} className="text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-warm-800 mb-2">Discover Your Brand DNA</h3>
              <p className="text-sm text-slate-warm-500 mb-6 max-w-md mx-auto">
                We'll analyze your products, collections, and store data to create a comprehensive 
                brand profile that can be used to generate on-brand content.
              </p>
              <button
                onClick={handleGenerateProfile}
                disabled={!isAuthenticated}
                className="btn-primary text-white px-6 py-3 rounded-xl font-medium text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={18} />
                Generate Brand Profile
              </button>
            </div>
          )}

          {/* Profile Display */}
          {brandProfile && !isGeneratingProfile && (
            <div className="space-y-6">
              {/* Elevator Pitch */}
              <div className="p-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-100">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-warm-700 leading-relaxed italic flex-1">
                    "{brandProfile.elevatorPitch}"
                  </p>
                  <button
                    onClick={() => openSectionModal('elevatorPitch')}
                    disabled={regeneratingSection === 'elevatorPitch'}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-violet-500 hover:text-violet-700 hover:bg-violet-100 transition-all disabled:opacity-50"
                    title="Refine elevator pitch"
                  >
                    {regeneratingSection === 'elevatorPitch' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Edit3 size={12} />
                    )}
                    {regeneratingSection === 'elevatorPitch' ? 'Updating...' : 'Refine'}
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-warm-50 rounded-xl text-center">
                  <Tag size={16} className="text-violet-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-warm-800">{brandProfile.productIntelligence.primaryCategories.length}</p>
                  <p className="text-xs text-slate-warm-500">Categories</p>
                </div>
                <div className="p-3 bg-slate-warm-50 rounded-xl text-center">
                  <Users size={16} className="text-indigo-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-warm-800 capitalize">{brandProfile.marketPositioning.pricePositioning}</p>
                  <p className="text-xs text-slate-warm-500">Price Tier</p>
                </div>
                <div className="p-3 bg-slate-warm-50 rounded-xl text-center">
                  <DollarSign size={16} className="text-emerald-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-warm-800">
                    {brandProfile.productIntelligence.priceRange.currency} {brandProfile.productIntelligence.priceRange.average.toFixed(0)}
                  </p>
                  <p className="text-xs text-slate-warm-500">Avg Price</p>
                </div>
                <div className="p-3 bg-slate-warm-50 rounded-xl text-center">
                  <Package size={16} className="text-amber-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-slate-warm-800">{brandProfile.dataSourceSummary.productsAnalyzed}</p>
                  <p className="text-xs text-slate-warm-500">Products</p>
                </div>
              </div>

              {/* Expandable Details */}
              <button
                onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-warm-50 rounded-xl hover:bg-slate-warm-100 transition-colors"
              >
                <span className="text-sm font-medium text-slate-warm-700">View Full Profile Details</span>
                {isProfileExpanded ? <ChevronUp size={18} className="text-slate-warm-500" /> : <ChevronDown size={18} className="text-slate-warm-500" />}
              </button>

              {isProfileExpanded && (
                <div className="space-y-6 pt-2">
                  {/* Brand Identity */}
                  <ProfileSection
                    icon={Target}
                    title="Brand Identity"
                    color="violet"
                    onRegenerate={() => openSectionModal('identity')}
                    isRegenerating={regeneratingSection === 'identity'}
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-1">Positioning</p>
                        <p className="text-sm text-slate-warm-700">{brandProfile.identity.positioningStatement}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-1">Brand Story</p>
                        <p className="text-sm text-slate-warm-700">{brandProfile.identity.storySummary}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Core Values</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.identity.coreValues.map((value, i) => (
                            <span key={i} className="px-2 py-1 bg-violet-50 text-violet-600 rounded-lg text-xs font-medium">
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ProfileSection>

                  {/* Product Intelligence */}
                  <ProfileSection
                    icon={Package}
                    title="Product Intelligence"
                    color="amber"
                    onRegenerate={() => openSectionModal('productIntelligence')}
                    isRegenerating={regeneratingSection === 'productIntelligence'}
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Product Categories</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.productIntelligence.primaryCategories.map((cat, i) => (
                            <span key={i} className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-medium">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Key Characteristics</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.productIntelligence.productCharacteristics.slice(0, 6).map((char, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-warm-100 text-slate-warm-600 rounded-lg text-xs">
                              {char}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Use Cases</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.productIntelligence.useCases.map((use, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-warm-100 text-slate-warm-600 rounded-lg text-xs">
                              {use}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Unique Selling Points</p>
                        <ul className="text-sm text-slate-warm-700 space-y-1">
                          {brandProfile.productIntelligence.uniqueSellingPoints.map((usp, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                              {usp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </ProfileSection>

                  {/* Target Audience */}
                  <ProfileSection
                    icon={Users}
                    title="Target Audience"
                    color="indigo"
                    onRegenerate={() => openSectionModal('marketPositioning')}
                    isRegenerating={regeneratingSection === 'marketPositioning'}
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Demographics</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.marketPositioning.targetAudience.demographics.map((demo, i) => (
                            <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium">
                              {demo}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Psychographics</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.marketPositioning.targetAudience.psychographics.map((psych, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-warm-100 text-slate-warm-600 rounded-lg text-xs">
                              {psych}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Lifestyle</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.marketPositioning.targetAudience.lifestyle.map((life, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-warm-100 text-slate-warm-600 rounded-lg text-xs">
                              {life}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-1">Competitive Positioning</p>
                        <p className="text-sm text-slate-warm-700">{brandProfile.marketPositioning.competitivePositioning}</p>
                      </div>
                    </div>
                  </ProfileSection>

                  {/* Voice & Aesthetic */}
                  <ProfileSection
                    icon={Palette}
                    title="Voice & Aesthetic"
                    color="rose"
                    onRegenerate={() => openSectionModal('voiceAndAesthetic')}
                    isRegenerating={regeneratingSection === 'voiceAndAesthetic'}
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Tone Characteristics</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.voiceAndAesthetic.toneCharacteristics.map((tone, i) => (
                            <span key={i} className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium">
                              {tone}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-1">Visual Aesthetic</p>
                        <p className="text-sm text-slate-warm-700">{brandProfile.voiceAndAesthetic.visualAesthetic}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Color Palette</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.voiceAndAesthetic.colorPaletteTendencies.map((color, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-warm-100 text-slate-warm-600 rounded-lg text-xs">
                              {color}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-1">Photography Style</p>
                        <p className="text-sm text-slate-warm-700">{brandProfile.voiceAndAesthetic.photographyStyle}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-warm-500 mb-2">Mood Keywords</p>
                        <div className="flex flex-wrap gap-2">
                          {brandProfile.voiceAndAesthetic.moodKeywords.map((mood, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-warm-100 text-slate-warm-600 rounded-lg text-xs">
                              {mood}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ProfileSection>

                  {/* Metadata */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-warm-200">
                    <p className="text-xs text-slate-warm-400">
                      Generated {brandProfile.generatedAt.toLocaleDateString()} at {brandProfile.generatedAt.toLocaleTimeString()}
                    </p>
                    <button
                      onClick={handleGenerateProfile}
                      disabled={isGeneratingProfile}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-warm-200 text-slate-warm-700 hover:border-violet-300 hover:bg-violet-50 transition-all text-sm font-medium disabled:opacity-50"
                    >
                      <RefreshCw size={14} />
                      Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Usage Statistics Card */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="icon-container icon-container-amber w-12 h-12">
              <BarChart3 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-warm-800">Usage Statistics</h2>
              <p className="text-sm text-slate-warm-500">Your content creation activity</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              label="Total Posts" 
              value={stats.totalPosts} 
              icon={Calendar}
              color="coral"
            />
            <StatCard 
              label="Scheduled" 
              value={stats.scheduledPosts} 
              icon={Sparkles}
              color="amber"
            />
            <StatCard 
              label="Published" 
              value={stats.publishedPosts} 
              icon={CheckCircle}
              color="sage"
            />
            <StatCard 
              label="AI Mockups" 
              value={stats.totalMockups} 
              icon={ImageIcon}
              color="slate"
            />
          </div>
        </div>

        {/* Social Media Accounts Card */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="icon-container icon-container-sage w-12 h-12">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-warm-800">Social Media Accounts</h2>
              <p className="text-sm text-slate-warm-500">Connect your social profiles for publishing</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-slate-warm-600 leading-relaxed">
              Connect your Facebook and Instagram accounts to publish posts directly from SocialStitch.
              You'll be redirected to Meta's secure authentication to grant access.
            </p>

            {/* Error message */}
            {socialAuthError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle size={14} />
                  <span className="text-sm">{socialAuthError}</span>
                </div>
              </div>
            )}
            
            {/* Loading state */}
            {isLoadingAccounts ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-slate-warm-400" />
              </div>
            ) : (
              <div className="space-y-3">
                <SocialBadge 
                  platform="Instagram" 
                  connected={connectedAccounts.instagram.connected}
                  username={connectedAccounts.instagram.username}
                  isConnecting={connectingPlatform === 'instagram'}
                  isDisconnecting={disconnectingPlatform === 'instagram'}
                  onConnect={() => handleConnectSocial('instagram')}
                  onDisconnect={() => handleDisconnectSocial('instagram')}
                />
                <SocialBadge 
                  platform="Facebook" 
                  connected={connectedAccounts.facebook.connected}
                  username={connectedAccounts.facebook.username}
                  pageName={connectedAccounts.facebook.pageName}
                  isConnecting={connectingPlatform === 'facebook'}
                  isDisconnecting={disconnectingPlatform === 'facebook'}
                  onConnect={() => handleConnectSocial('facebook')}
                  onDisconnect={() => handleDisconnectSocial('facebook')}
                />
              </div>
            )}
            
            {onNavigateToCreate && (
              <div className="pt-2 border-t border-slate-warm-100 mt-4">
                <button
                  onClick={onNavigateToCreate}
                  className="inline-flex items-center gap-2 text-sm text-slate-warm-500 hover:text-coral-500 transition-colors"
                >
                  Or create a post first
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Features Card */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="icon-container icon-container-slate w-12 h-12">
              <Zap size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-warm-800">Available Features</h2>
              <p className="text-sm text-slate-warm-500">Everything you can do with SocialStitch</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureItem 
              icon={Package} 
              title="Product Import" 
              description="Select products directly from your Shopify catalog"
            />
            <FeatureItem 
              icon={ImageIcon} 
              title="AI Mockups" 
              description="Generate professional lifestyle photos with Gemini AI"
            />
            <FeatureItem 
              icon={Sparkles} 
              title="AI Captions" 
              description="Auto-generate engaging social media captions"
            />
            <FeatureItem 
              icon={Calendar} 
              title="Social Scheduling" 
              description="Schedule posts to Facebook and Instagram"
            />
          </div>
        </div>

        {/* Support Card */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-slate-warm-100 flex items-center justify-center">
              <Mail size={22} className="text-slate-warm-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-warm-800">Support & Resources</h2>
              <p className="text-sm text-slate-warm-500">Get help when you need it</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <a 
              href="mailto:support@socialstitch.app"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-warm-200 text-slate-warm-700 hover:border-coral-300 hover:bg-coral-50 transition-all text-sm font-medium"
            >
              <Mail size={16} />
              Contact Support
            </a>
            <a 
              href="https://docs.socialstitch.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-warm-200 text-slate-warm-700 hover:border-coral-300 hover:bg-coral-50 transition-all text-sm font-medium"
            >
              <FileText size={16} />
              Documentation
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Privacy Banner */}
        <div className="p-6 bg-gradient-to-r from-slate-warm-50 to-coral-50/30 rounded-2xl border border-slate-warm-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-warm-100 flex items-center justify-center flex-shrink-0">
              <Shield size={18} className="text-slate-warm-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-warm-800 mb-1">Privacy & Data</h3>
              <p className="text-sm text-slate-warm-600 leading-relaxed">
                SocialStitch stores your generated mockups and scheduled posts to provide the best experience. 
                You can delete your data at any time by uninstalling the app. See our{' '}
                <a 
                  href="https://socialstitch.app/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-coral-500 hover:text-coral-600 font-medium"
                >
                  Privacy Policy
                </a>{' '}
                for more details.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Regeneration Modal - Using Polaris Modal */}
      <Modal
        open={sectionModalOpen && selectedSection !== null}
        onClose={() => setSectionModalOpen(false)}
        title={`Refine ${selectedSection ? getSectionName(selectedSection) : ''}`}
        primaryAction={{
          content: 'Regenerate Section',
          onAction: handleRegenerateSection,
          disabled: !sectionContext.trim(),
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setSectionModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              What would you like to change or emphasize? Be specific about what you want to adjust.
            </Text>
            <TextField
              label="Your guidance"
              value={sectionContext}
              onChange={(value) => setSectionContext(value)}
              multiline={4}
              autoComplete="off"
              placeholder='E.g., "Focus more on the outdoor adventure aspect" or "Our target audience is primarily millennials who love hiking"'
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        quotaStatus={subscription && usage ? {
          allowed: usage.imagesGenerated < subscription.imageQuota,
          used: usage.imagesGenerated,
          quota: subscription.imageQuota,
          remaining: Math.max(0, subscription.imageQuota - usage.imagesGenerated),
          tier: subscription.tier,
        } : undefined}
        onUpgradeSuccess={async () => {
          // Refresh subscription data
          const [newSub, newUsage] = await Promise.all([getSubscription(), getCurrentUsage()]);
          setSubscription(newSub);
          setUsage(newUsage);
        }}
      />
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  icon: React.FC<{ size?: number; className?: string }>;
  color: 'coral' | 'amber' | 'sage' | 'slate';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color }) => {
  const colorClasses = {
    coral: 'bg-coral-100 text-coral-600',
    amber: 'bg-amber-light text-amber-dark',
    sage: 'bg-sage-100 text-sage-600',
    slate: 'bg-slate-warm-100 text-slate-warm-600',
  };

  return (
    <div className="p-4 bg-slate-warm-50 rounded-xl text-center">
      <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} flex items-center justify-center mx-auto mb-2`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-slate-warm-800">{value}</p>
      <p className="text-xs text-slate-warm-500">{label}</p>
    </div>
  );
};

// Social Badge Component
interface SocialBadgeProps {
  platform: 'Instagram' | 'Facebook';
  connected: boolean;
  username?: string;
  pageName?: string;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

const SocialBadge: React.FC<SocialBadgeProps> = ({ 
  platform, 
  connected, 
  username,
  pageName,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect
}) => {
  const platformColors = {
    Instagram: 'bg-gradient-to-r from-pink-500 to-purple-500',
    Facebook: 'bg-blue-600',
  };

  const isLoading = isConnecting || isDisconnecting;

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl ${
      connected ? 'bg-sage-50 border border-sage-200' : 'bg-slate-warm-50 border border-slate-warm-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${platformColors[platform]} flex items-center justify-center`}>
          <span className="text-white text-sm font-bold">{platform[0]}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-warm-800">{platform}</span>
            {connected && <CheckCircle size={14} className="text-sage-500" />}
          </div>
          {connected ? (
            <p className="text-xs text-slate-warm-500">
              {platform === 'Facebook' && pageName ? pageName : username || 'Connected'}
            </p>
          ) : (
            <p className="text-xs text-slate-warm-400">Not connected</p>
          )}
        </div>
      </div>
      
      <div>
        {connected ? (
          <button
            onClick={onDisconnect}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-warm-500 hover:text-red-600 hover:bg-red-50 border border-slate-warm-200 hover:border-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDisconnecting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-slate-warm-700 hover:bg-slate-warm-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

// Feature Item Component
interface FeatureItemProps {
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-warm-50 hover:bg-slate-warm-100/80 transition-colors">
    <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0">
      <Icon size={18} className="text-slate-warm-600" />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-warm-800">{title}</p>
      <p className="text-xs text-slate-warm-500 leading-relaxed">{description}</p>
    </div>
  </div>
);

// Profile Section Component
interface ProfileSectionProps {
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  color: 'violet' | 'amber' | 'indigo' | 'rose' | 'emerald';
  children: React.ReactNode;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ 
  icon: Icon, 
  title, 
  color, 
  children,
  onRegenerate,
  isRegenerating 
}) => {
  const colorClasses = {
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="p-4 bg-slate-warm-50/50 rounded-xl border border-slate-warm-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
            <Icon size={16} />
          </div>
          <h3 className="font-semibold text-slate-warm-800">{title}</h3>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-warm-500 hover:text-violet-600 hover:bg-violet-50 transition-all disabled:opacity-50"
            title="Regenerate with custom context"
          >
            {isRegenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Edit3 size={12} />
            )}
            {isRegenerating ? 'Updating...' : 'Refine'}
          </button>
        )}
      </div>
      {children}
    </div>
  );
};

export default SettingsPage;
