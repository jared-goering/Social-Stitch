/**
 * Shopify App Frame Component
 *
 * The main wrapper for the Shopify embedded app experience.
 * Uses Polaris for navigation and layout, while keeping custom components
 * for the core functionality.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  AppProvider,
  Frame,
  Navigation,
  Toast,
  Loading,
} from '@shopify/polaris';
import {
  HomeIcon,
  ProductIcon,
  CalendarIcon,
  ImageIcon,
  SettingsIcon,
} from '@shopify/polaris-icons';
import enTranslations from '@shopify/polaris/locales/en.json';

// Import existing custom components
import { UploadSection } from './UploadSection';
import { MockupGenerator } from './MockupGenerator';
import { CaptionReview } from './CaptionReview';
import { CalendarView } from './Calendar';
import { GalleryView } from './GalleryView';
import { ProductBrowser } from './ProductBrowser';
import { StepIndicator } from './StepIndicator';

// Icons
import {
  Package,
  Palette,
  CalendarDays,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  Zap,
  Image as ImageLucide,
  Calendar,
  Check,
  AlertCircle,
  Menu,
} from 'lucide-react';

// Types
import { AppStep, UploadedDesign, MockupOption, AppView, ScheduledPost } from '../types';
import {
  ShopifyProduct,
  ShopifyProductImage,
  imageUrlToBase64,
} from '../services/shopifyProductService';
import { subscribeToScheduledPosts } from '../services/scheduledPostsService';

// Shopify context
import { useShopifyContext } from './ShopifyProvider';

type ShopifyAppView = 'home' | 'products' | 'create' | 'calendar' | 'gallery' | 'settings';

interface ShopifyAppProps {
  shopName?: string;
}

export const ShopifyApp: React.FC<ShopifyAppProps> = ({ shopName }) => {
  const { shop, isAuthenticated } = useShopifyContext();
  const displayShopName = shopName || shop?.replace('.myshopify.com', '') || 'Your Store';

  // Navigation state
  const [currentView, setCurrentView] = useState<ShopifyAppView>('home');
  const [mobileNavigationActive, setMobileNavigationActive] = useState(false);

  // Workflow state (same as original App.tsx)
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);
  const [design, setDesign] = useState<UploadedDesign | null>(null);
  const [selectedMockups, setSelectedMockups] = useState<MockupOption[]>([]);

  // Toast notifications
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Recent posts for home page
  const [recentPosts, setRecentPosts] = useState<ScheduledPost[]>([]);

  // Subscribe to posts for recent activity
  useEffect(() => {
    const unsubscribe = subscribeToScheduledPosts((posts) => {
      // Get last 5 posts sorted by creation date
      const sorted = [...posts].sort((a, b) => 
        (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
      ).slice(0, 5);
      setRecentPosts(sorted);
    });
    return () => unsubscribe();
  }, []);

  // Show toast message
  const showToast = useCallback((message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  }, []);

  const toggleMobileNavigation = useCallback(
    () => setMobileNavigationActive((active) => !active),
    []
  );

  const handleNavigationSelect = useCallback((view: ShopifyAppView) => {
    setCurrentView(view);
    setMobileNavigationActive(false);
  }, []);

  // Handle product selection from ProductBrowser
  const handleProductSelect = useCallback(async (product: ShopifyProduct) => {
    if (!product.images.length) {
      showToast('This product has no images', true);
      return;
    }

    setIsLoading(true);
    try {
      // Use the first image
      const image = product.images[0];
      const base64 = await imageUrlToBase64(image.src);

      const uploadedDesign: UploadedDesign = {
        id: `shopify-${product.id}-${image.id}`,
        file: new File([], product.title),
        previewUrl: image.src,
        base64,
      };

      setDesign(uploadedDesign);
      setCurrentStep(AppStep.MOCKUP_GENERATION);
      setCurrentView('create');
      showToast(`Product "${product.title}" loaded`);
    } catch (error) {
      console.error('Error loading product image:', error);
      showToast('Failed to load product image', true);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Handle image selection from ProductBrowser
  const handleImageSelect = useCallback(async (
    image: ShopifyProductImage,
    product: ShopifyProduct
  ) => {
    setIsLoading(true);
    try {
      const base64 = await imageUrlToBase64(image.src);

      const uploadedDesign: UploadedDesign = {
        id: `shopify-${product.id}-${image.id}`,
        file: new File([], `${product.title} - Image ${image.position || 1}`),
        previewUrl: image.src,
        base64,
      };

      setDesign(uploadedDesign);
      setCurrentStep(AppStep.MOCKUP_GENERATION);
      setCurrentView('create');
      showToast('Image loaded successfully');
    } catch (error) {
      console.error('Error loading image:', error);
      showToast('Failed to load image', true);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Handle manual upload (same as original)
  const handleUpload = useCallback((uploadedDesign: UploadedDesign) => {
    setDesign(uploadedDesign);
    setCurrentStep(AppStep.MOCKUP_GENERATION);
  }, []);

  // Handle mockup selection
  const handleMockupsSelection = useCallback((mockups: MockupOption[]) => {
    setSelectedMockups(mockups);
    setCurrentStep(AppStep.CAPTIONING);
  }, []);

  // Handle success
  const handleSuccess = useCallback(() => {
    setCurrentStep(AppStep.SUCCESS);
    showToast('Post published successfully!');
  }, [showToast]);

  // Handle scheduled post
  const handleScheduled = useCallback(() => {
    setCurrentView('calendar');
    resetWorkflow();
    showToast('Post scheduled successfully!');
  }, [showToast]);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    setDesign(null);
    setSelectedMockups([]);
    setCurrentStep(AppStep.UPLOAD);
  }, []);

  // Handle step click for navigation
  const handleStepClick = useCallback((step: AppStep) => {
    const stepOrder = [AppStep.UPLOAD, AppStep.MOCKUP_GENERATION, AppStep.CAPTIONING, AppStep.REVIEW];
    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(step);

    if (targetIndex < currentIndex) {
      setCurrentStep(step);
    }
  }, [currentStep]);

  // Navigation items
  const navigationMarkup = (
    <Navigation location={`/${currentView}`}>
      <Navigation.Section
        title="Content Creation"
        items={[
          {
            url: '#',
            label: 'Home',
            icon: HomeIcon,
            selected: currentView === 'home',
            onClick: () => handleNavigationSelect('home'),
          },
          {
            url: '#',
            label: 'Products',
            icon: ProductIcon,
            selected: currentView === 'products',
            onClick: () => handleNavigationSelect('products'),
          },
          {
            url: '#',
            label: 'Create Post',
            icon: ImageIcon,
            selected: currentView === 'create',
            onClick: () => handleNavigationSelect('create'),
          },
        ]}
      />
      <Navigation.Section
        title="Management"
        items={[
          {
            url: '#',
            label: 'Calendar',
            icon: CalendarIcon,
            selected: currentView === 'calendar',
            onClick: () => handleNavigationSelect('calendar'),
          },
          {
            url: '#',
            label: 'Gallery',
            icon: ImageIcon,
            selected: currentView === 'gallery',
            onClick: () => handleNavigationSelect('gallery'),
          },
        ]}
      />
      <Navigation.Section
        title="Settings"
        items={[
          {
            url: '#',
            label: 'Settings',
            icon: SettingsIcon,
            selected: currentView === 'settings',
            onClick: () => handleNavigationSelect('settings'),
          },
        ]}
      />
    </Navigation>
  );

  // Get step info for the slim header
  const getStepInfo = () => {
    const stepLabels: Record<AppStep, { num: number; label: string }> = {
      [AppStep.UPLOAD]: { num: 1, label: 'Upload' },
      [AppStep.MOCKUP_GENERATION]: { num: 2, label: 'AI Mockup' },
      [AppStep.CAPTIONING]: { num: 3, label: 'Captions' },
      [AppStep.REVIEW]: { num: 4, label: 'Review' },
      [AppStep.SUCCESS]: { num: 4, label: 'Done' },
    };
    return stepLabels[currentStep] || { num: 1, label: 'Upload' };
  };

  // Slim custom header component
  const slimHeaderMarkup = (
    <div className="h-10 bg-slate-warm-800 flex items-center justify-between px-4 border-b border-slate-warm-700">
      {/* Left: Mobile nav toggle + App name */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileNavigation}
          className="lg:hidden p-1.5 -ml-1.5 rounded-md text-slate-warm-300 hover:text-white hover:bg-slate-warm-700 transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-coral-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="text-white font-semibold text-sm">SocialStitch</span>
        </div>
      </div>

      {/* Center: Step indicator (only in create view) */}
      {currentView === 'create' && currentStep !== AppStep.SUCCESS && (
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((step) => {
              const stepInfo = getStepInfo();
              const isCompleted = step < stepInfo.num;
              const isCurrent = step === stepInfo.num;
              return (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-all ${
                    isCompleted
                      ? 'bg-coral-400'
                      : isCurrent
                        ? 'bg-coral-500 ring-2 ring-coral-400/50'
                        : 'bg-slate-warm-600'
                  }`}
                />
              );
            })}
          </div>
          <span className="text-slate-warm-300 text-xs">
            Step {getStepInfo().num} of 4
          </span>
          <span className="text-slate-warm-500 text-xs">•</span>
          <span className="text-white text-xs font-medium">{getStepInfo().label}</span>
        </div>
      )}

      {/* Right: View label */}
      <div className="text-slate-warm-400 text-xs capitalize">
        {currentView === 'create' ? '' : currentView}
      </div>
    </div>
  );

  // Toast markup
  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setToastActive(false)}
      duration={4000}
    />
  ) : null;

  // Loading markup
  const loadingMarkup = isLoading ? <Loading /> : null;

  // Stats for home page
  const stats = {
    scheduled: recentPosts.filter(p => p.status === 'scheduled').length,
    published: recentPosts.filter(p => p.status === 'published').length,
    total: recentPosts.length,
  };

  // Render content based on current view
  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return (
          <div className="p-4 max-w-6xl mx-auto page-enter">
            {/* Compact Hero Section */}
            <div className="relative mb-6 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-coral-50 via-white to-amber-light/30" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-coral-200/20 to-transparent rounded-full blur-2xl -translate-y-1/3 translate-x-1/4" />
              
              <div className="relative px-6 py-6 flex items-center gap-6">
                {/* Icon */}
                <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-gradient-to-br from-coral-500 to-coral-600 items-center justify-center shadow-lg shadow-coral-500/25 flex-shrink-0 animate-float">
                  <Zap size={28} className="text-white" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl md:text-3xl font-display text-slate-warm-900">
                      Welcome to <span className="text-coral-500">SocialStitch</span>
                    </h1>
                    <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 rounded-full border border-coral-200 text-xs font-medium text-coral-600">
                      <Sparkles size={12} />
                      AI-Powered
                    </span>
                  </div>
                  <p className="text-slate-warm-500 text-sm md:text-base">
                    Transform products into stunning social content with AI mockups and captions.
                  </p>
                </div>
                
                {/* CTA Buttons */}
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => handleNavigationSelect('gallery')}
                    className="px-4 py-2.5 rounded-xl font-medium text-slate-warm-600 hover:bg-white/80 transition-all text-sm"
                  >
                    View Gallery
                  </button>
                  <button
                    onClick={() => handleNavigationSelect('products')}
                    className="btn-primary text-white px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 text-sm"
                  >
                    Get Started
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              
              {/* Mobile CTA */}
              <div className="md:hidden px-6 pb-5 flex gap-3">
                <button
                  onClick={() => handleNavigationSelect('products')}
                  className="btn-primary text-white px-5 py-2.5 rounded-xl font-semibold inline-flex items-center justify-center gap-2 text-sm flex-1"
                >
                  Get Started
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => handleNavigationSelect('gallery')}
                  className="px-4 py-2.5 rounded-xl font-medium text-slate-warm-600 bg-white border border-slate-warm-200 text-sm"
                >
                  Gallery
                </button>
              </div>
            </div>

            {/* Quick Stats - Inline */}
            {stats.total > 0 && (
              <div className="flex items-center gap-6 mb-6 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-warm-800">{stats.total}</span>
                  <span className="text-sm text-slate-warm-500">Posts</span>
                </div>
                <div className="w-px h-6 bg-slate-warm-200" />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-amber-500">{stats.scheduled}</span>
                  <span className="text-sm text-slate-warm-500">Scheduled</span>
                </div>
                <div className="w-px h-6 bg-slate-warm-200" />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-sage-500">{stats.published}</span>
                  <span className="text-sm text-slate-warm-500">Published</span>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10 stagger-children">
              <QuickActionCard
                title="Browse Products"
                description="Select products from your store to create content"
                icon={Package}
                iconBg="coral"
                onClick={() => handleNavigationSelect('products')}
                stat="Your catalog"
              />
              <QuickActionCard
                title="Upload Design"
                description="Upload your own design for mockup generation"
                icon={Palette}
                iconBg="amber"
                onClick={() => handleNavigationSelect('create')}
                stat="Custom upload"
              />
              <QuickActionCard
                title="View Calendar"
                description="Manage your scheduled social posts"
                icon={CalendarDays}
                iconBg="sage"
                onClick={() => handleNavigationSelect('calendar')}
                stat={`${stats.scheduled} scheduled`}
              />
            </div>

            {/* Recent Activity or Getting Started */}
            {recentPosts.length > 0 ? (
              <div className="card-elevated overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-warm-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-warm-100 flex items-center justify-center">
                      <Clock size={18} className="text-slate-warm-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-warm-800">Recent Activity</h2>
                      <p className="text-xs text-slate-warm-400">Your latest posts</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNavigationSelect('calendar')}
                    className="text-sm font-medium text-coral-500 hover:text-coral-600 transition-colors"
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y divide-slate-warm-100">
                  {recentPosts.slice(0, 4).map((post, index) => (
                    <RecentPostItem key={post.id} post={post} index={index} />
                  ))}
                </div>
              </div>
            ) : (
              <GettingStartedCard onAction={handleNavigationSelect} />
            )}
          </div>
        );

      case 'products':
        return (
          <div className="p-4 max-w-6xl mx-auto page-enter">
            <ProductBrowser
              onSelectProduct={handleProductSelect}
              onSelectImage={handleImageSelect}
            />
          </div>
        );

      case 'create':
        return (
          <div className="p-4 max-w-6xl mx-auto page-enter">
            {currentStep !== AppStep.SUCCESS && (
              <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />
            )}

            {currentStep === AppStep.UPLOAD && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <UploadSection onUpload={handleUpload} />
                <p className="text-center text-sm text-slate-warm-500 mt-4">
                  Or{' '}
                  <button
                    onClick={() => handleNavigationSelect('products')}
                    className="text-coral-500 hover:text-coral-600 font-medium underline underline-offset-2"
                  >
                    select from your products
                  </button>
                </p>
              </div>
            )}

            {currentStep === AppStep.MOCKUP_GENERATION && design && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <MockupGenerator
                  design={design}
                  onMockupsSelected={handleMockupsSelection}
                  onBack={resetWorkflow}
                />
              </div>
            )}

            {currentStep === AppStep.CAPTIONING && selectedMockups.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <CaptionReview
                  mockups={selectedMockups}
                  onSuccess={handleSuccess}
                  onBack={() => setCurrentStep(AppStep.MOCKUP_GENERATION)}
                  onScheduled={handleScheduled}
                />
              </div>
            )}

            {currentStep === AppStep.SUCCESS && (
              <SuccessView
                onCreateAnother={() => {
                  resetWorkflow();
                }}
                onViewCalendar={() => {
                  handleNavigationSelect('calendar');
                  resetWorkflow();
                }}
              />
            )}
          </div>
        );

      case 'calendar':
        return (
          <div className="p-4 max-w-6xl mx-auto page-enter">
            <CalendarView
              onCreatePost={() => {
                handleNavigationSelect('create');
                resetWorkflow();
              }}
            />
          </div>
        );

      case 'gallery':
        return (
          <div className="p-4 max-w-6xl mx-auto page-enter">
            <GalleryView
              onCreatePost={() => {
                handleNavigationSelect('create');
                resetWorkflow();
              }}
            />
          </div>
        );

      case 'settings':
        return (
          <div className="p-4 max-w-4xl mx-auto page-enter">
            <SettingsView shop={shop} onNavigateToCreate={() => handleNavigationSelect('create')} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AppProvider i18n={enTranslations}>
      <Frame
        navigation={navigationMarkup}
        showMobileNavigation={mobileNavigationActive}
        onNavigationDismiss={toggleMobileNavigation}
      >
        {slimHeaderMarkup}
        {loadingMarkup}
        {renderContent()}
        {toastMarkup}
      </Frame>
    </AppProvider>
  );
};

// Quick Action Card Component - Redesigned
interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
  iconBg: 'coral' | 'amber' | 'sage' | 'slate';
  onClick: () => void;
  stat?: string;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  icon: Icon,
  iconBg,
  onClick,
  stat,
}) => {
  const bgClasses = {
    coral: 'icon-container-coral',
    amber: 'icon-container-amber',
    sage: 'icon-container-sage',
    slate: 'icon-container-slate',
  };

  const hoverClasses = {
    coral: 'group-hover:shadow-coral-500/20',
    amber: 'group-hover:shadow-amber-accent/20',
    sage: 'group-hover:shadow-sage-400/20',
    slate: 'group-hover:shadow-slate-warm-500/20',
  };

  return (
    <button
      onClick={onClick}
      className="card-interactive p-6 text-left group"
    >
      <div className={`icon-container w-14 h-14 mb-4 ${bgClasses[iconBg]} group-hover:scale-105 transition-transform ${hoverClasses[iconBg]}`}>
        <Icon size={24} className="text-white" />
      </div>
      <h3 className="font-semibold text-slate-warm-800 text-lg mb-1.5 group-hover:text-coral-600 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-slate-warm-500 mb-3 leading-relaxed">{description}</p>
      {stat && (
        <div className="flex items-center gap-1.5 text-xs text-slate-warm-400">
          <TrendingUp size={12} />
          <span>{stat}</span>
        </div>
      )}
      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-coral-500 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Get started</span>
        <ArrowRight size={14} />
      </div>
    </button>
  );
};

// Recent Post Item
interface RecentPostItemProps {
  post: ScheduledPost;
  index: number;
}

const RecentPostItem: React.FC<RecentPostItemProps> = ({ post, index }) => {
  const statusConfig = {
    scheduled: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Scheduled' },
    published: { icon: CheckCircle2, color: 'text-sage-500', bg: 'bg-sage-50', label: 'Published' },
    failed: { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Failed' },
  };

  const config = statusConfig[post.status];
  const StatusIcon = config.icon;
  const caption = post.captions?.instagram || post.captions?.facebook || '';
  const previewCaption = caption.length > 60 ? caption.slice(0, 60) + '...' : caption;

  return (
    <div 
      className="flex items-center gap-4 p-4 hover:bg-slate-warm-50 transition-colors"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {post.imageUrls?.[0] ? (
        <img 
          src={post.imageUrls[0]} 
          alt="Post preview" 
          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-slate-warm-200"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-slate-warm-100 flex items-center justify-center flex-shrink-0">
          <ImageLucide size={20} className="text-slate-warm-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-warm-700 truncate">{previewCaption || 'No caption'}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
            <StatusIcon size={10} />
            {config.label}
          </span>
          <span className="text-xs text-slate-warm-400">
            {post.scheduledFor?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        {post.platforms?.map(platform => (
          <span 
            key={platform}
            className={`text-xs px-2 py-1 rounded-lg font-medium ${
              platform === 'instagram' 
                ? 'bg-pink-50 text-pink-600' 
                : 'bg-blue-50 text-blue-600'
            }`}
          >
            {platform === 'instagram' ? 'IG' : 'FB'}
          </span>
        ))}
      </div>
    </div>
  );
};

// Getting Started Card for new users
interface GettingStartedCardProps {
  onAction: (view: ShopifyAppView) => void;
}

const GettingStartedCard: React.FC<GettingStartedCardProps> = ({ onAction }) => {
  const steps = [
    { label: 'Browse your products', action: 'products' as ShopifyAppView, icon: Package },
    { label: 'Create your first mockup', action: 'create' as ShopifyAppView, icon: Sparkles },
    { label: 'Schedule a post', action: 'calendar' as ShopifyAppView, icon: CalendarDays },
  ];

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-warm-100 bg-gradient-to-r from-coral-50 to-amber-light/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
            <Zap size={18} className="text-coral-500" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-warm-800">Get Started</h2>
            <p className="text-xs text-slate-warm-500">Create your first social post in minutes</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => onAction(step.action)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-warm-200 hover:border-coral-300 hover:bg-coral-50/50 transition-all group text-left"
            >
              <div className="w-8 h-8 rounded-full bg-slate-warm-100 flex items-center justify-center text-sm font-bold text-slate-warm-600 group-hover:bg-coral-500 group-hover:text-white transition-colors">
                {index + 1}
              </div>
              <div className="flex-1">
                <span className="font-medium text-slate-warm-700 group-hover:text-coral-600 transition-colors">
                  {step.label}
                </span>
              </div>
              <step.icon size={18} className="text-slate-warm-400 group-hover:text-coral-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Settings View Component - Enhanced
interface SettingsViewProps {
  shop: string | null;
  onNavigateToCreate: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ shop, onNavigateToCreate }) => (
  <div>
    <div className="mb-8">
      <h1 className="text-3xl font-display text-slate-warm-900 mb-2">Settings</h1>
      <p className="text-slate-warm-500">Manage your SocialStitch preferences</p>
    </div>

    <div className="space-y-6">
      {/* Shop Information Card */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-container icon-container-coral w-10 h-10">
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-warm-800">Shop Information</h2>
            <p className="text-xs text-slate-warm-400">Your connected Shopify store</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-slate-warm-50 rounded-xl">
          <div>
            <p className="text-sm text-slate-warm-500">Shop Domain</p>
            <p className="font-medium text-slate-warm-800">{shop || 'Not connected'}</p>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            shop ? 'bg-sage-100 text-sage-600' : 'bg-red-100 text-red-600'
          }`}>
            {shop ? <Check size={14} /> : <AlertCircle size={14} />}
            {shop ? 'Connected' : 'Not Connected'}
          </div>
        </div>
      </div>

      {/* Social Accounts Card */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-container icon-container-sage w-10 h-10">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-warm-800">Social Media Accounts</h2>
            <p className="text-xs text-slate-warm-400">Connect your social profiles</p>
          </div>
        </div>
        <p className="text-sm text-slate-warm-500 mb-4">
          Social media account connections are managed during the post creation workflow. 
          Connect your Facebook and Instagram accounts when you create your first post.
        </p>
        <button
          onClick={onNavigateToCreate}
          className="btn-primary text-white px-5 py-2.5 rounded-xl font-medium text-sm inline-flex items-center gap-2"
        >
          Create a Post
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Features Card */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-container icon-container-amber w-10 h-10">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-warm-800">Available Features</h2>
            <p className="text-xs text-slate-warm-400">What you can do with SocialStitch</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { icon: Package, label: 'Product Import', desc: 'Select products from Shopify' },
            { icon: ImageLucide, label: 'AI Mockups', desc: 'Generate lifestyle photos' },
            { icon: Sparkles, label: 'AI Captions', desc: 'Auto-generate captions' },
            { icon: Calendar, label: 'Social Scheduling', desc: 'Schedule to FB & IG' },
          ].map((feature, index) => (
            <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-warm-50">
              <feature.icon size={18} className="text-slate-warm-600" />
              <div>
                <p className="text-sm font-medium text-slate-warm-700">{feature.label}</p>
                <p className="text-xs text-slate-warm-400">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Success View Component - Updated with new colors
interface SuccessViewProps {
  onCreateAnother: () => void;
  onViewCalendar: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({ onCreateAnother, onViewCalendar }) => (
  <div className="max-w-md mx-auto text-center animate-in zoom-in duration-500 py-12 relative">
    {/* Celebration particles */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="confetti rounded-full"
          style={{
            left: `${10 + (i * 7)}%`,
            backgroundColor: ['#E85D4A', '#F5A623', '#5FB97E', '#3D4F5F', '#f38a75'][i % 5],
            animationDelay: `${i * 0.15}s`,
            width: `${8 + (i % 3) * 4}px`,
            height: `${8 + (i % 3) * 4}px`,
          }}
        />
      ))}
    </div>

    <div className="relative animate-success-bounce">
      <div className="w-24 h-24 bg-gradient-to-br from-sage-400 to-sage-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-sage-500/30 animate-float">
        <Check size={48} strokeWidth={3} />
      </div>
    </div>
    <h2 className="text-3xl font-display text-slate-warm-900 mb-4">
      Posted Successfully!
    </h2>
    <p className="text-slate-warm-500 mb-8 leading-relaxed">
      Your content has been published to your selected social channels.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={onCreateAnother}
        className="btn-primary text-white px-8 py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2"
      >
        Create Another Post
      </button>
      <button
        onClick={onViewCalendar}
        className="bg-white text-slate-warm-700 px-8 py-3 rounded-xl font-semibold border-2 border-slate-warm-200 hover:border-coral-300 hover:bg-coral-50 transition-all flex items-center justify-center gap-2"
      >
        <Calendar size={18} />
        View Calendar
      </button>
    </div>
  </div>
);

export default ShopifyApp;
