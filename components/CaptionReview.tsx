import React, { useState, useEffect } from 'react';
import { MockupOption, GeneratedCaptions, SocialPlatform, CaptionTone, CaptionGenerationOptions } from '../types';
import { generateSocialCaptions } from '../services/geminiService';
import { 
  startOAuthFlow, 
  getConnectedAccounts, 
  disconnectAccount, 
  postToSocial,
  checkAuthResult,
  AccountsMap 
} from '../services/socialAuthService';
import { createScheduledPost, recordPublishedPost } from '../services/scheduledPostsService';
import { CropModal } from './CropModal';
import { ScheduleModal } from './Calendar/ScheduleModal';
import { Facebook, Instagram, Loader2, Send, CheckCircle, Link as LinkIcon, Unlink, AlertCircle, ExternalLink, ChevronLeft, ChevronRight, Images, ArrowLeft, Check, Link2, Crop, Clock, GripVertical, ChevronDown, ChevronUp, RefreshCw, Sparkles } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  mockups: MockupOption[];
  onSuccess: () => void;
  onBack: () => void;
  onScheduled?: () => void;
}

// Tone preset options for the customization panel
const tonePresets: { value: CaptionTone; label: string; emoji: string }[] = [
  { value: 'default', label: 'Default', emoji: '✨' },
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'casual', label: 'Casual', emoji: '😊' },
  { value: 'funny', label: 'Funny', emoji: '😂' },
  { value: 'inspiring', label: 'Inspiring', emoji: '🌟' },
  { value: 'urgent', label: 'Urgent/FOMO', emoji: '🔥' },
  { value: 'minimalist', label: 'Minimalist', emoji: '🎯' },
];

// Sortable thumbnail component for drag-and-drop reordering
interface SortableThumbnailProps {
  mockup: MockupOption;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const SortableThumbnail: React.FC<SortableThumbnailProps> = ({ mockup, index, isSelected, onSelect }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mockup.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all bg-slate-100 flex items-center justify-center group/thumb
        ${isDragging ? 'z-50 shadow-xl scale-105 opacity-90' : ''}
        ${isSelected 
          ? 'border-indigo-500 shadow-md shadow-indigo-500/20' 
          : 'border-transparent hover:border-slate-300 opacity-60 hover:opacity-100'
        }
      `}
    >
      {/* Drag handle overlay */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/0 hover:bg-slate-900/40 transition-colors cursor-grab active:cursor-grabbing"
      >
        <GripVertical 
          size={16} 
          className="text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow-lg" 
        />
      </div>
      
      {/* Click to select - below drag handle */}
      <button
        onClick={onSelect}
        className="absolute inset-0 z-0"
        aria-label={`View image ${index + 1}`}
      />
      
      <img 
        src={mockup.imageUrl} 
        alt={`Thumbnail ${index + 1}`}
        className="max-w-full max-h-full object-contain pointer-events-none"
        draggable={false}
      />
      
      {/* Position badge */}
      <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded text-[10px] font-bold bg-slate-800/70 text-white flex items-center justify-center">
        {index + 1}
      </span>
    </div>
  );
};

export const CaptionReview: React.FC<Props> = ({ mockups, onSuccess, onBack, onScheduled }) => {
  const [captionOptions, setCaptionOptions] = useState<GeneratedCaptions>({ facebook: [], instagram: [] });
  const [selectedIndex, setSelectedIndex] = useState<{ facebook: number; instagram: number }>({ facebook: 0, instagram: 0 });
  const [editedCaption, setEditedCaption] = useState<{ facebook: string; instagram: string }>({ facebook: '', instagram: '' });
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postingToBoth, setPostingToBoth] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'both' | SocialPlatform>('both');
  
  // Carousel navigation state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isCarousel = mockups.length > 1;
  
  // Crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [croppedMockups, setCroppedMockups] = useState<MockupOption[] | null>(null);
  
  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Caption customization state - initialize from localStorage
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [selectedTone, setSelectedTone] = useState<CaptionTone>(() => {
    const saved = localStorage.getItem('captionPresets');
    if (saved) {
      try {
        return JSON.parse(saved).tone || 'default';
      } catch { return 'default'; }
    }
    return 'default';
  });
  const [customTone, setCustomTone] = useState(() => {
    const saved = localStorage.getItem('captionPresets');
    if (saved) {
      try {
        return JSON.parse(saved).customTone || '';
      } catch { return ''; }
    }
    return '';
  });
  const [captionContext, setCaptionContext] = useState(() => {
    const saved = localStorage.getItem('captionPresets');
    if (saved) {
      try {
        return JSON.parse(saved).context || '';
      } catch { return ''; }
    }
    return '';
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Reordering state - tracks the user's custom order
  const [reorderedMockups, setReorderedMockups] = useState<MockupOption[] | null>(null);
  
  // Use reordered mockups if available, then cropped, then original
  // Apply cropping to the reordered list, or use original order
  const baseMockups = reorderedMockups || mockups;
  const displayMockups = croppedMockups 
    ? baseMockups.map(m => croppedMockups.find(c => c.id === m.id) || m)
    : baseMockups;
  
  // DnD sensors for pointer and keyboard interaction
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle drag end - reorder the mockups
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const currentMockups = reorderedMockups || mockups;
      const oldIndex = currentMockups.findIndex(m => m.id === active.id);
      const newIndex = currentMockups.findIndex(m => m.id === over.id);
      
      const newOrder = arrayMove(currentMockups, oldIndex, newIndex);
      setReorderedMockups(newOrder);
      
      // Update current image index to follow the moved item if it was selected
      if (oldIndex === currentImageIndex) {
        setCurrentImageIndex(newIndex);
      } else if (oldIndex < currentImageIndex && newIndex >= currentImageIndex) {
        setCurrentImageIndex(currentImageIndex - 1);
      } else if (oldIndex > currentImageIndex && newIndex <= currentImageIndex) {
        setCurrentImageIndex(currentImageIndex + 1);
      }
    }
  };
  
  const [accounts, setAccounts] = useState<AccountsMap>({
    instagram: { connected: false, username: '' },
    facebook: { connected: false, username: '' }
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check for auth result on mount (in case of redirect back from OAuth)
  useEffect(() => {
    const result = checkAuthResult();
    if (result.success && result.platform) {
      // Refresh accounts after successful auth
      refreshAccounts();
    } else if (result.error) {
      setAuthError(result.error);
    }
  }, []);

  // Fetch connected accounts on mount
  useEffect(() => {
    refreshAccounts();
  }, []);

  // Persist caption presets to localStorage
  useEffect(() => {
    localStorage.setItem('captionPresets', JSON.stringify({
      tone: selectedTone,
      customTone,
      context: captionContext
    }));
  }, [selectedTone, customTone, captionContext]);

  // Generate captions based on the first mockup with saved preferences
  useEffect(() => {
    let mounted = true;
    const fetchCaptions = async () => {
      try {
        // Use the first mockup for caption generation
        const primaryMockup = mockups[0];
        
        // Build options from saved preferences
        const options: CaptionGenerationOptions = {};
        if (customTone) {
          options.customTone = customTone;
        } else if (selectedTone !== 'default') {
          options.tone = selectedTone;
        }
        if (captionContext) {
          options.context = captionContext;
        }
        
        const result = await generateSocialCaptions(
          primaryMockup.styleDescription, 
          primaryMockup.imageUrl,
          Object.keys(options).length > 0 ? options : undefined
        );
        if (mounted) {
          setCaptionOptions(result);
          // Initialize edited captions with the first option for each platform
          setEditedCaption({
            facebook: result.facebook[0] || '',
            instagram: result.instagram[0] || ''
          });
          setSelectedIndex({ facebook: 0, instagram: 0 });
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setLoading(false);
      }
    };
    fetchCaptions();
    return () => { mounted = false; };
  // Note: We intentionally only run this on mockups change, not on preference changes
  // (regeneration is handled by the Regenerate button)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockups]);

  // Carousel navigation
  const goToPrevImage = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : mockups.length - 1));
  };

  const goToNextImage = () => {
    setCurrentImageIndex(prev => (prev < mockups.length - 1 ? prev + 1 : 0));
  };

  const refreshAccounts = async () => {
    const fetchedAccounts = await getConnectedAccounts();
    setAccounts(fetchedAccounts);
  };

  const handleConnect = async (platform?: SocialPlatform) => {
    const platformToConnect = platform || (selectedPlatform === 'both' ? 'instagram' : selectedPlatform);
    
    setIsConnecting(true);
    setAuthError(null);
    
    try {
      const success = await startOAuthFlow(platformToConnect);
      
      if (success) {
        // Refresh accounts to get the newly connected account
        await refreshAccounts();
      }
    } catch (error) {
      console.error('OAuth error:', error);
      setAuthError('Failed to connect. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const success = await disconnectAccount(selectedPlatform);
    if (success) {
      setAccounts(prev => ({
        ...prev,
        [selectedPlatform]: { connected: false, username: '' }
      }));
    }
  };

  const handlePost = async () => {
    setPosting(true);
    setPostError(null);
    
    try {
      // Pass all image URLs for carousel support (use cropped if available)
      const imageUrls = displayMockups.map(m => m.imageUrl);
      const result = await postToSocial(
        selectedPlatform,
        imageUrls,
        editedCaption[selectedPlatform]
      );

      if (result.success) {
        // Record the published post for calendar history
        await recordPublishedPost({
          platforms: [selectedPlatform] as ('facebook' | 'instagram')[],
          captions: editedCaption,
          imageUrls,
          mockupData: displayMockups
        });
        onSuccess();
      } else {
        setPostError(result.error || 'Failed to post. Please try again.');
      }
    } catch (error) {
      console.error('Post error:', error);
      setPostError('Network error. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handlePostToBoth = async () => {
    if (!accounts.facebook.connected || !accounts.instagram.connected) {
      setPostError('Both accounts must be connected to post to both platforms.');
      return;
    }

    setPostingToBoth(true);
    setPostError(null);
    
    try {
      // Use cropped images if available
      const imageUrls = displayMockups.map(m => m.imageUrl);
      
      // Post to both platforms simultaneously
      const [facebookResult, instagramResult] = await Promise.allSettled([
        postToSocial('facebook', imageUrls, editedCaption.facebook),
        postToSocial('instagram', imageUrls, editedCaption.instagram)
      ]);

      const facebookSuccess = facebookResult.status === 'fulfilled' && facebookResult.value.success;
      const instagramSuccess = instagramResult.status === 'fulfilled' && instagramResult.value.success;

      if (facebookSuccess && instagramSuccess) {
        // Record the published post for calendar history
        await recordPublishedPost({
          platforms: ['instagram', 'facebook'],
          captions: editedCaption,
          imageUrls,
          mockupData: displayMockups
        });
        onSuccess();
      } else {
        const errors: string[] = [];
        const successfulPlatforms: ('facebook' | 'instagram')[] = [];
        
        if (facebookSuccess) {
          successfulPlatforms.push('facebook');
        } else {
          const error = facebookResult.status === 'fulfilled' 
            ? facebookResult.value.error 
            : 'Facebook posting failed';
          errors.push(`Facebook: ${error}`);
        }
        if (instagramSuccess) {
          successfulPlatforms.push('instagram');
        } else {
          const error = instagramResult.status === 'fulfilled' 
            ? instagramResult.value.error 
            : 'Instagram posting failed';
          errors.push(`Instagram: ${error}`);
        }
        
        // Record partial success if at least one platform worked
        if (successfulPlatforms.length > 0) {
          await recordPublishedPost({
            platforms: successfulPlatforms,
            captions: editedCaption,
            imageUrls,
            mockupData: displayMockups
          });
        }
        
        setPostError(errors.join('. '));
      }
    } catch (error) {
      console.error('Post error:', error);
      setPostError('Network error. Please try again.');
    } finally {
      setPostingToBoth(false);
    }
  };

  const handleCaptionChange = (text: string) => {
    setEditedCaption(prev => {
      if (selectedPlatform === 'both') {
        // Sync to both platforms when "Both" is selected
        return {
          facebook: text,
          instagram: text
        };
      } else {
        // Update only selected platform
        return {
          ...prev,
          [selectedPlatform]: text
        };
      }
    });
  };

  const handleSelectCaption = (index: number) => {
    if (selectedPlatform === 'both') {
      // When "Both" is selected, use Instagram captions as the source (or could use Facebook)
      const selectedCaption = captionOptions.instagram[index];
      
      setSelectedIndex(prev => ({
        ...prev,
        instagram: index,
        facebook: index
      }));
      
      // Sync to both platforms
      setEditedCaption({
        facebook: selectedCaption,
        instagram: selectedCaption
      });
    } else {
      const selectedCaption = captionOptions[selectedPlatform][index];
      
      setSelectedIndex(prev => ({
        ...prev,
        [selectedPlatform]: index
      }));
      
      // Update only selected platform
      setEditedCaption(prev => ({
        ...prev,
        [selectedPlatform]: selectedCaption
      }));
    }
  };

  const currentAccount = selectedPlatform === 'both' ? null : accounts[selectedPlatform];

  // Get platforms to post to based on selection
  const getSelectedPlatforms = (): SocialPlatform[] => {
    if (selectedPlatform === 'both') {
      return ['instagram', 'facebook'];
    }
    return [selectedPlatform];
  };

  // Handle scheduling a post
  const handleSchedule = async (scheduledDate: Date, platforms: SocialPlatform[]) => {
    const imageUrls = displayMockups.map(m => m.imageUrl);
    
    await createScheduledPost({
      platforms,
      scheduledFor: scheduledDate,
      captions: editedCaption,
      imageUrls,
      mockupData: displayMockups
    });
    
    // Call the onScheduled callback if provided, otherwise onSuccess
    if (onScheduled) {
      onScheduled();
    } else {
      onSuccess();
    }
  };

  // Handle regenerating captions with customization options
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    
    try {
      const primaryMockup = mockups[0];
      
      // Build options from current customization state
      const options: CaptionGenerationOptions = {};
      
      if (customTone) {
        options.customTone = customTone;
      } else if (selectedTone !== 'default') {
        options.tone = selectedTone;
      }
      
      if (captionContext) {
        options.context = captionContext;
      }
      
      const result = await generateSocialCaptions(
        primaryMockup.styleDescription, 
        primaryMockup.imageUrl,
        options
      );
      
      setCaptionOptions(result);
      // Update edited captions with the first option for each platform
      setEditedCaption({
        facebook: result.facebook[0] || '',
        instagram: result.instagram[0] || ''
      });
      setSelectedIndex({ facebook: 0, instagram: 0 });
      
      // Collapse the panel after successful regeneration
      setShowCustomizePanel(false);
    } catch (e) {
      console.error('Error regenerating captions:', e);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/30">
          <Loader2 className="animate-spin text-white" size={28} />
        </div>
        <p className="font-display font-semibold text-slate-800 text-lg">Writing engaging captions...</p>
        <p className="text-sm text-slate-400 mt-1">Tailored for your audience</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Image Preview */}
      <div className="lg:col-span-1">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
          {/* Carousel indicator badge */}
          {isCarousel && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 rounded-full">
                <Images size={12} className="text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-600">Carousel</span>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {currentImageIndex + 1} / {mockups.length}
              </span>
            </div>
          )}
          
          {/* Main Image with Navigation */}
          <div className="relative group rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[200px] max-h-[400px]">
            <img 
              src={displayMockups[currentImageIndex].imageUrl} 
              alt={`Mockup ${currentImageIndex + 1}`}
              className="w-full h-full object-contain max-h-[400px]"
            />
            
            {/* Navigation Arrows */}
            {isCarousel && (
              <>
                <button
                  onClick={goToPrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/90 backdrop-blur-sm text-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-lg"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={goToNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/90 backdrop-blur-sm text-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-lg"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
          
          {/* Thumbnail Strip - Drag to Reorder */}
          {isCarousel && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayMockups.map(m => m.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="mt-3">
                  <p className="text-[10px] text-slate-400 mb-1.5 flex items-center gap-1">
                    <GripVertical size={10} />
                    Drag to reorder
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {displayMockups.map((mockup, idx) => (
                      <SortableThumbnail
                        key={mockup.id}
                        mockup={mockup}
                        index={idx}
                        isSelected={idx === currentImageIndex}
                        onSelect={() => setCurrentImageIndex(idx)}
                      />
                    ))}
                  </div>
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Dot Indicators */}
          {isCarousel && (
            <div className="flex justify-center gap-1.5 mt-3">
              {displayMockups.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`
                    h-1.5 rounded-full transition-all
                    ${idx === currentImageIndex 
                      ? 'bg-indigo-600 w-4' 
                      : 'bg-slate-200 w-1.5 hover:bg-slate-300'
                    }
                  `}
                />
              ))}
            </div>
          )}

          <button 
            onClick={onBack}
            className="w-full mt-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Styles
          </button>

          <button 
            onClick={() => setShowCropModal(true)}
            className="w-full mt-2 py-2.5 text-sm text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 rounded-xl transition-all flex items-center justify-center gap-2 font-medium"
          >
            <Crop size={16} />
            Edit Images
            {croppedMockups && (
              <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500" title="Cropped" />
            )}
          </button>
        </div>
      </div>

      {/* Right: Caption Editor */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Platform Tabs - Redesigned */}
        <div className="flex p-2 gap-2 bg-slate-50 border-b border-slate-100">
          <button
            onClick={() => { setSelectedPlatform('both'); setAuthError(null); setPostError(null); }}
            className={`
              flex-1 py-3 flex items-center justify-center gap-2 font-semibold text-sm rounded-xl transition-all
              ${selectedPlatform === 'both' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }
            `}
          >
            <Send size={18} />
            Both
            {accounts.instagram.connected && accounts.facebook.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            onClick={() => { setSelectedPlatform('instagram'); setAuthError(null); setPostError(null); }}
            className={`
              flex-1 py-3 flex items-center justify-center gap-2 font-semibold text-sm rounded-xl transition-all
              ${selectedPlatform === 'instagram' 
                ? 'bg-white text-pink-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }
            `}
          >
            <Instagram size={18} />
            Instagram
            {accounts.instagram.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            onClick={() => { setSelectedPlatform('facebook'); setAuthError(null); setPostError(null); }}
            className={`
              flex-1 py-3 flex items-center justify-center gap-2 font-semibold text-sm rounded-xl transition-all
              ${selectedPlatform === 'facebook' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }
            `}
          >
            <Facebook size={18} />
            Facebook
            {accounts.facebook.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Connection Status Bar - Cleaner */}
        {selectedPlatform === 'both' ? (
          <div className={`
            px-5 py-3 border-b border-slate-100
            ${accounts.instagram.connected && accounts.facebook.connected
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100' 
              : 'bg-slate-50'
            }
          `}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {accounts.instagram.connected && accounts.facebook.connected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-slate-600 font-medium">Both accounts connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} className="text-amber-500" />
                    <span className="text-sm text-slate-500">Connection required</span>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                <div className="flex items-center gap-2">
                  <Instagram size={14} className="text-pink-600" />
                  <span className="text-slate-600">Instagram</span>
                </div>
                <div className="flex items-center gap-2">
                  {accounts.instagram.connected ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-emerald-600 font-medium">{accounts.instagram.username}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-amber-600">Not connected</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                <div className="flex items-center gap-2">
                  <Facebook size={14} className="text-blue-600" />
                  <span className="text-slate-600">Facebook</span>
                </div>
                <div className="flex items-center gap-2">
                  {accounts.facebook.connected ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-emerald-600 font-medium">{accounts.facebook.username}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-amber-600">Not connected</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={`
            px-5 py-2.5 flex items-center justify-between text-sm
            ${currentAccount?.connected 
              ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100' 
              : 'bg-slate-50 border-b border-slate-100'
            }
          `}>
            <div className="flex items-center gap-2">
              {currentAccount?.connected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">Connected as <span className="font-semibold text-emerald-700">{currentAccount.username}</span></span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="text-amber-500" />
                  <span className="text-slate-500">Account not connected</span>
                </>
              )}
            </div>
            {currentAccount?.connected ? (
              <button onClick={handleDisconnect} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                <Unlink size={12} /> Disconnect
              </button>
            ) : (
              <span className="text-xs text-slate-400">Required to post</span>
            )}
          </div>
        )}

        {/* Auth Error */}
        {authError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Connection Failed</p>
              <p className="text-red-600">{authError}</p>
            </div>
          </div>
        )}

        {/* Post Error */}
        {postError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Posting Failed</p>
              <p className="text-red-600">{postError}</p>
            </div>
          </div>
        )}

        <div className="p-5 flex-1 flex flex-col relative">
          {/* Caption Options Selection - Simplified */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Choose a caption style
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(selectedPlatform === 'both' ? captionOptions.instagram : captionOptions[selectedPlatform]).map((caption, index) => {
                const isSelected = selectedPlatform === 'both' 
                  ? selectedIndex.instagram === index && selectedIndex.facebook === index
                  : selectedIndex[selectedPlatform] === index;
                const platformColor = selectedPlatform === 'both' 
                  ? 'indigo' 
                  : selectedPlatform === 'instagram' 
                    ? 'pink' 
                    : 'blue';
                return (
                  <button
                    key={index}
                    onClick={() => handleSelectCaption(index)}
                    className={`
                      relative flex-shrink-0 w-44 p-3 rounded-xl border-2 text-left transition-all
                      ${isSelected 
                        ? platformColor === 'pink'
                          ? 'border-pink-400 bg-pink-50'
                          : platformColor === 'blue'
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }
                    `}
                  >
                    {/* Selection indicator */}
                    <div className={`
                      absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center transition-all
                      ${isSelected 
                        ? platformColor === 'pink'
                          ? 'bg-pink-500 text-white'
                          : platformColor === 'blue'
                            ? 'bg-blue-500 text-white'
                            : 'bg-indigo-500 text-white'
                        : 'border-2 border-slate-200'
                      }
                    `}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                    
                    {/* Caption preview */}
                    <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed pr-6">
                      {caption}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customize Captions Panel - Collapsible */}
          <div className="mb-5">
            <button
              onClick={() => setShowCustomizePanel(!showCustomizePanel)}
              className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-sm group"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-500" />
                <span className="font-medium text-slate-700 group-hover:text-indigo-700">
                  Customize & Regenerate Captions
                </span>
                {(selectedTone !== 'default' || customTone || captionContext) && (
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs font-medium rounded-full">
                    Customized
                  </span>
                )}
              </div>
              {showCustomizePanel ? (
                <ChevronUp size={18} className="text-slate-400 group-hover:text-indigo-500" />
              ) : (
                <ChevronDown size={18} className="text-slate-400 group-hover:text-indigo-500" />
              )}
            </button>

            {/* Expandable Panel Content */}
            <div className={`
              overflow-hidden transition-all duration-300 ease-in-out
              ${showCustomizePanel ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'}
            `}>
              <div className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl border border-slate-200 space-y-4">
                {/* Tone Presets */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Tone
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tonePresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => {
                          setSelectedTone(preset.value);
                          if (preset.value !== 'default') setCustomTone(''); // Clear custom when preset selected
                        }}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5
                          ${selectedTone === preset.value
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                          }
                        `}
                      >
                        <span>{preset.emoji}</span>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Tone Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Custom Tone <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customTone}
                    onChange={(e) => {
                      setCustomTone(e.target.value);
                      if (e.target.value) setSelectedTone('default'); // Clear preset when custom entered
                    }}
                    placeholder="e.g., Playful and Gen-Z friendly, Luxury and exclusive..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                  />
                </div>

                {/* Context Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Additional Context <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={captionContext}
                    onChange={(e) => setCaptionContext(e.target.value)}
                    placeholder="e.g., This is a limited edition summer drop, mention 20% off sale, target young professionals..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none resize-none transition-all"
                  />
                </div>

                {/* Regenerate Button */}
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
                    ${isRegenerating
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5'
                    }
                  `}
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Regenerating Captions...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Regenerate Captions
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Caption Editor */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Edit Caption
              </label>
              {selectedPlatform === 'both' && (
                <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                  <Link2 size={12} />
                  Synced to both
                </span>
              )}
            </div>
            <textarea
              value={selectedPlatform === 'both' ? editedCaption.instagram : editedCaption[selectedPlatform]}
              onChange={(e) => handleCaptionChange(e.target.value)}
              className="w-full flex-1 min-h-[160px] p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none resize-none text-sm text-slate-800 leading-relaxed placeholder-slate-400 transition-all"
              placeholder="Write your caption here..."
            />
          </div>
          
          {/* Action Bar */}
          <div className="mt-5 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 space-y-1">
              {selectedPlatform === 'both' ? (
                <>
                  <p className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${accounts.facebook.connected && accounts.instagram.connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span className={accounts.facebook.connected && accounts.instagram.connected ? 'text-emerald-600 font-medium' : 'text-amber-600'}>
                      {accounts.facebook.connected && accounts.instagram.connected ? 'Ready to publish to both' : 'Connection required'}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Instagram size={12} className="text-pink-600" />
                    <Facebook size={12} className="text-blue-600" />
                    <span>Both platforms</span>
                    {isCarousel && (
                      <span className="text-indigo-600 font-medium flex items-center gap-1 ml-1">
                        • <Images size={10} /> {mockups.length} images
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${currentAccount?.connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span className={currentAccount?.connected ? 'text-emerald-600 font-medium' : 'text-amber-600'}>
                      {currentAccount?.connected ? 'Ready to publish' : 'Connection required'}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    {selectedPlatform === 'instagram' ? <Instagram size={12} /> : <Facebook size={12} />}
                    <span className="capitalize">{selectedPlatform}</span>
                    {isCarousel && (
                      <span className="text-indigo-600 font-medium flex items-center gap-1 ml-1">
                        • <Images size={10} /> {mockups.length} images
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Schedule Button - Always available */}
              <button
                onClick={() => setShowScheduleModal(true)}
                disabled={
                  (selectedPlatform === 'both' && (!editedCaption.facebook.trim() || !editedCaption.instagram.trim())) ||
                  (selectedPlatform !== 'both' && !editedCaption[selectedPlatform].trim())
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock size={16} />
                Schedule
              </button>

              {selectedPlatform === 'both' ? (
                // Both mode - show Post to Both button
                accounts.facebook.connected && accounts.instagram.connected ? (
                  <button
                    onClick={handlePostToBoth}
                    disabled={postingToBoth || !editedCaption.facebook.trim() || !editedCaption.instagram.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                  >
                    {postingToBoth ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Publishing to Both...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Post Now
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Connect both accounts to post</span>
                )
              ) : (
                // Single platform mode
                !currentAccount?.connected ? (
                  <button
                    onClick={() => handleConnect()}
                    disabled={isConnecting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white shadow-md transition-all bg-slate-800 hover:bg-slate-900 disabled:opacity-70"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <LinkIcon size={16} />
                        Connect {selectedPlatform === 'instagram' ? 'Instagram' : 'Facebook'}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handlePost}
                    disabled={posting || postingToBoth || !editedCaption[selectedPlatform].trim()}
                    className={`
                      flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition-all
                      ${posting || postingToBoth || !editedCaption[selectedPlatform].trim() 
                        ? 'bg-slate-300 cursor-not-allowed' 
                        : selectedPlatform === 'instagram' 
                          ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/30 hover:-translate-y-0.5' 
                          : 'bg-blue-600 shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5'
                      }
                    `}
                  >
                    {posting ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Post Now
                      </>
                    )}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Setup Instructions */}
          {selectedPlatform === 'both' ? (
            (!accounts.facebook.connected || !accounts.instagram.connected) && (
              <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-xl text-sm">
                <p className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                  <ExternalLink size={14} />
                  Setup Required
                </p>
                <p className="text-amber-700 leading-relaxed mb-2">
                  To post to both platforms, you need to connect both your Instagram and Facebook accounts.
                </p>
                <div className="flex gap-2 mt-3">
                  {!accounts.instagram.connected && (
                    <button
                      onClick={() => handleConnect('instagram')}
                      disabled={isConnecting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-amber-800 bg-white border border-amber-200 hover:bg-amber-50 transition-colors disabled:opacity-50"
                    >
                      <Instagram size={14} />
                      Connect Instagram
                    </button>
                  )}
                  {!accounts.facebook.connected && (
                    <button
                      onClick={() => handleConnect('facebook')}
                      disabled={isConnecting}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-amber-800 bg-white border border-amber-200 hover:bg-amber-50 transition-colors disabled:opacity-50"
                    >
                      <Facebook size={14} />
                      Connect Facebook
                    </button>
                  )}
                </div>
                <a 
                  href="https://developers.facebook.com/docs/instagram-api/getting-started" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-amber-700 font-medium hover:text-amber-800 mt-3 inline-flex items-center gap-1 transition-colors"
                >
                  Learn more <ExternalLink size={12} />
                </a>
              </div>
            )
          ) : (
            !currentAccount?.connected && (
              <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-xl text-sm">
                <p className="font-semibold text-amber-800 flex items-center gap-2 mb-1">
                  <ExternalLink size={14} />
                  Setup Required
                </p>
                <p className="text-amber-700 leading-relaxed">
                  {selectedPlatform === 'instagram' 
                    ? 'Instagram posting requires a Facebook Page connected to an Instagram Business or Creator account.'
                    : 'You\'ll need to grant access to a Facebook Page you manage.'
                  }
                </p>
                <a 
                  href="https://developers.facebook.com/docs/instagram-api/getting-started" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-amber-700 font-medium hover:text-amber-800 mt-2 inline-flex items-center gap-1 transition-colors"
                >
                  Learn more <ExternalLink size={12} />
                </a>
              </div>
            )
          )}
        </div>
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <CropModal
          mockups={mockups}
          onSave={(cropped) => {
            setCroppedMockups(cropped);
            setShowCropModal(false);
          }}
          onClose={() => setShowCropModal(false)}
        />
      )}

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleSchedule}
        platforms={getSelectedPlatforms()}
        mockups={displayMockups}
        captions={editedCaption}
      />
    </div>
  );
};
