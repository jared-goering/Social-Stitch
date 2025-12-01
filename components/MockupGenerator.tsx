import React, { useState, useEffect } from 'react';
import { UploadedDesign, MockupOption, StyleSuggestion } from '../types';
import { generateMockupImage, analyzeGarmentAndSuggestStyles } from '../services/geminiService';
import { Wand2, Loader2, ArrowRight, RefreshCcw, Key, Sparkles, Info } from 'lucide-react';

interface Props {
  design: UploadedDesign;
  onMockupSelected: (mockup: MockupOption) => void;
  onBack: () => void;
}

const PRESET_STYLES = [
  "Streetwear urban vibe, downtown city background, golden hour lighting",
  "Minimalist studio photography, white background, soft lighting",
  "Outdoor adventure, hiking trail background, natural sunlight",
  "Grunge aesthetic, brick wall background, moody lighting",
  "Summer beach vibe, ocean background, bright sunny day"
];

// Removed conflicting global declaration.
// window.aistudio is already defined in the environment, accessed via casting to avoid type mismatch errors.

export const MockupGenerator: React.FC<Props> = ({ design, onMockupSelected, onBack }) => {
  const [customStyle, setCustomStyle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMockup, setGeneratedMockup] = useState<MockupOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // AI-suggested styles
  const [aiSuggestions, setAiSuggestions] = useState<StyleSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [expandedReasoning, setExpandedReasoning] = useState<number | null>(null);

  // Fetch AI suggestions when component mounts or design changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true);
      try {
        const suggestions = await analyzeGarmentAndSuggestStyles(design.base64);
        setAiSuggestions(suggestions);
      } catch (err) {
        console.error('Failed to fetch AI suggestions:', err);
        // Silently fail - will show preset styles instead
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [design.base64]);

  const checkAndPromptForKey = async () => {
    // Cast to any to assume existence and structure as per instructions, avoiding type conflict
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      const hasKey = await aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await aistudio.openSelectKey();
      }
    }
  };

  const handleGenerate = async (style: string) => {
    setError(null);
    setGeneratedMockup(null);

    // Ensure user has selected a paid key for the Pro model
    await checkAndPromptForKey();
    
    setIsGenerating(true);
    
    try {
      const base64Image = await generateMockupImage(design.base64, style);
      setGeneratedMockup({
        id: crypto.randomUUID(),
        imageUrl: base64Image,
        styleDescription: style
      });
    } catch (err: any) {
        // If we get a 404/not found related to project/key, prompt again
        if (err.message && err.message.includes("Requested entity was not found")) {
             const aistudio = (window as any).aistudio;
             if (aistudio) {
                 await aistudio.openSelectKey();
                 setError("Please select a valid API Key from a paid project and try again.");
             }
        } else {
             setError("Failed to generate mockup. Please try again.");
        }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* Left: Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4 mb-6">
          <img 
            src={design.previewUrl} 
            alt="Original Design" 
            className="w-16 h-16 object-contain bg-slate-100 rounded-lg border"
          />
          <div>
            <h3 className="font-semibold text-slate-800">Your Garment</h3>
            <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-800 underline">
              Change upload
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-800">
            <p className="font-semibold flex items-center gap-2">
                <Key size={14} />
                Pro Model Active
            </p>
            <p className="mt-1">
                Using <strong>Gemini 3 Pro Image (Nano Banana Pro)</strong> for high-fidelity garment preservation. 
                <br/>Requires a paid API key.
            </p>
        </div>

        <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
          {isLoadingSuggestions ? (
            <>
              <Loader2 size={16} className="animate-spin text-indigo-500" />
              Analyzing your garment...
            </>
          ) : aiSuggestions.length > 0 ? (
            <>
              <Sparkles size={16} className="text-amber-500" />
              AI-Suggested Styles
            </>
          ) : (
            'Choose a Vibe'
          )}
        </h4>

        {isLoadingSuggestions ? (
          <div className="space-y-2 mb-6">
            {[...Array(5)].map((_, idx) => (
              <div 
                key={idx} 
                className="w-full h-14 rounded-lg bg-gradient-to-r from-slate-100 to-slate-50 animate-pulse"
              />
            ))}
          </div>
        ) : aiSuggestions.length > 0 ? (
          <div className="space-y-2 mb-6">
            {aiSuggestions.map((suggestion, idx) => (
              <div key={idx} className="group relative">
                <button
                  onClick={() => handleGenerate(suggestion.description)}
                  disabled={isGenerating}
                  className="w-full text-left p-3 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-transparent hover:border-indigo-400 hover:bg-indigo-50 transition-all text-sm group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-medium text-indigo-700 block mb-0.5">
                        {suggestion.title}
                      </span>
                      <span className="text-slate-600 text-xs line-clamp-2">
                        {suggestion.description}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedReasoning(expandedReasoning === idx ? null : idx);
                      }}
                      className="p-1 hover:bg-indigo-100 rounded-full transition-colors flex-shrink-0"
                      title="Why this style?"
                    >
                      <Info size={14} className="text-indigo-400" />
                    </button>
                  </div>
                </button>
                {expandedReasoning === idx && (
                  <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 animate-in slide-in-from-top-1">
                    <span className="font-medium">Why this works: </span>
                    {suggestion.reasoning}
                  </div>
                )}
              </div>
            ))}
            
            {/* Show preset styles as fallback options */}
            <details className="mt-4">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
                Or try a preset style...
              </summary>
              <div className="space-y-2 mt-2">
                {PRESET_STYLES.map((style, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleGenerate(style)}
                    disabled={isGenerating}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-sm text-slate-600"
                  >
                    {style}
                  </button>
                ))}
              </div>
            </details>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {PRESET_STYLES.map((style, idx) => (
              <button
                key={idx}
                onClick={() => handleGenerate(style)}
                disabled={isGenerating}
                className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-sm text-slate-600"
              >
                {style}
              </button>
            ))}
          </div>
        )}

        <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Or describe your own</span>
            </div>
        </div>

        <div className="flex gap-2">
            <input 
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="e.g. Cyberpunk neon city night..."
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
                onClick={() => handleGenerate(customStyle)}
                disabled={!customStyle || isGenerating}
                className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-900 disabled:opacity-50"
            >
                <ArrowRight size={20} />
            </button>
        </div>
      </div>

      {/* Right: Preview Area */}
      <div className="bg-slate-100 rounded-xl min-h-[500px] flex items-center justify-center relative overflow-hidden border-2 border-slate-200 border-dashed">
        
        {isGenerating && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-indigo-600">
                <Loader2 className="animate-spin mb-3" size={48} />
                <p className="font-medium">Generating Pro Quality Mockup...</p>
                <p className="text-xs text-slate-500 mt-2">Gemini 3 Pro Image (Nano Banana Pro)</p>
                <p className="text-xs text-slate-400 mt-1">This may take a moment</p>
            </div>
        )}

        {!generatedMockup && !isGenerating && !error && (
             <div className="text-center text-slate-400 p-8">
                <Wand2 size={48} className="mx-auto mb-4 opacity-50" />
                <p>Select a style to generate your first mockup</p>
             </div>
        )}

        {error && !isGenerating && (
             <div className="text-center text-red-500 p-8 max-w-sm">
                <p>{error}</p>
             </div>
        )}

        {generatedMockup && (
            <div className="relative w-full h-full flex flex-col items-center">
                <img 
                    src={generatedMockup.imageUrl} 
                    alt="Generated Mockup" 
                    className="w-full h-auto object-contain max-h-[600px] shadow-lg"
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">Looks good?</span>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setGeneratedMockup(null)}
                            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                        >
                            <RefreshCcw size={16} />
                            Discard
                        </button>
                        <button 
                            onClick={() => onMockupSelected(generatedMockup)}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
                        >
                            Use This Mockup
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};