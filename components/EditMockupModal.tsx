import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MockupOption } from '../types';
import { editMockupImage } from '../services/geminiService';
import { 
  X, 
  Loader2, 
  Sparkles, 
  Check, 
  RotateCcw, 
  Wand2,
  Sun,
  MapPin,
  User,
  Palette,
  Camera,
  ArrowRight,
  ChevronRight
} from 'lucide-react';

interface EditMockupModalProps {
  mockup: MockupOption;
  originalGarment: string; // Base64 of the original garment
  isOpen: boolean;
  onClose: () => void;
  onSave: (editedMockup: MockupOption) => void;
}

// Quick edit suggestion chips
const EDIT_SUGGESTIONS = [
  { icon: MapPin, label: 'Change background', prompt: 'Change the background to ' },
  { icon: Sun, label: 'Adjust lighting', prompt: 'Adjust the lighting to be more ' },
  { icon: User, label: 'Different pose', prompt: 'Change the pose to ' },
  { icon: Palette, label: 'Color grade', prompt: 'Apply a color grade that feels ' },
  { icon: Camera, label: 'Reframe shot', prompt: 'Reframe the shot to be ' },
];

export const EditMockupModal: React.FC<EditMockupModalProps> = ({
  mockup,
  originalGarment,
  isOpen,
  onClose,
  onSave,
}) => {
  const [editPrompt, setEditPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle animation states
  useEffect(() => {
    if (isOpen) {
      // Small delay for animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
      // Focus textarea after modal opens
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 300);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset after animation completes
      const timer = setTimeout(() => {
        setEditPrompt('');
        setEditedImage(null);
        setError(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isGenerating) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, onClose]);

  const handleGenerate = async () => {
    if (!editPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await editMockupImage({
        mockupImage: mockup.imageUrl,
        originalGarment,
        editInstructions: editPrompt,
        preserveGarment: true,
      });
      setEditedImage(result);
    } catch (err: any) {
      console.error('Edit failed:', err);
      setError(err.message || 'Failed to edit image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    if (editedImage) {
      const updatedMockup: MockupOption = {
        ...mockup,
        imageUrl: editedImage,
        styleDescription: `${mockup.styleDescription} (edited)`,
      };
      onSave(updatedMockup);
      onClose();
    }
  };

  const handleTryAgain = () => {
    setEditedImage(null);
    setError(null);
    textareaRef.current?.focus();
  };

  const handleSuggestionClick = (prompt: string) => {
    setEditPrompt(prompt);
    textareaRef.current?.focus();
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={() => !isGenerating && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      
      {/* Modal Container */}
      <div 
        className={`relative w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden transition-all duration-300 transform ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glass Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Wand2 size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Edit Mockup</h2>
                <p className="text-sm text-white/60">Describe the changes you want</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-col lg:flex-row">
            
            {/* Left: Image Preview */}
            <div className="lg:w-1/2 p-6 flex items-center justify-center bg-black/20">
              <div className="relative w-full max-w-md">
                {/* Before/After Toggle Container */}
                {editedImage ? (
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
                    {/* Before Image (dimmed) */}
                    <img 
                      src={mockup.imageUrl} 
                      alt="Original"
                      className="absolute inset-0 w-full h-full object-cover opacity-30"
                    />
                    {/* After Image */}
                    <img 
                      src={editedImage} 
                      alt="Edited"
                      className="relative w-full h-full object-cover"
                    />
                    {/* Labels */}
                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                        <Sparkles size={12} />
                        Edited
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl">
                    <img 
                      src={mockup.imageUrl} 
                      alt="Current mockup"
                      className={`w-full h-full object-cover transition-all duration-500 ${
                        isGenerating ? 'blur-sm scale-105' : ''
                      }`}
                    />
                    {/* Generating Overlay */}
                    {isGenerating && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/40">
                          <Loader2 size={28} className="text-white animate-spin" />
                        </div>
                        <p className="text-white font-medium">Generating edit...</p>
                        <p className="text-white/60 text-sm mt-1">This may take a moment</p>
                      </div>
                    )}
                    {/* Current Label */}
                    {!isGenerating && (
                      <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full">
                        <span className="text-xs font-medium text-white/80">Current</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Edit Controls */}
            <div className="lg:w-1/2 p-6 flex flex-col">
              
              {/* Edit Result Actions */}
              {editedImage ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/30">
                      <Check size={40} className="text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Edit Complete!</h3>
                    <p className="text-white/60 mb-6 max-w-xs">
                      Review the changes and choose to accept or try a different edit.
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={handleAccept}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2"
                    >
                      <Check size={18} />
                      Accept Changes
                    </button>
                    <button
                      onClick={handleTryAgain}
                      className="w-full py-3.5 px-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={18} />
                      Try Different Edit
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Quick Suggestions */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-white/60 mb-2">Quick edits</p>
                    <div className="flex flex-wrap gap-2">
                      {EDIT_SUGGESTIONS.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion.prompt)}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 rounded-full text-xs text-white/80 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <suggestion.icon size={12} />
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Input */}
                  <div className="flex-1 flex flex-col">
                    <label className="text-xs font-medium text-white/60 mb-2">
                      Describe your changes
                    </label>
                    <div className="relative flex-1 min-h-[160px]">
                      <textarea
                        ref={textareaRef}
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        disabled={isGenerating}
                        placeholder="e.g., Change the background to a sunny beach, make the lighting warmer, zoom out to show more of the environment..."
                        className="w-full h-full p-4 bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl text-white placeholder:text-white/30 resize-none outline-none transition-all disabled:opacity-50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.metaKey && editPrompt.trim()) {
                            handleGenerate();
                          }
                        }}
                      />
                      {/* Character hint */}
                      <div className="absolute bottom-3 right-3 text-[10px] text-white/30">
                        {editPrompt.length > 0 && `${editPrompt.length} chars`}
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  {/* Generate Button */}
                  <div className="mt-4">
                    <button
                      onClick={handleGenerate}
                      disabled={!editPrompt.trim() || isGenerating}
                      className={`
                        w-full py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all
                        ${editPrompt.trim() && !isGenerating
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40'
                          : 'bg-white/10 text-white/40 cursor-not-allowed'
                        }
                      `}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          Generate Edit
                          {editPrompt.trim() && (
                            <span className="ml-1 text-xs opacity-60 flex items-center">
                              <ChevronRight size={12} />
                              <span className="hidden sm:inline">Cmd+Enter</span>
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditMockupModal;

