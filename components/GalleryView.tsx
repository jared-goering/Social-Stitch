import React, { useState, useEffect } from 'react';
import { ref, getBlob } from 'firebase/storage';
import { SavedMockup } from '../types';
import { fetchUserMockups, deleteMockupFromFirebase } from '../services/mockupStorageService';
import { storage, auth } from '../services/firebaseConfig';
import { 
  Download, 
  Trash2, 
  Loader2, 
  ImageIcon, 
  Calendar,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Props {
  onCreatePost?: () => void;
}

export const GalleryView: React.FC<Props> = ({ onCreatePost }) => {
  const [mockups, setMockups] = useState<SavedMockup[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedMockup, setSelectedMockup] = useState<SavedMockup | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch mockups on mount
  useEffect(() => {
    loadMockups();
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadMockups = async () => {
    setLoading(true);
    try {
      const data = await fetchUserMockups();
      setMockups(data);
    } catch (error) {
      console.error('Failed to load mockups:', error);
      setToast({ message: 'Failed to load images', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (mockup: SavedMockup, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    setDownloadingIds(prev => new Set(prev).add(mockup.id));
    
    try {
      // Get the current user's ID to construct the storage path
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('Not authenticated');
      }
      
      // Use Firebase's getBlob to download (bypasses CORS issues)
      const storageRef = ref(storage, `mockups/${userId}/${mockup.id}.png`);
      const blob = await getBlob(storageRef);
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename from style description
      const sanitizedName = mockup.styleDescription
        .slice(0, 30)
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
      link.download = `mockup_${sanitizedName}_${mockup.id.slice(0, 8)}.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setToast({ message: 'Image downloaded successfully', type: 'success' });
    } catch (error) {
      console.error('Download failed:', error);
      setToast({ message: 'Failed to download image', type: 'error' });
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(mockup.id);
        return next;
      });
    }
  };

  const handleDelete = async (mockup: SavedMockup, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this image? This cannot be undone.')) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(mockup.id));
    
    try {
      await deleteMockupFromFirebase(mockup.id);
      setMockups(prev => prev.filter(m => m.id !== mockup.id));
      setToast({ message: 'Image deleted successfully', type: 'success' });
      
      if (selectedMockup?.id === mockup.id) {
        setSelectedMockup(null);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      setToast({ message: 'Failed to delete image', type: 'error' });
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(mockup.id);
        return next;
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`
            flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg
            ${toast.type === 'success' 
              ? 'bg-emerald-500 text-white' 
              : 'bg-rose-500 text-white'
            }
          `}>
            {toast.type === 'success' ? (
              <CheckCircle size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Image Gallery</h1>
            <p className="text-slate-500">Browse and download your generated mockups</p>
          </div>
          
          {onCreatePost && (
            <button
              onClick={onCreatePost}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all"
            >
              <ImageIcon size={18} />
              Create Mockup
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-2xl font-bold text-slate-900">{mockups.length}</span>
            <span className="text-sm text-slate-500 ml-2">
              {mockups.length === 1 ? 'Image' : 'Images'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
            <p className="text-slate-500">Loading your images...</p>
          </div>
        </div>
      ) : mockups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
            <ImageIcon size={40} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-display font-bold text-slate-700 mb-2">No images yet</h3>
          <p className="text-slate-500 mb-6 text-center max-w-md">
            Generated mockups will appear here. Create your first post to get started!
          </p>
          {onCreatePost && (
            <button
              onClick={onCreatePost}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all"
            >
              <ImageIcon size={18} />
              Create Your First Mockup
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {mockups.map((mockup, index) => (
            <div
              key={mockup.id}
              onClick={() => setSelectedMockup(mockup)}
              style={{ animationDelay: `${index * 50}ms` }}
              className="group bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
            >
              {/* Image */}
              <div className="relative aspect-square bg-slate-100 overflow-hidden">
                <img
                  src={mockup.imageUrl}
                  alt={mockup.styleDescription}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => handleDownload(mockup, e)}
                      disabled={downloadingIds.has(mockup.id)}
                      className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-white hover:text-indigo-600 transition-colors shadow-lg disabled:opacity-70"
                      title="Download"
                    >
                      {downloadingIds.has(mockup.id) ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Download size={18} />
                      )}
                    </button>
                    <button
                      onClick={(e) => handleDelete(mockup, e)}
                      disabled={deletingIds.has(mockup.id)}
                      className="p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-rose-500 hover:text-white transition-colors shadow-lg disabled:opacity-70"
                      title="Delete"
                    >
                      {deletingIds.has(mockup.id) ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="text-sm font-medium text-slate-700 line-clamp-2 mb-2 min-h-[2.5rem]">
                  {mockup.styleDescription}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar size={12} />
                  <span>{formatDate(mockup.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedMockup && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedMockup(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedMockup(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Image */}
            <div className="relative bg-slate-900 flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={selectedMockup.imageUrl}
                alt={selectedMockup.styleDescription}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>

            {/* Details */}
            <div className="p-6 bg-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-display font-bold text-slate-900 mb-2">
                    {selectedMockup.styleDescription}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Calendar size={14} />
                    <span>{formatDate(selectedMockup.createdAt)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(selectedMockup)}
                    disabled={downloadingIds.has(selectedMockup.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-70"
                  >
                    {downloadingIds.has(selectedMockup.id) ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedMockup)}
                    disabled={deletingIds.has(selectedMockup.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-70"
                  >
                    {deletingIds.has(selectedMockup.id) ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

