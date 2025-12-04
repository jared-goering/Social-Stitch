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
  TopBar,
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

// Types
import { AppStep, UploadedDesign, MockupOption, AppView } from '../types';
import {
  ShopifyProduct,
  ShopifyProductImage,
  imageUrlToBase64,
} from '../services/shopifyProductService';

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

  // Top bar user menu
  const userMenuMarkup = (
    <TopBar.UserMenu
      name={displayShopName}
      initials={displayShopName.charAt(0).toUpperCase()}
      open={false}
      onToggle={() => {}}
      actions={[
        {
          items: [
            {
              content: 'Settings',
              onAction: () => handleNavigationSelect('settings'),
            },
          ],
        },
      ]}
    />
  );

  // Top bar
  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      userMenu={userMenuMarkup}
      onNavigationToggle={toggleMobileNavigation}
    />
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

  // Render content based on current view
  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return (
          <div className="p-6 max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-display font-bold text-slate-900 mb-3">
                Welcome to SocialStitch
              </h1>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                Create stunning social media content from your products with AI-powered mockups and captions.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <QuickActionCard
                title="Browse Products"
                description="Select products from your store to create content"
                icon="📦"
                onClick={() => handleNavigationSelect('products')}
              />
              <QuickActionCard
                title="Upload Design"
                description="Upload your own design for mockup generation"
                icon="🎨"
                onClick={() => handleNavigationSelect('create')}
              />
              <QuickActionCard
                title="View Calendar"
                description="Manage your scheduled social posts"
                icon="📅"
                onClick={() => handleNavigationSelect('calendar')}
              />
            </div>

            {/* Recent Activity or Tips */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
              <h2 className="font-semibold text-slate-800 mb-3">Quick Tips</h2>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500">•</span>
                  Browse your products and select images for AI mockup generation
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500">•</span>
                  AI will generate professional lifestyle photos with your products
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500">•</span>
                  Add AI-generated captions and schedule posts to social media
                </li>
              </ul>
            </div>
          </div>
        );

      case 'products':
        return (
          <div className="p-6 max-w-6xl mx-auto">
            <ProductBrowser
              onSelectProduct={handleProductSelect}
              onSelectImage={handleImageSelect}
            />
          </div>
        );

      case 'create':
        return (
          <div className="p-6 max-w-6xl mx-auto">
            {currentStep !== AppStep.SUCCESS && (
              <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />
            )}

            {currentStep === AppStep.UPLOAD && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-display font-bold text-slate-900 mb-4">
                    Start with your design
                  </h2>
                  <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                    Upload your design or{' '}
                    <button
                      onClick={() => handleNavigationSelect('products')}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      select from your products
                    </button>
                  </p>
                </div>
                <UploadSection onUpload={handleUpload} />
              </div>
            )}

            {currentStep === AppStep.MOCKUP_GENERATION && design && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MockupGenerator
                  design={design}
                  onMockupsSelected={handleMockupsSelection}
                  onBack={resetWorkflow}
                />
              </div>
            )}

            {currentStep === AppStep.CAPTIONING && selectedMockups.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          <div className="p-6 max-w-6xl mx-auto">
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
          <div className="p-6 max-w-6xl mx-auto">
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
          <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-display font-bold text-slate-900 mb-6">Settings</h1>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-800 mb-4">Connected Accounts</h2>
              <p className="text-sm text-slate-500">
                Social media account connections are managed in the Create Post workflow.
              </p>

              <div className="mt-6 pt-6 border-t border-slate-200">
                <h2 className="font-semibold text-slate-800 mb-4">Shop Information</h2>
                <div className="text-sm text-slate-600">
                  <p><strong>Shop:</strong> {shop || 'Not connected'}</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AppProvider i18n={enTranslations}>
      <Frame
        topBar={topBarMarkup}
        navigation={navigationMarkup}
        showMobileNavigation={mobileNavigationActive}
        onNavigationDismiss={toggleMobileNavigation}
      >
        {loadingMarkup}
        {renderContent()}
        {toastMarkup}
      </Frame>
    </AppProvider>
  );
};

// Quick Action Card Component
interface QuickActionCardProps {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  icon,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="p-6 bg-white rounded-2xl border border-slate-200 text-left hover:border-indigo-300 hover:shadow-lg transition-all group"
  >
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="font-semibold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">
      {title}
    </h3>
    <p className="text-sm text-slate-500">{description}</p>
  </button>
);

// Success View Component
interface SuccessViewProps {
  onCreateAnother: () => void;
  onViewCalendar: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({ onCreateAnother, onViewCalendar }) => (
  <div className="max-w-md mx-auto text-center animate-in zoom-in duration-500 py-12">
    <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
    <h2 className="text-3xl font-display font-bold text-slate-900 mb-4">
      Posted Successfully!
    </h2>
    <p className="text-slate-500 mb-8 leading-relaxed">
      Your content has been published to your selected social channels.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={onCreateAnother}
        className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-600 transition-all shadow-lg shadow-indigo-500/25"
      >
        Create Another Post
      </button>
      <button
        onClick={onViewCalendar}
        className="bg-white text-slate-700 px-8 py-3 rounded-xl font-semibold border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        View Calendar
      </button>
    </div>
  </div>
);

export default ShopifyApp;

