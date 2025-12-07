import React, { useState, useEffect } from 'react';
import { ScheduledPost, PostStatus, SocialPlatform } from '../../types';
import { 
  Facebook, 
  Instagram, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  MoreHorizontal,
  Calendar,
  RefreshCw,
  Trash2,
  Images,
  Link,
  Loader2,
  Pencil
} from 'lucide-react';
import { startOAuthFlow, getConnectedAccounts, AccountsMap } from '../../services/socialAuthService';

interface Props {
  post: ScheduledPost;
  onReschedule?: (post: ScheduledPost) => void;
  onDelete?: (post: ScheduledPost) => void;
  onRetry?: (post: ScheduledPost) => void;
  onEdit?: (post: ScheduledPost) => void;
  onAccountConnected?: () => void;
  compact?: boolean;
}

// Helper to detect if error is about accounts not being connected
function getDisconnectedPlatforms(error?: string): SocialPlatform[] {
  if (!error) return [];
  const disconnected: SocialPlatform[] = [];
  if (error.toLowerCase().includes('instagram') && error.toLowerCase().includes('not connected')) {
    disconnected.push('instagram');
  }
  if (error.toLowerCase().includes('facebook') && error.toLowerCase().includes('not connected')) {
    disconnected.push('facebook');
  }
  return disconnected;
}

const STATUS_CONFIG: Record<PostStatus, { 
  icon: React.ElementType; 
  label: string; 
  bgColor: string; 
  textColor: string;
  iconColor: string;
}> = {
  scheduled: {
    icon: Clock,
    label: 'Scheduled',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    iconColor: 'text-amber-500'
  },
  published: {
    icon: CheckCircle,
    label: 'Published',
    bgColor: 'bg-sage-50',
    textColor: 'text-sage-700',
    iconColor: 'text-sage-500'
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    iconColor: 'text-rose-600'
  }
};

export const PostCard: React.FC<Props> = ({ 
  post, 
  onReschedule, 
  onDelete, 
  onRetry,
  onEdit,
  onAccountConnected,
  compact = false 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<AccountsMap | null>(null);
  const [checkingAccounts, setCheckingAccounts] = useState(false);
  const statusConfig = STATUS_CONFIG[post.status];
  const StatusIcon = statusConfig.icon;
  
  // Check if error is about disconnected accounts
  const disconnectedPlatforms = getDisconnectedPlatforms(post.error);
  const hasDisconnectedAccounts = disconnectedPlatforms.length > 0;
  
  // Check which platforms are actually still disconnected (vs already reconnected)
  const actuallyDisconnected = connectedAccounts 
    ? disconnectedPlatforms.filter(p => !connectedAccounts[p]?.connected)
    : disconnectedPlatforms;
  
  // All previously disconnected accounts are now connected
  const allNowConnected = hasDisconnectedAccounts && actuallyDisconnected.length === 0;
  
  // Fetch connected accounts status when there's a disconnect error
  useEffect(() => {
    if (hasDisconnectedAccounts && post.status === 'failed') {
      setCheckingAccounts(true);
      getConnectedAccounts()
        .then(accounts => setConnectedAccounts(accounts))
        .catch(console.error)
        .finally(() => setCheckingAccounts(false));
    }
  }, [hasDisconnectedAccounts, post.status]);
  
  const handleConnect = async (platform: SocialPlatform) => {
    setConnecting(platform);
    try {
      const success = await startOAuthFlow(platform);
      if (success) {
        // Refresh the connected accounts status
        const accounts = await getConnectedAccounts();
        setConnectedAccounts(accounts);
        onAccountConnected?.();
      }
    } finally {
      setConnecting(null);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (compact) {
    return (
      <div className={`
        post-card group relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer
        ${post.status === 'failed' ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}
        ${showMenu ? 'z-40' : ''}
      `}>
        {/* Image preview */}
        {post.imageUrls[0] && (
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
            <img 
              src={post.imageUrls[0]} 
              alt="Post preview" 
              className="w-full h-full object-cover"
            />
            {post.imageUrls.length > 1 && (
              <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1 rounded-tl">
                <Images size={8} className="inline mr-0.5" />
                {post.imageUrls.length}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Platform icons */}
            <div className="flex items-center gap-1">
              {post.platforms.includes('instagram') && (
                <Instagram size={12} className="text-pink-500" />
              )}
              {post.platforms.includes('facebook') && (
                <Facebook size={12} className="text-blue-500" />
              )}
            </div>
            
            {/* Status badge */}
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${statusConfig.bgColor}`}>
              <StatusIcon size={10} className={statusConfig.iconColor} />
              <span className={`text-[10px] font-medium ${statusConfig.textColor}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          
          <p className="text-xs text-slate-600 line-clamp-1">
            {post.captions.instagram || post.captions.facebook}
          </p>
          
          <p className="text-[10px] text-slate-400 mt-1">
            {formatTime(post.scheduledFor)}
          </p>
          
          {/* Error message for compact view */}
          {post.status === 'failed' && post.error && (
            <div className={`mt-2 p-2 rounded border ${allNowConnected ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              {allNowConnected ? (
                // All accounts now connected - ready to retry
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle size={10} />
                    Accounts connected! Ready to retry
                  </p>
                  {onRetry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetry(post);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500 text-white text-[10px] font-medium hover:bg-emerald-600 transition-colors"
                    >
                      <RefreshCw size={10} />
                      Retry Now
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-rose-600 leading-relaxed mb-1">
                    <AlertCircle size={10} className="inline mr-1" />
                    {post.error}
                  </p>
                  
                  {/* Connect account buttons for accounts still disconnected */}
                  {actuallyDisconnected.length > 0 && !checkingAccounts && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {actuallyDisconnected.map(platform => (
                        <button
                          key={platform}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConnect(platform);
                          }}
                          disabled={connecting !== null}
                          className={`
                            flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors
                            ${platform === 'instagram' 
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600' 
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                        >
                          {connecting === platform ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Link size={10} />
                          )}
                          Connect {platform === 'instagram' ? 'Instagram' : 'Facebook'}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {checkingAccounts && (
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                      <Loader2 size={10} className="animate-spin" />
                      Checking account status...
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick actions on hover */}
        {(onReschedule || onDelete || onRetry || onEdit) && (
          <div className={`relative transition-opacity ${showMenu ? 'opacity-100 z-50' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <MoreHorizontal size={14} />
            </button>
            
            {showMenu && (
              <div className="absolute right-2 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 min-w-[140px]">
                {post.status === 'scheduled' && onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(post);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                )}
                {post.status === 'failed' && onRetry && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(post);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Retry
                  </button>
                )}
                {post.status === 'scheduled' && onReschedule && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReschedule(post);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Calendar size={14} />
                    Reschedule
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(post);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full card view
  return (
    <div className={`
      post-card bg-white rounded-2xl border overflow-hidden
      ${post.status === 'failed' ? 'border-rose-200' : 'border-slate-200'}
    `}>
      {/* Image */}
      {post.imageUrls[0] && (
        <div className="relative aspect-square bg-slate-100">
          <img 
            src={post.imageUrls[0]} 
            alt="Post preview" 
            className="w-full h-full object-cover"
          />
          {post.imageUrls.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <Images size={12} />
              {post.imageUrls.length}
            </div>
          )}
          
          {/* Status overlay */}
          <div className={`absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${statusConfig.bgColor}`}>
            <StatusIcon size={14} className={statusConfig.iconColor} />
            <span className={`text-xs font-semibold ${statusConfig.textColor}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {post.platforms.includes('instagram') && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                <Instagram size={14} className="text-white" />
              </div>
            )}
            {post.platforms.includes('facebook') && (
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <Facebook size={14} className="text-white" />
              </div>
            )}
          </div>
          
          {(onReschedule || onDelete || onRetry || onEdit) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 min-w-[160px]">
                  {post.status === 'scheduled' && onEdit && (
                    <button
                      onClick={() => {
                        onEdit(post);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  )}
                  {post.status === 'failed' && onRetry && (
                    <button
                      onClick={() => {
                        onRetry(post);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <RefreshCw size={14} />
                      Retry Now
                    </button>
                  )}
                  {post.status === 'scheduled' && onReschedule && (
                    <button
                      onClick={() => {
                        onReschedule(post);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Calendar size={14} />
                      Reschedule
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        onDelete(post);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Caption */}
        <p className="text-sm text-slate-700 line-clamp-3 mb-3 leading-relaxed">
          {post.captions.instagram || post.captions.facebook}
        </p>

        {/* Timestamp */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={12} />
          <span>
            {post.status === 'published' && post.publishedAt
              ? `Published ${formatDate(post.publishedAt)} at ${formatTime(post.publishedAt)}`
              : `${formatDate(post.scheduledFor)} at ${formatTime(post.scheduledFor)}`
            }
          </span>
        </div>

        {/* Error message */}
        {post.status === 'failed' && post.error && (
          <div className={`mt-3 p-3 rounded-lg border ${allNowConnected ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
            {allNowConnected ? (
              // All accounts now connected - ready to retry
              <div>
                <p className="text-xs text-emerald-700 flex items-center gap-2 mb-3">
                  <CheckCircle size={14} className="flex-shrink-0" />
                  <span className="font-medium">Accounts connected! Ready to retry</span>
                </p>
                {onRetry && (
                  <button
                    onClick={() => onRetry(post)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 hover:-translate-y-0.5"
                  >
                    <RefreshCw size={14} />
                    Retry Post Now
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-rose-700 flex items-start gap-2 mb-2">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  {post.error}
                </p>
                
                {/* Connect account buttons for accounts still disconnected */}
                {actuallyDisconnected.length > 0 && !checkingAccounts && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-rose-100">
                    <span className="text-xs text-rose-600 w-full mb-1">Connect your accounts to retry:</span>
                    {actuallyDisconnected.map(platform => (
                      <button
                        key={platform}
                        onClick={() => handleConnect(platform)}
                        disabled={connecting !== null}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${platform === 'instagram' 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-md shadow-purple-500/20' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5
                        `}
                      >
                        {connecting === platform ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : platform === 'instagram' ? (
                          <Instagram size={12} />
                        ) : (
                          <Facebook size={12} />
                        )}
                        Connect {platform === 'instagram' ? 'Instagram' : 'Facebook'}
                      </button>
                    ))}
                  </div>
                )}
                
                {checkingAccounts && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                    <Loader2 size={12} className="animate-spin" />
                    Checking account status...
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Status dot component for calendar grid
export const PostStatusDot: React.FC<{ status: PostStatus; count?: number }> = ({ status, count }) => {
  const colors: Record<PostStatus, string> = {
    scheduled: 'bg-amber-500',
    published: 'bg-sage-500',
    failed: 'bg-rose-600'
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]}`} title={`${count || 1} ${status}`} />
  );
};

