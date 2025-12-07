import React, { useState, useEffect } from 'react';
import { ScheduledPost, PostStatus } from '../../types';
import { 
  subscribeToScheduledPosts, 
  deleteScheduledPost, 
  reschedulePost,
  retryFailedPost,
  groupPostsByDate,
  getLocalDateKey
} from '../../services/scheduledPostsService';
import { PostCard, PostStatusDot } from './PostCard';
import { EditPostModal } from './EditPostModal';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  X,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  CalendarClock,
  Trash2
} from 'lucide-react';

interface Props {
  onCreatePost?: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type FilterStatus = 'all' | PostStatus;

export const CalendarView: React.FC<Props> = ({ onCreatePost }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showRescheduleModal, setShowRescheduleModal] = useState<ScheduledPost | null>(null);
  const [showRetryModal, setShowRetryModal] = useState<ScheduledPost | null>(null);
  const [showEditModal, setShowEditModal] = useState<ScheduledPost | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<ScheduledPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Subscribe to real-time updates
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToScheduledPosts((updatedPosts) => {
      setPosts(updatedPosts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay, year, month };
  };

  const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentMonth);

  // Group posts by date
  const postsByDate = groupPostsByDate(posts);

  // Filter posts
  const filteredPosts = filter === 'all' 
    ? posts 
    : posts.filter(p => p.status === filter);

  // Get posts for a specific day
  const getPostsForDay = (day: number): ScheduledPost[] => {
    const dateKey = getLocalDateKey(new Date(year, month, day));
    const dayPosts = postsByDate.get(dateKey) || [];
    return filter === 'all' ? dayPosts : dayPosts.filter(p => p.status === filter);
  };

  // Get posts for selected date
  const selectedDatePosts = selectedDate 
    ? getPostsForDay(selectedDate.getDate())
    : [];

  // Status counts
  const statusCounts = posts.reduce(
    (acc, post) => {
      acc[post.status]++;
      return acc;
    },
    { scheduled: 0, published: 0, failed: 0 } as Record<PostStatus, number>
  );

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1));
    setSelectedDate(null);
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(year, month, day);
    if (selectedDate?.getTime() === clickedDate.getTime()) {
      setSelectedDate(null);
    } else {
      setSelectedDate(clickedDate);
    }
  };

  const handleDelete = (post: ScheduledPost) => {
    setShowDeleteModal(post);
  };

  const confirmDelete = async () => {
    if (!showDeleteModal) return;
    setDeleting(true);
    try {
      await deleteScheduledPost(showDeleteModal.id);
      setShowDeleteModal(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleReschedule = (post: ScheduledPost) => {
    setShowRescheduleModal(post);
  };

  const handleRetry = (post: ScheduledPost) => {
    setShowRetryModal(post);
  };

  const handleEdit = (post: ScheduledPost) => {
    setShowEditModal(post);
  };

  const handleRetryNow = async (post: ScheduledPost) => {
    // Schedule for 30 seconds from now so scheduler picks it up immediately
    await retryFailedPost(post.id, new Date(Date.now() + 30000));
    setShowRetryModal(null);
  };

  const handleRetryScheduled = async (post: ScheduledPost, scheduledTime: Date) => {
    await retryFailedPost(post.id, scheduledTime);
    setShowRetryModal(null);
  };

  const handleAccountConnected = () => {
    // Force a refresh - the real-time subscription should handle this
    // but show a toast/notification that account was connected
    console.log('Account connected! You can now retry failed posts.');
  };

  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-display text-slate-warm-900 mb-2">Content Calendar</h1>
            <p className="text-slate-warm-500">Manage your scheduled posts and publishing history</p>
          </div>
          
          {onCreatePost && (
            <button
              onClick={onCreatePost}
              className="btn-primary text-white px-5 py-3 rounded-xl font-semibold inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Create Post
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setFilter(filter === 'scheduled' ? 'all' : 'scheduled')}
            className={`
              p-4 rounded-2xl border-2 transition-all
              ${filter === 'scheduled' 
                ? 'border-amber-400 bg-amber-50' 
                : 'border-slate-warm-200 bg-white hover:border-slate-warm-300'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${filter === 'scheduled' ? 'bg-amber-500' : 'bg-amber-100'}`}>
                <Clock size={18} className={filter === 'scheduled' ? 'text-white' : 'text-amber-600'} />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-slate-warm-800">{statusCounts.scheduled}</p>
                <p className="text-xs text-slate-warm-500 font-medium">Scheduled</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilter(filter === 'published' ? 'all' : 'published')}
            className={`
              p-4 rounded-2xl border-2 transition-all
              ${filter === 'published' 
                ? 'border-sage-400 bg-sage-50' 
                : 'border-slate-warm-200 bg-white hover:border-slate-warm-300'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${filter === 'published' ? 'bg-sage-500' : 'bg-sage-100'}`}>
                <CheckCircle size={18} className={filter === 'published' ? 'text-white' : 'text-sage-600'} />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-slate-warm-800">{statusCounts.published}</p>
                <p className="text-xs text-slate-warm-500 font-medium">Published</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFilter(filter === 'failed' ? 'all' : 'failed')}
            className={`
              p-4 rounded-2xl border-2 transition-all
              ${filter === 'failed' 
                ? 'border-rose-400 bg-rose-50' 
                : 'border-slate-warm-200 bg-white hover:border-slate-warm-300'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${filter === 'failed' ? 'bg-rose-600' : 'bg-rose-100'}`}>
                <AlertCircle size={18} className={filter === 'failed' ? 'text-white' : 'text-rose-600'} />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-slate-warm-800">{statusCounts.failed}</p>
                <p className="text-xs text-slate-warm-500 font-medium">Failed</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card-elevated p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handlePrevMonth}
              className="p-2.5 rounded-xl hover:bg-slate-warm-100 transition-colors border border-transparent hover:border-slate-warm-200"
            >
              <ChevronLeft size={20} className="text-slate-warm-600" />
            </button>
            
            <h2 className="text-xl font-display text-slate-warm-800">
              {MONTHS[month]} {year}
            </h2>
            
            <button
              onClick={handleNextMonth}
              className="p-2.5 rounded-xl hover:bg-slate-warm-100 transition-colors border border-transparent hover:border-slate-warm-200"
            >
              <ChevronRight size={20} className="text-slate-warm-600" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-warm-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-coral-500 mx-auto mb-3" />
                <p className="text-sm text-slate-warm-500">Loading your posts...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 calendar-grid">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startingDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              
                {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPosts = getPostsForDay(day);
                const isToday = isCurrentMonth && today.getDate() === day;
                const isSelected = selectedDate?.getDate() === day && 
                                  selectedDate?.getMonth() === month &&
                                  selectedDate?.getFullYear() === year;
                const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                
                // Get unique statuses for this day
                const dayStatuses = [...new Set(dayPosts.map(p => p.status))];
                
                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    style={{ animationDelay: `${i * 15}ms` }}
                    className={`
                      calendar-day relative aspect-square p-1 rounded-xl flex flex-col items-center justify-start pt-2
                      ${isSelected 
                        ? 'bg-slate-warm-700 text-white shadow-lg shadow-slate-warm-700/30 scale-105' 
                        : isToday 
                          ? 'bg-coral-50 text-coral-600 ring-2 ring-coral-300'
                          : isPast
                            ? 'text-slate-warm-300 hover:bg-slate-warm-50 cursor-default'
                            : 'text-slate-warm-700 hover:bg-slate-warm-100'
                      }
                    `}
                  >
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : ''}`}>
                      {day}
                    </span>
                    
                    {/* Post indicators */}
                    {dayPosts.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-1">
                        {dayStatuses.slice(0, 3).map((status, idx) => (
                          <PostStatusDot 
                            key={idx} 
                            status={status} 
                            count={dayPosts.filter(p => p.status === status).length}
                          />
                        ))}
                        {dayPosts.length > 3 && (
                          <span className={`text-[8px] ml-0.5 ${isSelected ? 'text-slate-warm-300' : 'text-slate-warm-400'}`}>
                            +{dayPosts.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-slate-warm-100">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-warm-500">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-sage-500" />
              <span className="text-xs text-slate-warm-500">Published</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-600" />
              <span className="text-xs text-slate-warm-500">Failed</span>
            </div>
          </div>
        </div>

        {/* Day Detail Panel */}
        <div className="lg:col-span-1">
          <div className="card-elevated p-5 sticky top-24">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-slate-warm-800">
                      {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                    </h3>
                    <p className="text-sm text-slate-warm-500">
                      {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="p-2 rounded-xl hover:bg-slate-warm-100 text-slate-warm-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {selectedDatePosts.length > 0 ? (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {selectedDatePosts
                      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())
                      .map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          compact
                          onDelete={handleDelete}
                          onReschedule={post.status === 'scheduled' ? handleReschedule : undefined}
                          onRetry={post.status === 'failed' ? handleRetry : undefined}
                          onEdit={post.status === 'scheduled' ? handleEdit : undefined}
                          onAccountConnected={handleAccountConnected}
                        />
                      ))
                    }
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-warm-100 flex items-center justify-center mx-auto mb-4">
                      <CalendarIcon size={22} className="text-slate-warm-400" />
                    </div>
                    <p className="text-sm text-slate-warm-600 mb-4">No posts scheduled for this day</p>
                    {onCreatePost && new Date(selectedDate) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) && (
                      <button
                        onClick={onCreatePost}
                        className="text-sm font-medium text-coral-500 hover:text-coral-600 flex items-center gap-1 mx-auto transition-colors"
                      >
                        <Plus size={14} />
                        Create a post
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-coral-50 flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon size={22} className="text-coral-500" />
                </div>
                <p className="text-sm font-medium text-slate-warm-700 mb-1">Select a day</p>
                <p className="text-xs text-slate-warm-500">Click on a day to see scheduled posts</p>
              </div>
            )}
          </div>

          {/* Upcoming Posts */}
          {!selectedDate && filteredPosts.filter(p => p.status === 'scheduled').length > 0 && (
            <div className="mt-4 card-elevated p-5">
              <h3 className="font-display text-slate-warm-800 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-coral-500" />
                Upcoming
              </h3>
              <div className="space-y-3">
                {filteredPosts
                  .filter(p => p.status === 'scheduled')
                  .slice(0, 5)
                  .map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      compact
                      onDelete={handleDelete}
                      onReschedule={handleReschedule}
                      onEdit={handleEdit}
                      onAccountConnected={handleAccountConnected}
                    />
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <RescheduleModal
          post={showRescheduleModal}
          onClose={() => setShowRescheduleModal(null)}
          onReschedule={async (newDate) => {
            await reschedulePost(showRescheduleModal.id, newDate);
            setShowRescheduleModal(null);
          }}
        />
      )}

      {/* Retry Modal */}
      {showRetryModal && (
        <RetryModal
          post={showRetryModal}
          onClose={() => setShowRetryModal(null)}
          onPostNow={() => handleRetryNow(showRetryModal)}
          onSchedule={(date) => handleRetryScheduled(showRetryModal, date)}
        />
      )}

      {/* Edit Modal */}
      <EditPostModal
        isOpen={showEditModal !== null}
        post={showEditModal}
        onClose={() => setShowEditModal(null)}
        onSaved={() => setShowEditModal(null)}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          post={showDeleteModal}
          onClose={() => setShowDeleteModal(null)}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
};

// Simple reschedule modal
const RescheduleModal: React.FC<{
  post: ScheduledPost;
  onClose: () => void;
  onReschedule: (date: Date) => Promise<void>;
}> = ({ post, onClose, onReschedule }) => {
  const [date, setDate] = useState(post.scheduledFor.toISOString().split('T')[0]);
  const [time, setTime] = useState(
    post.scheduledFor.toTimeString().slice(0, 5)
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const newDate = new Date(`${date}T${time}`);
    if (newDate <= new Date()) {
      alert('Please select a future date and time');
      return;
    }
    
    setLoading(true);
    try {
      await onReschedule(newDate);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-warm-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 modal-content">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-display text-slate-warm-900">Reschedule Post</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-warm-100 text-slate-warm-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-warm-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-warm-200 focus:border-coral-400 focus:ring-2 focus:ring-coral-100 outline-none transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-warm-700 mb-2">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-warm-200 focus:border-coral-400 focus:ring-2 focus:ring-coral-100 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-medium text-slate-warm-700 bg-slate-warm-100 hover:bg-slate-warm-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-medium text-white btn-primary disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Reschedule'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Retry modal with Post Now vs Schedule options
const RetryModal: React.FC<{
  post: ScheduledPost;
  onClose: () => void;
  onPostNow: () => Promise<void>;
  onSchedule: (date: Date) => Promise<void>;
}> = ({ post, onClose, onPostNow, onSchedule }) => {
  const [mode, setMode] = useState<'choose' | 'schedule'>('choose');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(
    new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5) // 1 hour from now
  );
  const [loading, setLoading] = useState(false);

  const handlePostNow = async () => {
    setLoading(true);
    try {
      await onPostNow();
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    const newDate = new Date(`${date}T${time}`);
    if (newDate <= new Date()) {
      alert('Please select a future date and time');
      return;
    }
    
    setLoading(true);
    try {
      await onSchedule(newDate);
    } finally {
      setLoading(false);
    }
  };

  // Preview of the post
  const caption = post.captions.instagram || post.captions.facebook || '';
  const previewCaption = caption.length > 80 ? caption.slice(0, 80) + '...' : caption;

  return (
    <div className="fixed inset-0 bg-slate-warm-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 modal-content">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-display text-slate-warm-900">Retry Post</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-warm-100 text-slate-warm-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Post preview */}
        <div className="flex items-start gap-3 p-4 bg-slate-warm-50 rounded-2xl mb-6">
          {post.imageUrls[0] && (
            <img 
              src={post.imageUrls[0]} 
              alt="Post preview" 
              className="w-16 h-16 rounded-xl object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-warm-700 line-clamp-2">{previewCaption}</p>
            <div className="flex items-center gap-2 mt-2">
              {post.platforms.map(p => (
                <span key={p} className={`text-xs px-2 py-1 rounded-lg font-medium ${
                  p === 'instagram' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {p === 'instagram' ? 'Instagram' : 'Facebook'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {mode === 'choose' ? (
          <div className="space-y-3">
            <button
              onClick={handlePostNow}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-sage-200 bg-sage-50 hover:bg-sage-100 hover:border-sage-300 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-sage-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                {loading ? (
                  <Loader2 size={22} className="text-white animate-spin" />
                ) : (
                  <Zap size={22} className="text-white" />
                )}
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-warm-800">Post Now</p>
                <p className="text-xs text-slate-warm-500">Publish immediately</p>
              </div>
            </button>

            <button
              onClick={() => setMode('schedule')}
              disabled={loading}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-warm-200 hover:bg-slate-warm-50 hover:border-slate-warm-300 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-coral-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CalendarClock size={22} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-warm-800">Schedule for Later</p>
                <p className="text-xs text-slate-warm-500">Pick a specific date and time</p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setMode('choose')}
              className="text-sm text-coral-500 hover:text-coral-600 flex items-center gap-1 mb-2 font-medium transition-colors"
            >
              ← Back to options
            </button>
            
            <div>
              <label className="block text-sm font-medium text-slate-warm-700 mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-warm-200 focus:border-coral-400 focus:ring-2 focus:ring-coral-100 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-warm-700 mb-2">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-warm-200 focus:border-coral-400 focus:ring-2 focus:ring-coral-100 outline-none transition-all"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-medium text-slate-warm-700 bg-slate-warm-100 hover:bg-slate-warm-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-medium text-white btn-primary disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule'
                )}
              </button>
            </div>
          </div>
        )}

        {mode === 'choose' && (
          <button
            onClick={onClose}
            className="w-full mt-4 py-3 rounded-xl font-medium text-slate-warm-500 hover:text-slate-warm-700 hover:bg-slate-warm-100 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

// Delete confirmation modal
const DeleteConfirmModal: React.FC<{
  post: ScheduledPost;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  deleting: boolean;
}> = ({ post, onClose, onConfirm, deleting }) => {
  const caption = post.captions.instagram || post.captions.facebook || '';
  const previewCaption = caption.length > 100 ? caption.slice(0, 100) + '...' : caption;

  return (
    <div className="fixed inset-0 bg-slate-warm-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden modal-content">
        {/* Header with warning styling */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100 px-6 py-5 border-b border-rose-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <AlertCircle size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-display text-slate-warm-900">Delete Post</h3>
              <p className="text-sm text-rose-600">This action cannot be undone</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Post preview */}
          <div className="flex items-start gap-4 p-4 bg-slate-warm-50 rounded-2xl mb-6">
            {post.imageUrls[0] && (
              <img 
                src={post.imageUrls[0]} 
                alt="Post preview" 
                className="w-20 h-20 rounded-xl object-cover flex-shrink-0 shadow-md"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-warm-700 line-clamp-3 leading-relaxed">{previewCaption}</p>
              <div className="flex items-center gap-2 mt-3">
                {post.platforms.map(p => (
                  <span key={p} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                    p === 'instagram' 
                      ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-pink-600' 
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {p === 'instagram' ? 'Instagram' : 'Facebook'}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Warning message */}
          <p className="text-sm text-slate-warm-600 text-center mb-6">
            Are you sure you want to delete this scheduled post? 
            {post.status === 'scheduled' && (
              <span className="block mt-1 text-slate-warm-500">
                It will be removed and won't be published.
              </span>
            )}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl font-medium text-slate-warm-700 bg-slate-warm-100 hover:bg-slate-warm-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl font-medium text-white bg-rose-500 hover:bg-rose-600 transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/30 hover:shadow-rose-500/40"
            >
              {deleting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Delete Post
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

