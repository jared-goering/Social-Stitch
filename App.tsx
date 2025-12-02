import React, { useState, useEffect, useCallback } from 'react';
import { UploadSection } from './components/UploadSection';
import { MockupGenerator } from './components/MockupGenerator';
import { CaptionReview } from './components/CaptionReview';
import { StepIndicator } from './components/StepIndicator';
import { AppStep, UploadedDesign, MockupOption } from './types';
import { Shirt, Sparkles, CheckCheck, RotateCcw } from 'lucide-react';

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

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);
  const [design, setDesign] = useState<UploadedDesign | null>(null);
  const [selectedMockups, setSelectedMockups] = useState<MockupOption[]>([]);
  const [hasPersistedSession, setHasPersistedSession] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
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
  }, []);

  // Persist state changes
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
            {hasPersistedSession && currentStep !== AppStep.SUCCESS && (
              <button
                onClick={resetApp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-600 transition-colors"
              >
                <RotateCcw size={12} />
                Start Fresh
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/50">
              <Sparkles size={14} className="text-amber-500" />
              <span className="text-xs font-medium text-amber-700">AI-Powered Marketing</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gradient-subtle py-12 px-4">
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
                    Your content has been scheduled and posted to your selected social channels.
                </p>
                <button 
                    onClick={resetApp}
                    className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-600 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
                >
                    Create Another Post
                </button>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200/50 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>&copy; {new Date().getFullYear()} SocialStitch. Built with React & Google Gemini.</p>
        </div>
      </footer>
    </div>
  );
}