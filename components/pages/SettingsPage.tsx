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
} from 'lucide-react';
import { useShopifyContext } from '../ShopifyProvider';
import { subscribeToScheduledPosts } from '../../services/scheduledPostsService';
import { fetchUserMockups } from '../../services/mockupStorageService';
import { generateBrandProfile, getBrandProfile } from '../../services/brandProfileService';
import { isOAuthRequired, redirectToOAuth } from '../../services/shopifyProductService';
import { ScheduledPost, SavedMockup, BrandProfile } from '../../types';

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

  // Brand Profile state
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ stage: '', progress: 0 });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isOAuthError, setIsOAuthError] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

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
                <p className="text-sm text-slate-warm-700 leading-relaxed italic">
                  "{brandProfile.elevatorPitch}"
                </p>
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
              Social media account connections are managed during the post creation workflow. 
              When you create a post, you'll be prompted to connect your Facebook and Instagram 
              accounts through Meta's secure authentication.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <SocialBadge platform="Instagram" connected={false} />
              <SocialBadge platform="Facebook" connected={false} />
            </div>
            
            {onNavigateToCreate && (
              <button
                onClick={onNavigateToCreate}
                className="btn-primary text-white px-5 py-2.5 rounded-xl font-medium text-sm inline-flex items-center gap-2 mt-2"
              >
                Create a Post to Connect
                <ArrowRight size={16} />
              </button>
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
}

const SocialBadge: React.FC<SocialBadgeProps> = ({ platform, connected }) => {
  const platformColors = {
    Instagram: 'bg-gradient-to-r from-pink-500 to-purple-500',
    Facebook: 'bg-blue-600',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${
      connected ? 'bg-sage-50 border border-sage-200' : 'bg-slate-warm-100 border border-slate-warm-200'
    }`}>
      <div className={`w-6 h-6 rounded-lg ${platformColors[platform]} flex items-center justify-center`}>
        <span className="text-white text-xs font-bold">{platform[0]}</span>
      </div>
      <span className="text-sm font-medium text-slate-warm-700">{platform}</span>
      {connected ? (
        <CheckCircle size={14} className="text-sage-500" />
      ) : (
        <span className="text-xs text-slate-warm-400">Not connected</span>
      )}
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
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ icon: Icon, title, color, children }) => {
  const colorClasses = {
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="p-4 bg-slate-warm-50/50 rounded-xl border border-slate-warm-100">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon size={16} />
        </div>
        <h3 className="font-semibold text-slate-warm-800">{title}</h3>
      </div>
      {children}
    </div>
  );
};

export default SettingsPage;
