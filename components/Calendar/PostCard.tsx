import React from 'react';
import { ScheduledPost, PostStatus } from '../../types';
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
  Images
} from 'lucide-react';

interface Props {
  post: ScheduledPost;
  onReschedule?: (post: ScheduledPost) => void;
  onDelete?: (post: ScheduledPost) => void;
  onRetry?: (post: ScheduledPost) => void;
  compact?: boolean;
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
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    iconColor: 'text-indigo-500'
  },
  published: {
    icon: CheckCircle,
    label: 'Published',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    iconColor: 'text-emerald-500'
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    iconColor: 'text-rose-500'
  }
};

export const PostCard: React.FC<Props> = ({ 
  post, 
  onReschedule, 
  onDelete, 
  onRetry,
  compact = false 
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const statusConfig = STATUS_CONFIG[post.status];
  const StatusIcon = statusConfig.icon;

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
        </div>

        {/* Quick actions on hover */}
        {(onReschedule || onDelete || onRetry) && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
              <div className="absolute right-2 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 min-w-[140px]">
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
          
          {(onReschedule || onDelete || onRetry) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-10 min-w-[160px]">
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
          <div className="mt-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
            <p className="text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              {post.error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Status dot component for calendar grid
export const PostStatusDot: React.FC<{ status: PostStatus; count?: number }> = ({ status, count }) => {
  const colors: Record<PostStatus, string> = {
    scheduled: 'bg-indigo-500',
    published: 'bg-emerald-500',
    failed: 'bg-rose-500'
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]}`} title={`${count || 1} ${status}`} />
  );
};

