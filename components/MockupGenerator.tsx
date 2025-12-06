import React, { useState, useEffect } from 'react';
import { UploadedDesign, MockupOption, StyleSuggestion, ModelGender, SavedMockup } from '../types';
import { generateMockupImage, analyzeGarmentAndSuggestStyles } from '../services/geminiService';
import { saveMockupToFirebase, fetchUserMockups, deleteMockupFromFirebase } from '../services/mockupStorageService';
import { Wand2, Loader2, ArrowRight, RefreshCcw, Zap, Sparkles, Info, Check, X, CheckCircle, Images, Play, User, Users, Maximize2, ChevronLeft, ChevronRight, ChevronDown, Clock, Plus, Trash2 } from 'lucide-react';

interface Props {
  design: UploadedDesign;
  onMockupsSelected: (mockups: MockupOption[]) => void;
  onBack: () => void;
}

const PRESET_STYLES = [
  "Walking through a busy city street, grabbing coffee, morning golden hour light, urban lifestyle",
  "Relaxing at an outdoor café, reading or on phone, dappled sunlight through trees, candid moment",
  "Hiking on a scenic trail, pausing to take in the view, natural adventure setting, active lifestyle",
  "Hanging out with friends at a rooftop gathering, laughing and chatting, warm evening light",
  "Browsing at a weekend farmers market or street fair, casual and relaxed, vibrant atmosphere"
];

// Removed conflicting global declaration.
// window.aistudio is already defined in the environment, accessed via casting to avoid type mismatch errors.

// Storage keys for persistence
const MOCKUPS_STORAGE_KEY = 'socialstitch_mockups';
const SUGGESTIONS_STORAGE_KEY = 'socialstitch_suggestions';
const SELECTED_IDS_STORAGE_KEY = 'socialstitch_selected_ids';
const MOCKUPS_DB_NAME = 'socialstitch_mockups_db';
const MOCKUPS_DB_VERSION = 1;
const MOCKUPS_STORE_NAME = 'mockups';

// IndexedDB helper functions for storing large image data
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MOCKUPS_DB_NAME, MOCKUPS_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MOCKUPS_STORE_NAME)) {
        db.createObjectStore(MOCKUPS_STORE_NAME);
      }
    };
  });
};

const saveMockupsToIndexedDB = async (designId: string, mockups: MockupOption[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([MOCKUPS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(MOCKUPS_STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ designId, mockups }, designId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save mockups to IndexedDB:', error);
    throw error;
  }
};

const loadMockupsFromIndexedDB = async (designId: string): Promise<MockupOption[] | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([MOCKUPS_STORE_NAME], 'readonly');
    const store = transaction.objectStore(MOCKUPS_STORE_NAME);
    return new Promise<MockupOption[] | null>((resolve, reject) => {
      const request = store.get(designId);
      request.onsuccess = () => {
        const data = request.result;
        if (data && data.designId === designId) {
          resolve(data.mockups || null);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load mockups from IndexedDB:', error);
    return null;
  }
};

export const MockupGenerator: React.FC<Props> = ({ design, onMockupsSelected, onBack }) => {
  const [customStyle, setCustomStyle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMockups, setGeneratedMockups] = useState<MockupOption[]>([]);
  const [isLoadingMockups, setIsLoadingMockups] = useState(true);
  
  // Load mockups from IndexedDB on mount
  useEffect(() => {
    const loadMockups = async () => {
      setIsLoadingMockups(true);
      try {
        // Try IndexedDB first (for large data)
        const mockups = await loadMockupsFromIndexedDB(design.id);
        if (mockups && mockups.length > 0) {
          setGeneratedMockups(mockups);
          setIsLoadingMockups(false);
          return;
        }
        
        // Fallback to sessionStorage (for smaller data or compatibility)
        const saved = sessionStorage.getItem(MOCKUPS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.designId === design.id && parsed.mockups?.length > 0) {
            setGeneratedMockups(parsed.mockups);
            // Migrate to IndexedDB for future loads
            try {
              await saveMockupsToIndexedDB(design.id, parsed.mockups);
            } catch (e) {
              console.warn('Failed to migrate to IndexedDB:', e);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load saved mockups:', e);
      } finally {
        setIsLoadingMockups(false);
      }
    };
    
    loadMockups();
  }, [design.id]);
  const [selectedMockupIds, setSelectedMockupIds] = useState<Set<string>>(new Set());
  
  // Load selected IDs after mockups are loaded
  useEffect(() => {
    if (isLoadingMockups) return;
    
    try {
      const saved = sessionStorage.getItem(SELECTED_IDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.designId === design.id) {
          // Filter selected IDs to only include those that exist in loaded mockups
          const existingMockupIds = new Set(generatedMockups.map(m => m.id));
          const savedIds = (parsed.ids || []).filter((id: string) => existingMockupIds.has(id));
          setSelectedMockupIds(new Set(savedIds));
        }
      }
    } catch (e) {
      console.error('Failed to load selected IDs:', e);
    }
  }, [isLoadingMockups, design.id, generatedMockups]);
  const [error, setError] = useState<string | null>(null);
  
  // Multi-select styles
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  
  // AI-suggested styles
  const [aiSuggestions, setAiSuggestions] = useState<StyleSuggestion[]>(() => {
    // Initialize from sessionStorage
    try {
      const saved = sessionStorage.getItem(SUGGESTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.designId === design.id) {
          return parsed.suggestions || [];
        }
      }
    } catch (e) {
      console.error('Failed to load saved suggestions:', e);
    }
    return [];
  });
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(() => {
    // Don't show loading if we have cached suggestions
    try {
      const saved = sessionStorage.getItem(SUGGESTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.designId === design.id && parsed.suggestions?.length > 0) {
          return false;
        }
      }
    } catch (e) {}
    return true;
  });
  const [expandedReasoning, setExpandedReasoning] = useState<number | null>(null);
  
  // Variations and gender selection
  const [variationCount, setVariationCount] = useState<number>(2);
  const [styleGenders, setStyleGenders] = useState<Map<string, ModelGender>>(new Map());
  
  // Image modal/lightbox
  const [enlargedMockup, setEnlargedMockup] = useState<MockupOption | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Cloud-saved mockups history
  const [savedMockups, setSavedMockups] = useState<SavedMockup[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);

  // Persist generated mockups to IndexedDB (and sessionStorage as fallback)
  useEffect(() => {
    if (isLoadingMockups || generatedMockups.length === 0) {
      return; // Don't save during initial load or when empty
    }
    
    const saveMockups = async () => {
      try {
        // Save to IndexedDB (handles large data)
        await saveMockupsToIndexedDB(design.id, generatedMockups);
      } catch (e) {
        console.error('Failed to save mockups to IndexedDB:', e);
        // Fallback to sessionStorage (may fail if data is too large)
        try {
          sessionStorage.setItem(MOCKUPS_STORAGE_KEY, JSON.stringify({
            designId: design.id,
            mockups: generatedMockups
          }));
        } catch (sessionError: any) {
          if (sessionError.name === 'QuotaExceededError') {
            console.error('SessionStorage quota exceeded. Consider using IndexedDB.');
            // Try to save a smaller version (just IDs and metadata, not full images)
            try {
              const mockupsMetadata = generatedMockups.map(m => ({
                id: m.id,
                styleDescription: m.styleDescription,
                // Don't include imageUrl to save space
              }));
              sessionStorage.setItem(MOCKUPS_STORAGE_KEY, JSON.stringify({
                designId: design.id,
                mockups: mockupsMetadata,
                metadataOnly: true
              }));
            } catch (metaError) {
              console.error('Failed to save even metadata:', metaError);
            }
          } else {
            console.error('Failed to save mockups to sessionStorage:', sessionError);
          }
        }
      }
    };
    
    saveMockups();
  }, [generatedMockups, design.id, isLoadingMockups]);

  // Persist selected mockup IDs to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SELECTED_IDS_STORAGE_KEY, JSON.stringify({
        designId: design.id,
        ids: Array.from(selectedMockupIds)
      }));
    } catch (e) {
      console.error('Failed to save selected IDs:', e);
    }
  }, [selectedMockupIds, design.id]);

  // Clean up selected IDs that don't exist in generatedMockups
  useEffect(() => {
    const existingIds = new Set(generatedMockups.map(m => m.id));
    setSelectedMockupIds(prev => {
      const filtered = new Set(Array.from(prev).filter(id => existingIds.has(id)));
      // Only update if there's a difference to avoid infinite loops
      if (filtered.size !== prev.size) {
        return filtered;
      }
      return prev;
    });
  }, [generatedMockups]);

  // Persist AI suggestions to sessionStorage
  useEffect(() => {
    if (aiSuggestions.length > 0) {
      try {
        sessionStorage.setItem(SUGGESTIONS_STORAGE_KEY, JSON.stringify({
          designId: design.id,
          suggestions: aiSuggestions
        }));
      } catch (e) {
        console.error('Failed to save suggestions:', e);
      }
    }
  }, [aiSuggestions, design.id]);

  // Fetch saved mockups history from Firebase on mount
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const history = await fetchUserMockups();
        setSavedMockups(history);
      } catch (error) {
        console.error('Failed to load mockup history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    loadHistory();
  }, []);

  // Fetch AI suggestions when component mounts or design changes (only if not cached)
  useEffect(() => {
    const fetchSuggestions = async () => {
      // Check if we already have cached suggestions for this design
      try {
        const saved = sessionStorage.getItem(SUGGESTIONS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.designId === design.id && parsed.suggestions?.length > 0) {
            // Already have cached suggestions, skip fetching
            return;
          }
        }
      } catch (e) {}

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
  }, [design.base64, design.id]);

  // Keyboard navigation for modal
  useEffect(() => {
    if (!enlargedMockup) {
      setIsDescriptionExpanded(false); // Reset when modal closes
      return;
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEnlargedMockup(null);
      } else if (e.key === 'ArrowLeft' && generatedMockups.length > 1) {
        const currentIndex = generatedMockups.findIndex(m => m.id === enlargedMockup.id);
        const prevIndex = currentIndex === 0 ? generatedMockups.length - 1 : currentIndex - 1;
        setEnlargedMockup(generatedMockups[prevIndex]);
        setIsDescriptionExpanded(false); // Reset when navigating
      } else if (e.key === 'ArrowRight' && generatedMockups.length > 1) {
        const currentIndex = generatedMockups.findIndex(m => m.id === enlargedMockup.id);
        const nextIndex = currentIndex === generatedMockups.length - 1 ? 0 : currentIndex + 1;
        setEnlargedMockup(generatedMockups[nextIndex]);
        setIsDescriptionExpanded(false); // Reset when navigating
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enlargedMockup, generatedMockups]);

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

  // Get gender for a style (default to 'both')
  const getStyleGender = (style: string): ModelGender => {
    return styleGenders.get(style) || 'both';
  };

  // Set gender for a style
  const setStyleGender = (style: string, gender: ModelGender) => {
    setStyleGenders(prev => {
      const newMap = new Map(prev);
      newMap.set(style, gender);
      return newMap;
    });
  };

  // Toggle style selection
  const toggleStyleSelection = (style: string) => {
    setSelectedStyles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(style)) {
        newSet.delete(style);
      } else {
        newSet.add(style);
      }
      return newSet;
    });
  };

  // Toggle mockup selection
  const toggleMockupSelection = (mockupId: string) => {
    setSelectedMockupIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mockupId)) {
        newSet.delete(mockupId);
      } else {
        newSet.add(mockupId);
      }
      return newSet;
    });
  };

  // Select all generated mockups
  const selectAllMockups = () => {
    setSelectedMockupIds(new Set(generatedMockups.map(m => m.id)));
  };

  // Deselect all mockups
  const deselectAllMockups = () => {
    setSelectedMockupIds(new Set());
  };

  // Prompt variation suffixes to make each generation unique - lifestyle focused
  const VARIATION_SUFFIXES = [
    ' The person is walking through the scene, captured mid-stride.',
    ' The person is laughing or smiling while looking away from camera, candid moment.',
    ' Wide environmental shot showing more of the setting, person is smaller in frame doing an activity.',
    ' The person is sitting casually, relaxed and interacting with something in their hands.',
  ];

  // Generate a single mockup (for quick generate)
  const handleQuickGenerate = async (style: string) => {
    setError(null);
    await checkAndPromptForKey();
    setIsGenerating(true);
    setGenerationProgress({ current: 1, total: 1 });
    
    try {
      // Get gender for this style, pick randomly for 'both' on single generation
      const styleGender = getStyleGender(style);
      const gender = styleGender === 'both' 
        ? (Math.random() > 0.5 ? 'male' : 'female')
        : styleGender;
      
      const base64Image = await generateMockupImage(design.base64, style, gender);
      const genderLabel = gender === 'male' ? '♂' : '♀';
      const mockupId = crypto.randomUUID();
      const styleDescription = `${style} ${genderLabel}`;
      
      const newMockup: MockupOption = {
        id: mockupId,
        imageUrl: base64Image,
        styleDescription
      };
      setGeneratedMockups(prev => [...prev, newMockup]);
      setSelectedMockupIds(prev => new Set([...prev, newMockup.id]));
      
      // Save to Firebase in the background
      setIsSavingToCloud(true);
      try {
        const savedMockup = await saveMockupToFirebase(mockupId, base64Image, styleDescription, design.id);
        // Add to saved mockups list (at the beginning since it's newest)
        setSavedMockups(prev => [savedMockup, ...prev]);
      } catch (saveError) {
        console.error('Failed to save mockup to cloud:', saveError);
        // Don't show error to user - local generation succeeded
      } finally {
        setIsSavingToCloud(false);
      }
    } catch (err: any) {
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
      setGenerationProgress(null);
    }
  };

  // Generate all selected styles in parallel with variations
  const handleGenerateSelected = async () => {
    if (selectedStyles.size === 0) return;
    
    setError(null);
    await checkAndPromptForKey();
    setIsGenerating(true);
    
    const stylesToGenerate = Array.from(selectedStyles);
    
    // Build list of all generation tasks (style + variation + gender combinations)
    type GenerationTask = { style: string; gender: ModelGender; variationIndex: number };
    const tasks: GenerationTask[] = [];
    
    for (const style of stylesToGenerate) {
      const styleGender = getStyleGender(style);
      
      for (let i = 0; i < variationCount; i++) {
        let gender: ModelGender;
        
        if (styleGender === 'both') {
          // Alternate between male and female for 'both'
          // First half male, second half female (or alternate if odd)
          if (variationCount === 1) {
            gender = Math.random() > 0.5 ? 'male' : 'female';
          } else {
            gender = i < Math.ceil(variationCount / 2) ? 'male' : 'female';
          }
        } else {
          gender = styleGender;
        }
        
        tasks.push({ style, gender, variationIndex: i });
      }
    }
    
    setGenerationProgress({ current: 0, total: tasks.length });
    
    try {
      // Generate all in parallel
      const results = await Promise.allSettled(
        tasks.map(async (task) => {
          // Add variation to prompt for diversity
          const variationSuffix = VARIATION_SUFFIXES[task.variationIndex % VARIATION_SUFFIXES.length];
          const enhancedStyle = task.style + variationSuffix;
          
          const base64Image = await generateMockupImage(design.base64, enhancedStyle, task.gender);
          setGenerationProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
          
          const genderLabel = task.gender === 'male' ? '♂' : '♀';
          return {
            id: crypto.randomUUID(),
            imageUrl: base64Image,
            styleDescription: `${task.style} ${genderLabel}`
          } as MockupOption;
        })
      );
      
      const successfulMockups = results
        .filter((r): r is PromiseFulfilledResult<MockupOption> => r.status === 'fulfilled')
        .map(r => r.value);
      
      const failedCount = results.filter(r => r.status === 'rejected').length;
      
      if (successfulMockups.length > 0) {
        setGeneratedMockups(prev => [...prev, ...successfulMockups]);
        setSelectedMockupIds(prev => new Set([...prev, ...successfulMockups.map(m => m.id)]));
        
        // Save all successful mockups to Firebase in the background
        setIsSavingToCloud(true);
        try {
          const saveResults = await Promise.allSettled(
            successfulMockups.map(mockup => 
              saveMockupToFirebase(mockup.id, mockup.imageUrl, mockup.styleDescription, design.id)
            )
          );
          
          const savedSuccessfully = saveResults
            .filter((r): r is PromiseFulfilledResult<SavedMockup> => r.status === 'fulfilled')
            .map(r => r.value);
          
          if (savedSuccessfully.length > 0) {
            // Add to saved mockups list (at the beginning since they're newest)
            setSavedMockups(prev => [...savedSuccessfully, ...prev]);
          }
          
          const cloudFailedCount = saveResults.filter(r => r.status === 'rejected').length;
          if (cloudFailedCount > 0) {
            console.warn(`${cloudFailedCount} mockup(s) failed to save to cloud`);
          }
        } catch (saveError) {
          console.error('Failed to save mockups to cloud:', saveError);
        } finally {
          setIsSavingToCloud(false);
        }
      }
      
      if (failedCount > 0) {
        setError(`${failedCount} mockup(s) failed to generate.`);
      }
      
      // Clear selected styles after generation
      setSelectedStyles(new Set());
      
    } catch (err: any) {
      if (err.message && err.message.includes("Requested entity was not found")) {
        const aistudio = (window as any).aistudio;
        if (aistudio) {
          await aistudio.openSelectKey();
          setError("Please select a valid API Key from a paid project and try again.");
        }
      } else {
        setError("Failed to generate mockups. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  // Remove a mockup from the gallery
  const removeMockup = (mockupId: string) => {
    setGeneratedMockups(prev => prev.filter(m => m.id !== mockupId));
    setSelectedMockupIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(mockupId);
      return newSet;
    });
  };

  // Regenerate AI suggestions
  const regenerateSuggestions = async () => {
    // Clear cached suggestions
    try {
      sessionStorage.removeItem(SUGGESTIONS_STORAGE_KEY);
    } catch (e) {}
    
    // Clear current suggestions and show loading
    setAiSuggestions([]);
    setIsLoadingSuggestions(true);
    
    try {
      const suggestions = await analyzeGarmentAndSuggestStyles(design.base64);
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error('Failed to fetch AI suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle proceeding with selected mockups
  const handleProceed = () => {
    const selectedMockups = generatedMockups.filter(m => selectedMockupIds.has(m.id));
    if (selectedMockups.length > 0) {
      onMockupsSelected(selectedMockups);
    }
  };

  // Add a saved mockup from history to the current carousel
  const addFromHistory = (savedMockup: SavedMockup) => {
    // Check if already in current mockups
    if (generatedMockups.some(m => m.id === savedMockup.id)) {
      // Already added, just select it
      setSelectedMockupIds(prev => new Set([...prev, savedMockup.id]));
      return;
    }
    
    // Add to generated mockups and select it
    const mockup: MockupOption = {
      id: savedMockup.id,
      imageUrl: savedMockup.imageUrl,
      styleDescription: savedMockup.styleDescription
    };
    setGeneratedMockups(prev => [...prev, mockup]);
    setSelectedMockupIds(prev => new Set([...prev, savedMockup.id]));
  };

  // Delete a mockup from history (Firebase)
  const deleteFromHistory = async (mockupId: string) => {
    try {
      await deleteMockupFromFirebase(mockupId);
      setSavedMockups(prev => prev.filter(m => m.id !== mockupId));
    } catch (error) {
      console.error('Failed to delete mockup from history:', error);
    }
  };

  // Format relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      {/* Left: Controls */}
      <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        {/* Garment preview header */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
          <div className="relative">
            <img 
              src={design.previewUrl} 
              alt="Original Design" 
              className="w-11 h-11 object-cover bg-slate-100 rounded-lg border border-slate-200"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check size={8} className="text-white" strokeWidth={3} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm">Your Garment</h3>
            <button onClick={onBack} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Change upload
            </button>
          </div>
          {/* Pro badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-full">
            <Zap size={10} className="text-amber-500" />
            <span className="text-[10px] font-medium text-amber-700">Pro</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
            {isLoadingSuggestions ? (
              <>
                <Loader2 size={12} className="animate-spin text-indigo-500" />
                <span>Analyzing...</span>
              </>
            ) : aiSuggestions.length > 0 ? (
              <>
                <Sparkles size={12} className="text-amber-500" />
                <span>AI-Suggested Styles</span>
                <button
                  onClick={regenerateSuggestions}
                  disabled={isLoadingSuggestions}
                  className="ml-0.5 p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  title="Get new suggestions"
                >
                  <RefreshCcw size={10} />
                </button>
              </>
            ) : (
              'Choose a Vibe'
            )}
          </h4>
          {selectedStyles.size > 0 && (
            <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
              {selectedStyles.size} selected
            </span>
          )}
        </div>

        {isLoadingSuggestions ? (
          <div className="space-y-1.5 mb-3">
            {[...Array(5)].map((_, idx) => (
              <div 
                key={idx} 
                className="w-full p-2 rounded-lg bg-slate-50 border border-slate-100"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded bg-slate-200 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                    <div className="h-2.5 w-full bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : aiSuggestions.length > 0 ? (
          <div className="space-y-1.5 mb-3 stagger-children">
            {aiSuggestions.map((suggestion, idx) => {
              const isSelected = selectedStyles.has(suggestion.description);
              return (
                <div key={idx} className="group relative">
                  <div
                    onClick={() => !isGenerating && toggleStyleSelection(suggestion.description)}
                    className={`
                      w-full text-left p-2 rounded-lg border transition-all text-xs cursor-pointer
                      ${isSelected 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }
                    `}
                  >
                    <div className="flex items-start gap-2">
                      {/* Checkbox */}
                      <div
                        className={`
                          mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all
                          ${isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 group-hover:border-indigo-400'
                          }
                        `}
                      >
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1">
                            <span className={`font-medium text-xs block transition-colors ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                              {suggestion.title}
                            </span>
                            <span className="text-slate-500 text-[11px] line-clamp-1 leading-snug">
                              {suggestion.description}
                            </span>
                            {/* Gender Selector */}
                            {isSelected && (
                              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-indigo-100" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[10px] font-medium text-slate-600 mr-0.5">Model:</span>
                                <button
                                  type="button"
                                  onClick={() => setStyleGender(suggestion.description, 'male')}
                                  className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                    getStyleGender(suggestion.description) === 'male'
                                      ? 'bg-indigo-600 text-white shadow-sm'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                                  }`}
                                  title="Male model"
                                >
                                  <User size={12} />
                                  <span>Male</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStyleGender(suggestion.description, 'female')}
                                  className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                    getStyleGender(suggestion.description) === 'female'
                                      ? 'bg-pink-500 text-white shadow-sm'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-slate-50'
                                  }`}
                                  title="Female model"
                                >
                                  <User size={12} />
                                  <span>Female</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStyleGender(suggestion.description, 'both')}
                                  className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                    getStyleGender(suggestion.description) === 'both'
                                      ? 'bg-purple-500 text-white shadow-sm'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-slate-50'
                                  }`}
                                  title="Both (one of each)"
                                >
                                  <Users size={12} />
                                  <span>Both</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedReasoning(expandedReasoning === idx ? null : idx);
                              }}
                              className="p-1 hover:bg-slate-100 rounded transition-colors opacity-50 hover:opacity-100"
                              title="Why this style?"
                            >
                              <Info size={12} className="text-slate-400" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickGenerate(suggestion.description);
                              }}
                              disabled={isGenerating}
                              className="p-1 rounded transition-all text-indigo-500 opacity-0 group-hover:opacity-100 hover:bg-indigo-100"
                              title="Quick generate this style"
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {expandedReasoning === idx && (
                    <div className="mt-1 p-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-lg text-[10px] text-amber-700 animate-in slide-in-from-top-1">
                      <span className="font-semibold text-amber-800">Why: </span>
                      {suggestion.reasoning}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Show preset styles as fallback options */}
            <details className="mt-2 group/details">
              <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 transition-colors flex items-center gap-1">
                <Play size={8} className="transition-transform group-open/details:rotate-90" />
                Or try a preset style...
              </summary>
              <div className="space-y-1.5 mt-2">
                {PRESET_STYLES.map((style, idx) => {
                  const isSelected = selectedStyles.has(style);
                  return (
                    <div
                      key={idx}
                      onClick={() => !isGenerating && toggleStyleSelection(style)}
                      className={`
                        w-full text-left p-2 rounded-lg border transition-all text-xs cursor-pointer group
                        ${isSelected
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`
                            w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all
                            ${isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 group-hover:border-indigo-400'
                            }
                          `}
                        >
                          {isSelected && <Check size={10} strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-slate-600 text-[11px] block line-clamp-1">
                            {style}
                          </span>
                          {/* Gender Selector for preset styles */}
                          {isSelected && (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-indigo-100" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] font-medium text-slate-600 mr-0.5">Model:</span>
                              <button
                                type="button"
                                onClick={() => setStyleGender(style, 'male')}
                                className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                  getStyleGender(style) === 'male'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                                }`}
                                title="Male model"
                              >
                                <User size={12} />
                                <span>Male</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setStyleGender(style, 'female')}
                                className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                  getStyleGender(style) === 'female'
                                    ? 'bg-pink-500 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-slate-50'
                                }`}
                                title="Female model"
                              >
                                <User size={12} />
                                <span>Female</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setStyleGender(style, 'both')}
                                className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                  getStyleGender(style) === 'both'
                                    ? 'bg-purple-500 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-slate-50'
                                }`}
                                title="Both (one of each)"
                              >
                                <Users size={12} />
                                <span>Both</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickGenerate(style);
                          }}
                          disabled={isGenerating}
                          className="p-1 rounded transition-all text-indigo-500 opacity-0 group-hover:opacity-100 hover:bg-indigo-100"
                          title="Quick generate this style"
                        >
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>

            {/* Variations Selector */}
            {selectedStyles.size > 0 && (
              <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-600">Variations</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setVariationCount(count)}
                        className={`w-6 h-6 rounded text-[10px] font-semibold transition-all ${
                          variationCount === count
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Generate Selected Button - Always visible */}
            <button
              onClick={handleGenerateSelected}
              disabled={isGenerating || selectedStyles.size === 0}
              className={`
                w-full mt-2 py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all
                ${selectedStyles.size > 0
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              <Images size={14} />
              {selectedStyles.size > 0 
                ? `Generate ${selectedStyles.size} × ${variationCount}`
                : 'Select styles'
              }
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 mb-3">
              {PRESET_STYLES.map((style, idx) => {
                const isSelected = selectedStyles.has(style);
                return (
                  <div
                    key={idx}
                    onClick={() => !isGenerating && toggleStyleSelection(style)}
                    className={`
                      w-full text-left p-2 rounded-lg border transition-all text-xs cursor-pointer group
                      ${isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`
                          w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all
                          ${isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 group-hover:border-indigo-400'
                          }
                        `}
                      >
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-600 text-[11px] block line-clamp-1">
                          {style}
                        </span>
                        {/* Gender Selector for preset styles */}
                        {isSelected && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-indigo-100" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] font-medium text-slate-600 mr-0.5">Model:</span>
                            <button
                              type="button"
                              onClick={() => setStyleGender(style, 'male')}
                              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                getStyleGender(style) === 'male'
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                              }`}
                              title="Male model"
                            >
                              <User size={12} />
                              <span>Male</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStyleGender(style, 'female')}
                              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                getStyleGender(style) === 'female'
                                  ? 'bg-pink-500 text-white shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:border-pink-300 hover:bg-slate-50'
                              }`}
                              title="Female model"
                            >
                              <User size={12} />
                              <span>Female</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setStyleGender(style, 'both')}
                              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                getStyleGender(style) === 'both'
                                  ? 'bg-purple-500 text-white shadow-sm'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-slate-50'
                              }`}
                              title="Both (one of each)"
                            >
                              <Users size={12} />
                              <span>Both</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickGenerate(style);
                        }}
                        disabled={isGenerating}
                        className="p-1 rounded transition-all text-indigo-500 opacity-0 group-hover:opacity-100 hover:bg-indigo-100"
                        title="Quick generate this style"
                      >
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Variations Selector */}
            {selectedStyles.size > 0 && (
              <div className="mb-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-600">Variations</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setVariationCount(count)}
                        className={`w-6 h-6 rounded text-[10px] font-semibold transition-all ${
                          variationCount === count
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Generate Selected Button - Always visible */}
            <button
              onClick={handleGenerateSelected}
              disabled={isGenerating || selectedStyles.size === 0}
              className={`
                w-full py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all
                ${selectedStyles.size > 0
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              <Images size={14} />
              {selectedStyles.size > 0 
                ? `Generate ${selectedStyles.size} × ${variationCount}`
                : 'Select styles'
              }
            </button>
          </>
        )}

        <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
                <span className="px-2 bg-white text-[10px] text-slate-400 font-medium">Or describe your own</span>
            </div>
        </div>

        <div className="flex gap-1.5">
            <input 
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="e.g. Cyberpunk neon city..."
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customStyle && !isGenerating) {
                    handleQuickGenerate(customStyle);
                    setCustomStyle('');
                  }
                }}
            />
            <button
                onClick={() => {
                  handleQuickGenerate(customStyle);
                  setCustomStyle('');
                }}
                disabled={!customStyle || isGenerating}
                className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Generate mockup"
            >
                <ArrowRight size={16} />
            </button>
        </div>
      </div>

      {/* Right: Gallery Area */}
      <div className="lg:col-span-3 bg-gradient-to-b from-slate-50 to-slate-100/50 rounded-xl min-h-[380px] flex flex-col relative overflow-hidden border border-slate-200">
        
        {/* Generation Progress Overlay */}
        {isGenerating && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-500/30">
                    <Loader2 className="animate-spin text-white" size={24} />
                  </div>
                  <p className="font-semibold text-slate-800 text-sm mb-1">
                    Generating {generationProgress && generationProgress.total > 1 ? 'Mockups' : 'Mockup'}...
                  </p>
                  {generationProgress && (
                    <div className="mt-2 w-40 mx-auto">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Progress</span>
                        <span className="font-semibold text-indigo-600">{generationProgress.current} / {generationProgress.total}</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-2">Using Gemini 3 Pro</p>
                </div>
            </div>
        )}

        {/* Loading State */}
        {isLoadingMockups && !isGenerating && (
          <div className="flex-1 flex items-center justify-center text-center p-6">
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Loader2 size={20} className="text-slate-400 animate-spin" />
              </div>
              <p className="font-medium text-slate-500 text-sm">Loading mockups...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingMockups && generatedMockups.length === 0 && !isGenerating && !error && (
             <div className={`flex items-center justify-center text-center p-6 ${(savedMockups.length === 0 && !isLoadingHistory) ? 'flex-1' : 'py-8'}`}>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Wand2 size={20} className="text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-500 text-sm mb-0.5">Select styles to generate</p>
                  <p className="text-[10px] text-slate-400 max-w-[180px] mx-auto">
                    Choose styles on the left, then generate
                  </p>
                </div>
             </div>
        )}

        {/* Error Message */}
        {error && !isGenerating && (
             <div className="p-3 mx-3 mt-3 bg-red-50 border border-red-200 rounded-lg text-center text-red-600 text-xs">
                {error}
             </div>
        )}

        {/* Gallery Grid */}
        {generatedMockups.length > 0 && (
          <div className="flex-1 overflow-auto p-3">
            {/* Gallery Header */}
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Images size={12} className="text-slate-400" />
                <span className="font-medium">{generatedMockups.length} mockup{generatedMockups.length > 1 ? 's' : ''}</span>
                <span className="text-slate-300">•</span>
                <span className="text-indigo-600 font-semibold">{selectedMockupIds.size} selected</span>
              </div>
              <div className="flex gap-1.5 text-[10px]">
                <button
                  onClick={selectAllMockups}
                  className="text-indigo-600 font-medium hover:text-indigo-700"
                >
                  Select all
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={deselectAllMockups}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Deselect all
                </button>
              </div>
            </div>

            {/* Mockup Grid */}
            <div className="grid grid-cols-2 gap-2 stagger-children">
              {generatedMockups.map((mockup) => {
                const isSelected = selectedMockupIds.has(mockup.id);
                return (
                  <div 
                    key={mockup.id}
                    className={`
                      relative group rounded-lg overflow-hidden bg-white shadow-sm border transition-all cursor-pointer
                      ${isSelected 
                        ? 'border-indigo-500 shadow-md shadow-indigo-500/10' 
                        : 'border-transparent hover:border-slate-200'
                      }
                    `}
                    onClick={() => toggleMockupSelection(mockup.id)}
                  >
                    <img 
                      src={mockup.imageUrl} 
                      alt={mockup.styleDescription}
                      className="w-full aspect-square object-cover"
                    />
                    
                    {/* Selection Checkbox */}
                    <div className={`
                      absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center transition-all
                      ${isSelected
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-white/90 backdrop-blur-sm border border-slate-300 group-hover:border-indigo-400'
                      }
                    `}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>

                    {/* Action Buttons */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {/* Expand Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEnlargedMockup(mockup);
                        }}
                        className="w-5 h-5 rounded bg-white/90 backdrop-blur-sm text-slate-700 flex items-center justify-center hover:bg-white transition-all shadow-sm"
                        title="View larger"
                      >
                        <Maximize2 size={10} />
                      </button>
                      {/* Remove Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMockup(mockup.id);
                        }}
                        className="w-5 h-5 rounded bg-red-500/90 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-600 transition-all"
                        title="Remove mockup"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {/* Style Description */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                      <p className="text-white text-[10px] line-clamp-1 font-medium">{mockup.styleDescription}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Previously Generated Section - Always visible */}
        <div className="border-t border-slate-200 mt-auto">
            {/* Section Header */}
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Clock size={12} className="text-slate-400" />
                <span className="font-medium">History</span>
                {!isLoadingHistory && (
                  <span className="text-[10px] text-slate-400">({savedMockups.length})</span>
                )}
                {isSavingToCloud && (
                  <span className="flex items-center gap-0.5 text-[10px] text-indigo-500">
                    <Loader2 size={8} className="animate-spin" />
                    Saving
                  </span>
                )}
              </div>
              <ChevronRight 
                size={14} 
                className={`text-slate-400 transition-transform ${historyExpanded ? 'rotate-90' : ''}`} 
              />
            </button>
            
            {/* History Content */}
            {historyExpanded && (
              <div className="px-3 pb-3">
                {isLoadingHistory ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {[...Array(4)].map((_, idx) => (
                      <div key={idx} className="aspect-square rounded bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : savedMockups.length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-slate-400">
                    No history yet
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                    {savedMockups.map((mockup) => {
                      const isInCarousel = generatedMockups.some(m => m.id === mockup.id);
                      return (
                        <div 
                          key={mockup.id}
                          className="relative group aspect-square rounded overflow-hidden bg-white border border-slate-200 hover:border-indigo-300 transition-all"
                        >
                          <img 
                            src={mockup.imageUrl} 
                            alt={mockup.styleDescription}
                            className="w-full h-full object-cover"
                          />
                          
                          {/* Overlay with actions */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100">
                            {/* Add to Carousel Button */}
                            <button
                              onClick={() => addFromHistory(mockup)}
                              className={`
                                p-1 rounded transition-all
                                ${isInCarousel 
                                  ? 'bg-emerald-500 text-white' 
                                  : 'bg-white text-slate-700 hover:bg-indigo-500 hover:text-white'
                                }
                              `}
                              title={isInCarousel ? 'Already added' : 'Add'}
                            >
                              {isInCarousel ? <Check size={12} /> : <Plus size={12} />}
                            </button>
                            {/* Delete Button */}
                            <button
                              onClick={() => deleteFromHistory(mockup.id)}
                              className="p-1 rounded bg-white text-slate-700 hover:bg-red-500 hover:text-white transition-all"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          
                          {/* Already Added Indicator */}
                          {isInCarousel && (
                            <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check size={8} className="text-white" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Bottom Action Bar */}
        {generatedMockups.length > 0 && (
          <div className="px-3 py-2 bg-white border-t border-slate-200 flex justify-between items-center">
            <div className="text-xs text-slate-600">
              {selectedMockupIds.size === 0 ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                  Select mockups
                </span>
              ) : selectedMockupIds.size === 1 ? (
                <span><strong className="text-slate-800">1</strong> selected</span>
              ) : (
                <span><strong className="text-indigo-600">{selectedMockupIds.size}</strong> selected</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setGeneratedMockups([])}
                className="flex items-center gap-1 px-2 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
              >
                <RefreshCcw size={12} />
                Clear
              </button>
              <button 
                onClick={handleProceed}
                disabled={selectedMockupIds.size === 0}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all
                  ${selectedMockupIds.size > 0
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm shadow-indigo-500/20 hover:shadow-md'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                <CheckCircle size={12} />
                Continue
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {enlargedMockup && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setEnlargedMockup(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setEnlargedMockup(null)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 text-white flex items-center justify-center transition-all shadow-xl"
            aria-label="Close"
          >
            <X size={24} strokeWidth={2} />
          </button>

          {/* Navigation arrows */}
          {generatedMockups.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = generatedMockups.findIndex(m => m.id === enlargedMockup.id);
                  const prevIndex = currentIndex === 0 ? generatedMockups.length - 1 : currentIndex - 1;
                  setEnlargedMockup(generatedMockups[prevIndex]);
                }}
                className="absolute left-1/2 -translate-x-[calc(50%+min(42vw,500px))] w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 hover:scale-110 text-white flex items-center justify-center transition-all shadow-xl"
                aria-label="Previous image"
              >
                <ChevronLeft size={28} strokeWidth={2.5} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = generatedMockups.findIndex(m => m.id === enlargedMockup.id);
                  const nextIndex = currentIndex === generatedMockups.length - 1 ? 0 : currentIndex + 1;
                  setEnlargedMockup(generatedMockups[nextIndex]);
                }}
                className="absolute left-1/2 translate-x-[calc(-50%+min(42vw,500px))] w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 hover:border-white/20 hover:scale-110 text-white flex items-center justify-center transition-all shadow-xl"
                aria-label="Next image"
              >
                <ChevronRight size={28} strokeWidth={2.5} />
              </button>
            </>
          )}

          {/* Image container */}
          <div 
            className="relative max-w-5xl w-full flex flex-col items-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={enlargedMockup.imageUrl} 
              alt={enlargedMockup.styleDescription}
              className="max-w-full max-h-[calc(100vh-200px)] w-auto h-auto object-contain rounded-2xl shadow-2xl"
            />
            
            {/* Image info bar */}
            <div className="mt-6 w-full max-w-2xl bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-2xl">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                    <span className="text-xs font-medium text-white/90">
                      {generatedMockups.findIndex(m => m.id === enlargedMockup.id) + 1} of {generatedMockups.length}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDescriptionExpanded(!isDescriptionExpanded);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
                  >
                    <span>{isDescriptionExpanded ? 'Show less' : 'Show more'}</span>
                    <ChevronDown size={14} className={`transition-transform ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <div className={`overflow-hidden transition-all ${isDescriptionExpanded ? 'max-h-96' : 'max-h-16'}`}>
                  <p className={`text-sm text-white/90 leading-relaxed ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`}>
                    {enlargedMockup.styleDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};