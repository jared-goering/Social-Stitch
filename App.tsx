import React, { useState } from 'react';
import { UploadSection } from './components/UploadSection';
import { MockupGenerator } from './components/MockupGenerator';
import { CaptionReview } from './components/CaptionReview';
import { StepIndicator } from './components/StepIndicator';
import { AppStep, UploadedDesign, MockupOption } from './types';
import { Shirt, Sparkles, CheckCheck } from 'lucide-react';

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD);
  const [design, setDesign] = useState<UploadedDesign | null>(null);
  const [selectedMockup, setSelectedMockup] = useState<MockupOption | null>(null);

  const handleUpload = (uploadedDesign: UploadedDesign) => {
    setDesign(uploadedDesign);
    setCurrentStep(AppStep.MOCKUP_GENERATION);
  };

  const handleMockupSelection = (mockup: MockupOption) => {
    setSelectedMockup(mockup);
    setCurrentStep(AppStep.CAPTIONING);
  };

  const handleSuccess = () => {
    setCurrentStep(AppStep.SUCCESS);
  };

  const resetApp = () => {
    setDesign(null);
    setSelectedMockup(null);
    setCurrentStep(AppStep.UPLOAD);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <Shirt size={28} strokeWidth={2.5} />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Social<span className="text-indigo-600">Stitch</span></h1>
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Sparkles size={16} className="text-amber-500" />
            <span>AI-Powered Marketing</span>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-slate-50 py-12 px-4">
        {currentStep !== AppStep.SUCCESS && (
          <StepIndicator currentStep={currentStep} />
        )}

        <div className="max-w-6xl mx-auto">
          {currentStep === AppStep.UPLOAD && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Start with your design</h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
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
                    onMockupSelected={handleMockupSelection}
                    onBack={resetApp}
                />
             </div>
          )}

          {currentStep === AppStep.CAPTIONING && selectedMockup && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CaptionReview 
                    mockup={selectedMockup}
                    onSuccess={handleSuccess}
                    onBack={() => setCurrentStep(AppStep.MOCKUP_GENERATION)}
                />
             </div>
          )}

          {currentStep === AppStep.SUCCESS && (
            <div className="max-w-md mx-auto text-center animate-in zoom-in duration-500 py-12">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCheck size={48} />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Posted Successfully!</h2>
                <p className="text-slate-600 mb-8">
                    Your content has been scheduled and posted to your selected social channels.
                </p>
                <button 
                    onClick={resetApp}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
                >
                    Create Another Post
                </button>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>&copy; {new Date().getFullYear()} SocialStitch. Built with React & Google Gemini.</p>
        </div>
      </footer>
    </div>
  );
}