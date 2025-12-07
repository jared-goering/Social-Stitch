import React, { useState, useEffect, useCallback } from 'react';
import { UploadSection } from './components/UploadSection';
import { MockupGenerator } from './components/MockupGenerator';
import { CaptionReview } from './components/CaptionReview';
import { StepIndicator } from './components/StepIndicator';
import { CalendarView } from './components/Calendar';
import { GalleryView } from './components/GalleryView';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { SignInPage } from './components/SignInPage';
import { ShopifyApp } from './components/ShopifyApp';
import { useIsShopifyEmbedded } from './components/ShopifyProvider';
import { UsageIndicator } from './components/UsageIndicator';
import { UpgradeModal } from './components/UpgradeModal';
import { AppStep, UploadedDesign, MockupOption, AppView, QuotaCheckResult } from './types';
import { Shirt, Sparkles, CheckCheck, RotateCcw, Calendar, PlusCircle, CheckCircle, LogOut, Loader2, Images } from 'lucide-react';
import { isPopupWindow } from './services/socialAuthService';
import { canGenerateImage } from './services/subscriptionService';

// Storage key for session persistence
const STORAGE_KEY = 'socialstitch_session';

interface PersistedState {
  currentStep: AppStep;
  design: {
    id: string;
    base64: string;
    previewUrl: string;
  } | null;
  selectedMockups: MockupOption[];
}

// Main App wrapper with AuthProvider
export default function App() {
  const isShopifyEmbedded = useIsShopifyEmbedded();
  
  // Check if this is an OAuth popup window (for social media auth, not Firebase auth)
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthPopup = isPopupWindow() && (urlParams.get('auth_success') || urlParams.get('auth_error'));
  
  // If this is an OAuth popup, render a simple success/error message
  if (isOAuthPopup) {
    const success = urlParams.get('auth_success');
    const error = urlParams.get('auth_error');
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center p-8">
          {success ? (
            <>
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Connected Successfully!</h2>
              <p className="text-slate-500">You can close this window now.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-2xl">✕</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Connection Failed</h2>
              <p className="text-slate-500">{error ? decodeURIComponent(error) : 'Please try again.'}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // If running as Shopify embedded app, render ShopifyApp
  if (isShopifyEmbedded) {
    return <ShopifyApp />;
  }

  // Otherwise, render the standalone app with Firebase Auth
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

// The main app content (requires authentication)
function AuthenticatedApp() {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>('workflow');
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);
  const [design, setDesign] = useState<UploadedDesign | null>(null);
  const [selectedMockups, setSelectedMockups] = useState<MockupOption[]>([]);
  const [hasPersistedSession, setHasPersistedSession] = useState(false);
  
  // Subscription state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<QuotaCheckResult | null>(null);

  // Fetch quota status on mount and periodically
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const status = await canGenerateImage();
        setQuotaStatus(status);
      } catch (error) {
        console.error('Failed to fetch quota:', error);
      }
    };
    
    if (user) {
      fetchQuota();
      // Refresh quota every 30 seconds
      const interval = setInterval(fetchQuota, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Persist state changes - defined before useEffect that uses it
  const persistState = useCallback((
    step: AppStep,
    designData: UploadedDesign | null,
    mockups: MockupOption[]
  ) => {
    if (step === AppStep.SUCCESS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    
    try {
      const toSave: PersistedState = {
        currentStep: step,
        design: designData ? {
          id: designData.id,
          base64: designData.base64,
          previewUrl: designData.previewUrl
        } : null,
        selectedMockups: mockups
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to persist session:', error);
    }
  }, []);

  // Load persisted state on mount - hooks must be called before conditional returns
  useEffect(() => {
    if (!user) return; // Only restore state if authenticated
    
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: PersistedState = JSON.parse(saved);
        
        if (parsed.currentStep && parsed.currentStep !== AppStep.SUCCESS) {
          setCurrentStep(parsed.currentStep);
          
          if (parsed.design) {
            // Reconstruct design object (file won't be available but we have base64)
            setDesign({
              id: parsed.design.id,
              file: new File([], 'restored'),
              previewUrl: parsed.design.previewUrl,
              base64: parsed.design.base64
            });
          }
          
          if (parsed.selectedMockups?.length) {
            setSelectedMockups(parsed.selectedMockups);
          }
          
          setHasPersistedSession(true);
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  // Show loading state while auth initializes
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show sign-in page if not authenticated
  if (!user) {
    return <SignInPage />;
  }

  const handleUpload = (uploadedDesign: UploadedDesign) => {
    setDesign(uploadedDesign);
    setCurrentStep(AppStep.MOCKUP_GENERATION);
    persistState(AppStep.MOCKUP_GENERATION, uploadedDesign, selectedMockups);
  };

  const handleMockupsSelection = (mockups: MockupOption[]) => {
    setSelectedMockups(mockups);
    setCurrentStep(AppStep.CAPTIONING);
    persistState(AppStep.CAPTIONING, design, mockups);
  };

  const handleSuccess = () => {
    setCurrentStep(AppStep.SUCCESS);
    sessionStorage.removeItem(STORAGE_KEY);
    setHasPersistedSession(false);
  };

  const resetApp = () => {
    setDesign(null);
    setSelectedMockups([]);
    setCurrentStep(AppStep.UPLOAD);
    sessionStorage.removeItem(STORAGE_KEY);
    setHasPersistedSession(false);
  };

  // Handle step indicator clicks for navigation
  const handleStepClick = (step: AppStep) => {
    // Only allow going back to completed steps
    const stepOrder = [AppStep.UPLOAD, AppStep.MOCKUP_GENERATION, AppStep.CAPTIONING, AppStep.REVIEW];
    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(step);
    
    if (targetIndex < currentIndex) {
      setCurrentStep(step);
      persistState(step, design, selectedMockups);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Gradient Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-50">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-pink-500/5" />
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Shirt size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-display font-bold tracking-tight text-slate-900">
              Social<span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">Stitch</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
              <button
                onClick={() => setCurrentView('workflow')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  currentView === 'workflow'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <PlusCircle size={12} />
                Create
              </button>
              <button
                onClick={() => setCurrentView('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  currentView === 'calendar'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Calendar size={12} />
                Calendar
              </button>
              <button
                onClick={() => setCurrentView('gallery')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  currentView === 'gallery'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Images size={12} />
                Gallery
              </button>
            </div>

            {currentView === 'workflow' && hasPersistedSession && currentStep !== AppStep.SUCCESS && (
              <button
                onClick={resetApp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-600 transition-colors"
              >
                <RotateCcw size={12} />
                Start Fresh
              </button>
            )}
            
            {/* Usage Indicator */}
            <UsageIndicator 
              compact 
              showUpgrade={false}
              onUpgradeClick={() => setShowUpgradeModal(true)}
            />

            {/* User Menu */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-slate-200"
                />
              )}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gradient-subtle py-12 px-4">
        {/* Calendar View */}
        {currentView === 'calendar' && (
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CalendarView 
              onCreatePost={() => {
                setCurrentView('workflow');
                resetApp();
              }}
            />
          </div>
        )}

        {/* Gallery View */}
        {currentView === 'gallery' && (
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <GalleryView 
              onCreatePost={() => {
                setCurrentView('workflow');
                resetApp();
              }}
            />
          </div>
        )}

        {/* Workflow View */}
        {currentView === 'workflow' && (
          <>
            {currentStep !== AppStep.SUCCESS && (
              <StepIndicator currentStep={currentStep} onStepClick={handleStepClick} />
            )}

            <div className="max-w-6xl mx-auto">
              {currentStep === AppStep.UPLOAD && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center mb-10">
                    <h2 className="text-3xl font-display font-bold text-slate-900 mb-4">Start with your design</h2>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                      Upload your t-shirt graphic (PNG recommended). Our Gemini AI models will handle the photography and copywriting.
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
                        onBack={resetApp}
                    />
                 </div>
              )}

              {currentStep === AppStep.CAPTIONING && selectedMockups.length > 0 && (
                 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <CaptionReview 
                        mockups={selectedMockups}
                        onSuccess={handleSuccess}
                        onBack={() => setCurrentStep(AppStep.MOCKUP_GENERATION)}
                        onScheduled={() => {
                          // Navigate to calendar view after scheduling
                          setCurrentView('calendar');
                          resetApp();
                        }}
                    />
                 </div>
              )}

              {currentStep === AppStep.SUCCESS && (
                <div className="max-w-md mx-auto text-center animate-in zoom-in duration-500 py-12 relative">
                    {/* Celebration particles */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="confetti rounded-full"
                          style={{
                            left: `${10 + (i * 7)}%`,
                            backgroundColor: ['#6366f1', '#f59e0b', '#10b981', '#f472b6', '#14b8a6'][i % 5],
                            animationDelay: `${i * 0.15}s`,
                            width: `${8 + (i % 3) * 4}px`,
                            height: `${8 + (i % 3) * 4}px`,
                          }}
                        />
                      ))}
                    </div>
                    
                    <div className="relative animate-success-bounce">
                      <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30 animate-float">
                          <CheckCheck size={48} />
                      </div>
                    </div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 mb-4">Posted Successfully!</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed">
                        Your content has been published to your selected social channels.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button 
                          onClick={resetApp}
                          className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-600 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
                      >
                          Create Another Post
                      </button>
                      <button 
                          onClick={() => {
                            setCurrentView('calendar');
                            resetApp();
                          }}
                          className="bg-white text-slate-700 px-8 py-3 rounded-xl font-semibold border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                      >
                          <Calendar size={18} />
                          View Calendar
                      </button>
                    </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200/50 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>&copy; {new Date().getFullYear()} SocialStitch. Built with React & Google Gemini.</p>
        </div>
      </footer>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        quotaStatus={quotaStatus || undefined}
        demoMode={import.meta.env.VITE_DEMO_MODE === 'true'}
        onUpgradeSuccess={() => {
          // Refresh quota after upgrade
          canGenerateImage().then(setQuotaStatus);
        }}
      />
    </div>
  );
}