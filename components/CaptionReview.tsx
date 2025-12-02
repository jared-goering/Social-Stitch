import React, { useState, useEffect } from 'react';
import { MockupOption, GeneratedCaptions, SocialPlatform } from '../types';
import { generateSocialCaptions } from '../services/geminiService';
import { 
  startOAuthFlow, 
  getConnectedAccounts, 
  disconnectAccount, 
  postToSocial,
  checkAuthResult,
  AccountsMap 
} from '../services/socialAuthService';
import { Facebook, Instagram, Loader2, Send, CheckCircle, Link as LinkIcon, Unlink, AlertCircle, ExternalLink, ChevronLeft, ChevronRight, Images, ArrowLeft, Check } from 'lucide-react';

interface Props {
  mockups: MockupOption[];
  onSuccess: () => void;
  onBack: () => void;
}

export const CaptionReview: React.FC<Props> = ({ mockups, onSuccess, onBack }) => {
  const [captionOptions, setCaptionOptions] = useState<GeneratedCaptions>({ facebook: [], instagram: [] });
  const [selectedIndex, setSelectedIndex] = useState<{ facebook: number; instagram: number }>({ facebook: 0, instagram: 0 });
  const [editedCaption, setEditedCaption] = useState<{ facebook: string; instagram: string }>({ facebook: '', instagram: '' });
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('instagram');
  
  // Carousel navigation state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isCarousel = mockups.length > 1;
  
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

  // Generate captions based on the first mockup
  useEffect(() => {
    let mounted = true;
    const fetchCaptions = async () => {
      try {
        // Use the first mockup for caption generation
        const primaryMockup = mockups[0];
        const result = await generateSocialCaptions(primaryMockup.styleDescription, primaryMockup.imageUrl);
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

  const handleConnect = async () => {
    setIsConnecting(true);
    setAuthError(null);
    
    try {
      const success = await startOAuthFlow(selectedPlatform);
      
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
      // Pass all image URLs for carousel support
      const imageUrls = mockups.map(m => m.imageUrl);
      const result = await postToSocial(
        selectedPlatform,
        imageUrls,
        editedCaption[selectedPlatform]
      );

      if (result.success) {
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

  const handleCaptionChange = (text: string) => {
    setEditedCaption(prev => ({
      ...prev,
      [selectedPlatform]: text
    }));
  };

  const handleSelectCaption = (index: number) => {
    setSelectedIndex(prev => ({
      ...prev,
      [selectedPlatform]: index
    }));
    // Update the edited caption with the selected option
    setEditedCaption(prev => ({
      ...prev,
      [selectedPlatform]: captionOptions[selectedPlatform][index]
    }));
  };

  const currentAccount = accounts[selectedPlatform];

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
          <div className="relative group rounded-xl overflow-hidden">
            <img 
              src={mockups[currentImageIndex].imageUrl} 
              alt={`Mockup ${currentImageIndex + 1}`}
              className="w-full aspect-square object-cover"
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
          
          {/* Thumbnail Strip */}
          {isCarousel && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {mockups.map((mockup, idx) => (
                <button
                  key={mockup.id}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`
                    flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all
                    ${idx === currentImageIndex 
                      ? 'border-indigo-500 shadow-md shadow-indigo-500/20' 
                      : 'border-transparent hover:border-slate-300 opacity-60 hover:opacity-100'
                    }
                  `}
                >
                  <img 
                    src={mockup.imageUrl} 
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Dot Indicators */}
          {isCarousel && (
            <div className="flex justify-center gap-1.5 mt-3">
              {mockups.map((_, idx) => (
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
        </div>
      </div>

      {/* Right: Caption Editor */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Platform Tabs - Redesigned */}
        <div className="flex p-2 gap-2 bg-slate-50 border-b border-slate-100">
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
        <div className={`
          px-5 py-2.5 flex items-center justify-between text-sm
          ${currentAccount.connected 
            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100' 
            : 'bg-slate-50 border-b border-slate-100'
          }
        `}>
          <div className="flex items-center gap-2">
            {currentAccount.connected ? (
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
          {currentAccount.connected ? (
            <button onClick={handleDisconnect} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
              <Unlink size={12} /> Disconnect
            </button>
          ) : (
            <span className="text-xs text-slate-400">Required to post</span>
          )}
        </div>

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
              {captionOptions[selectedPlatform].map((caption, index) => {
                const isSelected = selectedIndex[selectedPlatform] === index;
                const platformColor = selectedPlatform === 'instagram' ? 'pink' : 'blue';
                return (
                  <button
                    key={index}
                    onClick={() => handleSelectCaption(index)}
                    className={`
                      relative flex-shrink-0 w-44 p-3 rounded-xl border-2 text-left transition-all
                      ${isSelected 
                        ? platformColor === 'pink'
                          ? 'border-pink-400 bg-pink-50'
                          : 'border-blue-400 bg-blue-50'
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
                          : 'bg-blue-500 text-white'
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

          {/* Caption Editor */}
          <div className="flex-1 flex flex-col">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Edit Caption
            </label>
            <textarea
              value={editedCaption[selectedPlatform]}
              onChange={(e) => handleCaptionChange(e.target.value)}
              className="w-full flex-1 min-h-[160px] p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none resize-none text-sm text-slate-800 leading-relaxed placeholder-slate-400 transition-all"
              placeholder="Write your caption here..."
            />
          </div>
          
          {/* Action Bar */}
          <div className="mt-5 flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 space-y-1">
              <p className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${currentAccount.connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className={currentAccount.connected ? 'text-emerald-600 font-medium' : 'text-amber-600'}>
                  {currentAccount.connected ? 'Ready to publish' : 'Connection required'}
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
            </div>

            {!currentAccount.connected ? (
              <button
                onClick={handleConnect}
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
                disabled={posting || !editedCaption[selectedPlatform].trim()}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white transition-all
                  ${posting || !editedCaption[selectedPlatform].trim() 
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
            )}
          </div>

          {/* Setup Instructions */}
          {!currentAccount.connected && (
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
          )}
        </div>
      </div>
    </div>
  );
};
