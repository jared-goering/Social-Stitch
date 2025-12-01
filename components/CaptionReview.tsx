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
import { Facebook, Instagram, Loader2, Send, CheckCircle, Link as LinkIcon, Unlink, AlertCircle, ExternalLink } from 'lucide-react';

interface Props {
  mockup: MockupOption;
  onSuccess: () => void;
  onBack: () => void;
}

export const CaptionReview: React.FC<Props> = ({ mockup, onSuccess, onBack }) => {
  const [captionOptions, setCaptionOptions] = useState<GeneratedCaptions>({ facebook: [], instagram: [] });
  const [selectedIndex, setSelectedIndex] = useState<{ facebook: number; instagram: number }>({ facebook: 0, instagram: 0 });
  const [editedCaption, setEditedCaption] = useState<{ facebook: string; instagram: string }>({ facebook: '', instagram: '' });
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('instagram');
  
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

  // Generate captions
  useEffect(() => {
    let mounted = true;
    const fetchCaptions = async () => {
      try {
        const result = await generateSocialCaptions(mockup.styleDescription, mockup.imageUrl);
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
  }, [mockup]);

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
      const result = await postToSocial(
        selectedPlatform,
        mockup.imageUrl,
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
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <Loader2 className="animate-spin mb-4 text-indigo-600" size={40} />
        <p>Writing engaging captions for you...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Image Preview */}
      <div className="lg:col-span-1">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 sticky top-24">
          <img 
            src={mockup.imageUrl} 
            alt="Final Mockup" 
            className="w-full rounded-lg"
          />
          <div className="mt-4 flex gap-2">
            <button 
              onClick={onBack}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors"
            >
              Back to Styles
            </button>
          </div>
        </div>
      </div>

      {/* Right: Caption Editor */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Platform Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => { setSelectedPlatform('instagram'); setAuthError(null); setPostError(null); }}
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${selectedPlatform === 'instagram' ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Instagram size={20} />
            Instagram
            {accounts.instagram.connected && <CheckCircle size={14} className="text-emerald-500" />}
          </button>
          <button
            onClick={() => { setSelectedPlatform('facebook'); setAuthError(null); setPostError(null); }}
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors ${selectedPlatform === 'facebook' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Facebook size={20} />
            Facebook
            {accounts.facebook.connected && <CheckCircle size={14} className="text-emerald-500" />}
          </button>
        </div>

        {/* Connection Status Bar */}
        <div className={`px-6 py-3 border-b border-slate-100 flex items-center justify-between text-sm ${currentAccount.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
          <div className="flex items-center gap-2">
            {currentAccount.connected ? (
              <>
                <CheckCircle size={16} />
                <span>Connected as <strong>{currentAccount.username}</strong></span>
              </>
            ) : (
              <>
                <AlertCircle size={16} className="text-amber-500" />
                <span>Account not connected</span>
              </>
            )}
          </div>
          {currentAccount.connected ? (
            <button onClick={handleDisconnect} className="text-xs hover:underline text-emerald-600 flex items-center gap-1">
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

        <div className="p-6 flex-1 flex flex-col relative">
          {/* Caption Options Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Choose a caption style
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {captionOptions[selectedPlatform].map((caption, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectCaption(index)}
                  className={`
                    relative p-3 rounded-lg border-2 text-left transition-all duration-200 group
                    ${selectedIndex[selectedPlatform] === index 
                      ? selectedPlatform === 'instagram'
                        ? 'border-pink-500 bg-pink-50 shadow-md'
                        : 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }
                  `}
                >
                  {/* Option number badge */}
                  <div className={`
                    absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${selectedIndex[selectedPlatform] === index 
                      ? selectedPlatform === 'instagram'
                        ? 'bg-pink-500 text-white'
                        : 'bg-blue-500 text-white'
                      : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                    }
                  `}>
                    {index + 1}
                  </div>
                  
                  {/* Selected checkmark */}
                  {selectedIndex[selectedPlatform] === index && (
                    <div className={`
                      absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center
                      ${selectedPlatform === 'instagram' ? 'bg-pink-500' : 'bg-blue-500'}
                    `}>
                      <CheckCircle size={14} className="text-white" />
                    </div>
                  )}
                  
                  {/* Caption preview */}
                  <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">
                    {caption}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-xs text-slate-400 font-medium">Edit your selected caption</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          <label className="block text-sm font-medium text-slate-700 mb-2">
            Caption
          </label>
          <textarea
            value={editedCaption[selectedPlatform]}
            onChange={(e) => handleCaptionChange(e.target.value)}
            className="w-full flex-1 min-h-[200px] p-4 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none font-sans text-slate-900 leading-relaxed placeholder-slate-400"
            placeholder="Write your caption here..."
          />
          
          <div className="mt-6 flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-xs text-slate-500">
              <p>Status: <span className={`${currentAccount.connected ? 'text-emerald-600' : 'text-amber-600'} font-medium`}>
                {currentAccount.connected ? 'Ready to publish' : 'Connection required'}
              </span></p>
              <p className="mt-1">Platform: <span className="font-medium text-slate-700 capitalize">{selectedPlatform}</span></p>
            </div>

            {!currentAccount.connected ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white shadow-md transition-all bg-slate-800 hover:bg-slate-900 disabled:opacity-70"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LinkIcon size={18} />
                    Connect {selectedPlatform === 'instagram' ? 'Instagram' : 'Facebook'}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handlePost}
                disabled={posting || !editedCaption[selectedPlatform].trim()}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white shadow-md transition-all
                  ${posting || !editedCaption[selectedPlatform].trim() ? 'bg-slate-400 cursor-not-allowed' : 
                  selectedPlatform === 'instagram' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' :
                  'bg-blue-600 hover:bg-blue-700'}
                `}
              >
                {posting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Post Now
                  </>
                )}
              </button>
            )}
          </div>

          {/* Setup Instructions */}
          {!currentAccount.connected && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="font-medium text-amber-800 flex items-center gap-2">
                <ExternalLink size={14} />
                Setup Required
              </p>
              <p className="text-amber-700 mt-1">
                {selectedPlatform === 'instagram' 
                  ? 'Instagram posting requires a Facebook Page connected to an Instagram Business or Creator account.'
                  : 'You\'ll need to grant access to a Facebook Page you manage.'
                }
              </p>
              <a 
                href="https://developers.facebook.com/docs/instagram-api/getting-started" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-amber-800 underline hover:text-amber-900 mt-2 inline-block"
              >
                Learn more about requirements
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
