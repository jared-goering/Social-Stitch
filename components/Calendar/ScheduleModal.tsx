import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, ChevronLeft, ChevronRight, Facebook, Instagram, Send, Sparkles, CheckCircle } from 'lucide-react';
import { SocialPlatform, MockupOption, ScheduledPost } from '../../types';
import { subscribeToScheduledPosts, groupPostsByDate, getLocalDateKey } from '../../services/scheduledPostsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (date: Date, platforms: SocialPlatform[]) => Promise<void>;
  platforms: SocialPlatform[];
  mockups: MockupOption[];
  captions: { facebook: string; instagram: string };
}

// Suggested optimal posting times based on social media best practices
const SUGGESTED_TIMES = [
  { hour: 9, minute: 0, label: '9:00 AM', reason: 'Morning engagement peak' },
  { hour: 12, minute: 0, label: '12:00 PM', reason: 'Lunch break browsing' },
  { hour: 17, minute: 0, label: '5:00 PM', reason: 'End of workday' },
  { hour: 19, minute: 0, label: '7:00 PM', reason: 'Evening prime time' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const ScheduleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSchedule,
  platforms,
  mockups,
  captions
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<{ hour: number; minute: number } | null>(null);
  const [customTime, setCustomTime] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState<'date' | 'time' | 'confirm'>('date');
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(null);
      setSelectedTime(null);
      setCustomTime('');
      setCurrentMonth(new Date());
      setIsScheduling(false);
      setIsSuccess(false);
      setStep('date');
    }
  }, [isOpen]);

  // Subscribe to scheduled posts to show on calendar
  useEffect(() => {
    if (!isOpen) return;
    
    const unsubscribe = subscribeToScheduledPosts((posts) => {
      setScheduledPosts(posts);
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  // Group posts by date for display
  const postsByDate = groupPostsByDate(scheduledPosts);
  
  // Get posts for a specific day
  const getPostsForDay = (day: number): ScheduledPost[] => {
    const dateKey = getLocalDateKey(new Date(year, month, day));
    return postsByDate.get(dateKey) || [];
  };

  const handleDateSelect = (day: number) => {
    const date = new Date(year, month, day);
    if (date >= today) {
      setSelectedDate(date);
      setStep('time');
    }
  };

  const handleTimeSelect = (hour: number, minute: number) => {
    setSelectedTime({ hour, minute });
    setCustomTime('');
  };

  const handleCustomTimeChange = (value: string) => {
    setCustomTime(value);
    setSelectedTime(null);
  };

  const parseCustomTime = (): { hour: number; minute: number } | null => {
    if (!customTime) return null;
    const [hours, minutes] = customTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return { hour: hours, minute: minutes };
  };

  const getScheduledDateTime = (): Date | null => {
    if (!selectedDate) return null;
    const time = selectedTime || parseCustomTime();
    if (!time) return null;
    
    const datetime = new Date(selectedDate);
    datetime.setHours(time.hour, time.minute, 0, 0);
    return datetime;
  };

  const handleConfirm = () => {
    if (getScheduledDateTime()) {
      setStep('confirm');
    }
  };

  const handleSchedule = async () => {
    const datetime = getScheduledDateTime();
    if (!datetime) return;
    
    setIsScheduling(true);
    try {
      await onSchedule(datetime, platforms);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to schedule:', error);
      setIsScheduling(false);
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

  // Success state
  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-display font-bold text-slate-900 mb-2">Scheduled!</h3>
          <p className="text-slate-500 mb-4">
            Your post will be published on<br />
            <span className="font-semibold text-slate-700">{formatDateTime(getScheduledDateTime()!)}</span>
          </p>
          <button
            onClick={onClose}
            className="text-indigo-600 font-medium flex items-center gap-2 mx-auto hover:text-indigo-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            View in Calendar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold">Schedule Post</h2>
                <p className="text-indigo-200 text-sm">Choose when to publish</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress steps */}
          <div className="flex items-center gap-2 mt-5">
            {['date', 'time', 'confirm'].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                  ${step === s ? 'bg-white text-indigo-600' : 
                    ['date', 'time', 'confirm'].indexOf(step) > i ? 'bg-white/30 text-white' : 'bg-white/10 text-indigo-200'}
                `}>
                  <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                    {i + 1}
                  </span>
                  <span className="capitalize">{s}</span>
                </div>
                {i < 2 && <div className="flex-1 h-0.5 bg-white/20 rounded" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Date Selection */}
          {step === 'date' && (
            <div className="animate-in fade-in duration-200">
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
              <div className="grid grid-cols-7 gap-1 mb-4">
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
                  const isSelected = selectedDate?.getDate() === day && 
                                    selectedDate?.getMonth() === month &&
                                    selectedDate?.getFullYear() === year;
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dayPosts = getPostsForDay(day);
                  const scheduledCount = dayPosts.filter(p => p.status === 'scheduled').length;
                  const publishedCount = dayPosts.filter(p => p.status === 'published').length;
                  
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
                      {/* Post indicators */}
                      {dayPosts.length > 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                          {scheduledCount > 0 && (
                            <div 
                              className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-amber-500'}`}
                              title={`${scheduledCount} scheduled`}
                            />
                          )}
                          {publishedCount > 0 && (
                            <div 
                              className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`}
                              title={`${publishedCount} published`}
                            />
                          )}
                        </div>
                      )}
                      {/* Today indicator (only show if no posts) */}
                      {isToday && !isSelected && dayPosts.length === 0 && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              {scheduledPosts.length > 0 && (
                <div className="flex items-center justify-center gap-4 mb-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-500">Scheduled</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500">Published</span>
                  </div>
                </div>
              )}

              {selectedDate && (
                <button
                  onClick={() => setStep('time')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25"
                >
                  Continue to Time Selection
                </button>
              )}
            </div>
          )}

          {/* Time Selection */}
          {step === 'time' && (
            <div className="animate-in fade-in duration-200">
              <button
                onClick={() => setStep('date')}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to date
              </button>

              <div className="bg-indigo-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-indigo-600 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Suggested Times
              </h4>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {SUGGESTED_TIMES.map((time) => {
                  const isSelected = selectedTime?.hour === time.hour && selectedTime?.minute === time.minute;
                  return (
                    <button
                      key={time.label}
                      onClick={() => handleTimeSelect(time.hour, time.minute)}
                      className={`
                        time-slot p-4 rounded-xl border-2 text-left
                        ${isSelected 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className={`font-semibold ${isSelected ? 'text-indigo-600' : 'text-slate-700'}`}>
                          {time.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{time.reason}</p>
                    </button>
                  );
                })}
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-slate-400">or choose custom time</span>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-5 h-5 text-slate-400" />
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => handleCustomTimeChange(e.target.value)}
                  className={`
                    flex-1 px-4 py-3 rounded-xl border-2 outline-none transition-all
                    ${customTime ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 focus:border-indigo-400'}
                  `}
                />
              </div>

              <button
                onClick={handleConfirm}
                disabled={!selectedTime && !customTime}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review & Confirm
              </button>
            </div>
          )}

          {/* Confirmation */}
          {step === 'confirm' && (
            <div className="animate-in fade-in duration-200">
              <button
                onClick={() => setStep('time')}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to time
              </button>

              {/* Schedule summary */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 mb-6 border border-indigo-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Scheduled for</p>
                    <p className="text-lg font-display font-bold text-slate-800">
                      {formatDateTime(getScheduledDateTime()!)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Platforms */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-sm text-slate-500">Posting to:</span>
                <div className="flex items-center gap-2">
                  {platforms.includes('instagram') && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 rounded-full">
                      <Instagram className="w-4 h-4 text-pink-600" />
                      <span className="text-sm font-medium text-pink-600">Instagram</span>
                    </div>
                  )}
                  {platforms.includes('facebook') && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full">
                      <Facebook className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-600">Facebook</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <div className="flex gap-4">
                  {mockups[0] && (
                    <img 
                      src={mockups[0].imageUrl} 
                      alt="Preview" 
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-600 line-clamp-3">
                      {captions.instagram || captions.facebook}
                    </p>
                    {mockups.length > 1 && (
                      <p className="text-xs text-slate-400 mt-2">
                        +{mockups.length - 1} more image{mockups.length > 2 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSchedule}
                disabled={isScheduling}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isScheduling ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Schedule Post
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

