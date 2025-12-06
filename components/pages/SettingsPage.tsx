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
} from 'lucide-react';
import { useShopifyContext } from '../ShopifyProvider';
import { subscribeToScheduledPosts } from '../../services/scheduledPostsService';
import { fetchUserMockups } from '../../services/mockupStorageService';
import { ScheduledPost, SavedMockup } from '../../types';

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

export default SettingsPage;
