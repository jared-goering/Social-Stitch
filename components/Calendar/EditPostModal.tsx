import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Facebook, 
  Instagram, 
  Save, 
  CheckCircle,
  Images,
  GripVertical,
  Loader2
} from 'lucide-react';
import { ScheduledPost, SocialPlatform } from '../../types';
import { updateScheduledPost } from '../../services/scheduledPostsService';
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
  isOpen: boolean;
  post: ScheduledPost | null;
  onClose: () => void;
  onSaved: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Sortable thumbnail component for drag-and-drop reordering
interface SortableThumbnailProps {
  imageUrl: string;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const SortableThumbnail: React.FC<SortableThumbnailProps> = ({ imageUrl, index, isSelected, onSelect }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: imageUrl });

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
        src={imageUrl} 
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

export const EditPostModal: React.FC<Props> = ({
  isOpen,
  post,
  onClose,
  onSaved
}) => {
  // Form state
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [captions, setCaptions] = useState<{ facebook: string; instagram: string }>({ facebook: '', instagram: '' });
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [time, setTime] = useState('12:00');
  
  // UI state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'schedule'>('content');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize form state when post changes
  useEffect(() => {
    if (post && isOpen) {
      setImageUrls([...post.imageUrls]);
      setCaptions({
        facebook: post.captions.facebook || '',
        instagram: post.captions.instagram || ''
      });
      setPlatforms([...post.platforms]);
      setSelectedDate(new Date(post.scheduledFor));
      setTime(post.scheduledFor.toTimeString().slice(0, 5));
      setCurrentMonth(new Date(post.scheduledFor));
      setCurrentImageIndex(0);
      setIsSuccess(false);
      setActiveTab('content');
    }
  }, [post, isOpen]);

  if (!isOpen || !post) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isCarousel = imageUrls.length > 1;

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

  const handleDateSelect = (day: number) => {
    const date = new Date(year, month, day);
    if (date >= today) {
      setSelectedDate(date);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = imageUrls.findIndex(url => url === active.id);
      const newIndex = imageUrls.findIndex(url => url === over.id);
      
      const newOrder = arrayMove(imageUrls, oldIndex, newIndex);
      setImageUrls(newOrder);
      
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

  const togglePlatform = (platform: SocialPlatform) => {
    if (platforms.includes(platform)) {
      // Don't allow removing the last platform
      if (platforms.length > 1) {
        setPlatforms(platforms.filter(p => p !== platform));
      }
    } else {
      setPlatforms([...platforms, platform]);
    }
  };

  const getScheduledDateTime = (): Date => {
    const datetime = new Date(selectedDate);
    const [hours, minutes] = time.split(':').map(Number);
    datetime.setHours(hours, minutes, 0, 0);
    return datetime;
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      await updateScheduledPost(post.id, {
        imageUrls,
        captions,
        platforms,
        scheduledFor: getScheduledDateTime()
      });
      
      setIsSuccess(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to save:', error);
      setIsSaving(false);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Check if anything has changed
  const hasChanges = () => {
    const originalTime = post.scheduledFor.toTimeString().slice(0, 5);
    const originalDateStr = post.scheduledFor.toDateString();
    
    return (
      JSON.stringify(imageUrls) !== JSON.stringify(post.imageUrls) ||
      captions.facebook !== (post.captions.facebook || '') ||
      captions.instagram !== (post.captions.instagram || '') ||
      JSON.stringify(platforms.sort()) !== JSON.stringify([...post.platforms].sort()) ||
      time !== originalTime ||
      selectedDate.toDateString() !== originalDateStr
    );
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-display font-bold text-slate-900 mb-2">Changes Saved!</h3>
          <p className="text-slate-500 mb-4">
            Your post has been updated and will publish on<br />
            <span className="font-semibold text-slate-700">{formatDateTime(getScheduledDateTime())}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Save className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold">Edit Scheduled Post</h2>
                <p className="text-slate-300 text-sm">Modify your post before it publishes</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Tab navigation */}
          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={() => setActiveTab('content')}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === 'content' 
                  ? 'bg-white text-slate-800' 
                  : 'bg-white/10 text-white hover:bg-white/20'}
              `}
            >
              Content & Images
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === 'schedule' 
                  ? 'bg-white text-slate-800' 
                  : 'bg-white/10 text-white hover:bg-white/20'}
              `}
            >
              Schedule
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'content' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
              {/* Left: Image Preview */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Images className="w-4 h-4" />
                  Images {isCarousel && `(${imageUrls.length})`}
                </h3>
                
                {/* Main Image */}
                <div className="relative group rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[200px] max-h-[300px] mb-3">
                  <img 
                    src={imageUrls[currentImageIndex]} 
                    alt={`Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain max-h-[300px]"
                  />
                  
                  {/* Navigation Arrows */}
                  {isCarousel && (
                    <>
                      <button
                        onClick={() => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : imageUrls.length - 1))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/90 backdrop-blur-sm text-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-lg"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex(prev => (prev < imageUrls.length - 1 ? prev + 1 : 0))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white/90 backdrop-blur-sm text-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-lg"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}
                  
                  {/* Image counter */}
                  {isCarousel && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-white text-xs font-medium">
                      {currentImageIndex + 1} / {imageUrls.length}
                    </div>
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
                      items={imageUrls}
                      strategy={horizontalListSortingStrategy}
                    >
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1.5 flex items-center gap-1">
                          <GripVertical size={10} />
                          Drag to reorder
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {imageUrls.map((url, idx) => (
                            <SortableThumbnail
                              key={url}
                              imageUrl={url}
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

                {/* Platform Selection */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Platforms
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => togglePlatform('instagram')}
                      className={`
                        flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all font-medium
                        ${platforms.includes('instagram')
                          ? 'border-pink-400 bg-pink-50 text-pink-600'
                          : 'border-slate-200 text-slate-400 hover:border-slate-300'
                        }
                      `}
                    >
                      <Instagram size={18} />
                      Instagram
                    </button>
                    <button
                      onClick={() => togglePlatform('facebook')}
                      className={`
                        flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all font-medium
                        ${platforms.includes('facebook')
                          ? 'border-blue-400 bg-blue-50 text-blue-600'
                          : 'border-slate-200 text-slate-400 hover:border-slate-300'
                        }
                      `}
                    >
                      <Facebook size={18} />
                      Facebook
                    </button>
                  </div>
                  {platforms.length === 1 && (
                    <p className="text-xs text-slate-400 mt-2">At least one platform must be selected</p>
                  )}
                </div>
              </div>

              {/* Right: Caption Editor */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Captions
                </h3>
                
                {platforms.includes('instagram') && (
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                      <Instagram size={14} className="text-pink-500" />
                      Instagram Caption
                    </label>
                    <textarea
                      value={captions.instagram}
                      onChange={(e) => setCaptions(prev => ({ ...prev, instagram: e.target.value }))}
                      className="w-full h-32 p-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400 outline-none resize-none text-sm text-slate-800 leading-relaxed transition-all"
                      placeholder="Write your Instagram caption..."
                    />
                  </div>
                )}
                
                {platforms.includes('facebook') && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                      <Facebook size={14} className="text-blue-500" />
                      Facebook Caption
                    </label>
                    <textarea
                      value={captions.facebook}
                      onChange={(e) => setCaptions(prev => ({ ...prev, facebook: e.target.value }))}
                      className="w-full h-32 p-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-none text-sm text-slate-800 leading-relaxed transition-all"
                      placeholder="Write your Facebook caption..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="max-w-lg mx-auto animate-in fade-in duration-200">
              <div className="bg-indigo-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-indigo-600 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Currently scheduled for: {formatDateTime(post.scheduledFor)}
                </p>
              </div>
              
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCurrentMonth(new Date(year, month - 1))}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <h3 className="text-lg font-display font-semibold text-slate-800">
                  {MONTHS[month]} {year}
                </h3>
                <button
                  onClick={() => setCurrentMonth(new Date(year, month + 1))}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1 mb-6">
                {DAYS.map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-slate-400 py-2">
                    {day}
                  </div>
                ))}
                {Array.from({ length: startingDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(year, month, day);
                  const isPast = date < today;
                  const isSelected = selectedDate.getDate() === day && 
                                    selectedDate.getMonth() === month &&
                                    selectedDate.getFullYear() === year;
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <button
                      key={day}
                      onClick={() => handleDateSelect(day)}
                      disabled={isPast}
                      className={`
                        relative p-2 rounded-xl text-sm font-medium transition-all
                        ${isPast ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-indigo-50 cursor-pointer'}
                        ${isSelected ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                        ${isToday && !isSelected ? 'ring-2 ring-indigo-300 ring-inset' : ''}
                      `}
                    >
                      {day}
                      {isToday && !isSelected && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Time picker */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Time
                </label>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  />
                </div>
              </div>

              {/* New schedule preview */}
              {(selectedDate.toDateString() !== post.scheduledFor.toDateString() || time !== post.scheduledFor.toTimeString().slice(0, 5)) && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-sm text-emerald-600 font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    New schedule: {formatDateTime(getScheduledDateTime())}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-slate-500">
            {hasChanges() ? (
              <span className="text-amber-600 font-medium">You have unsaved changes</span>
            ) : (
              <span>No changes made</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges()}
              className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



