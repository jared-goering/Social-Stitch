import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ref, getBlob } from 'firebase/storage';
import { SavedMockup } from '../types';
import { fetchUserMockups, deleteMockupFromFirebase } from '../services/mockupStorageService';
import { addProductImage, getSessionToken } from '../services/shopifyProductService';
import { storage, auth } from '../services/firebaseConfig';
import { 
  Download, 
  Trash2, 
  Loader2, 
  ImageIcon, 
  Calendar,
  X,
  CheckCircle,
  AlertCircle,
  Sparkles,
  SortAsc,
  SortDesc,
  Filter,
  Grid,
  LayoutGrid,
  Clock,
  Plus,
  Package,
  Upload,
} from 'lucide-react';

interface Props {
  onCreatePost?: () => void;
}

type SortOption = 'newest' | 'oldest';
type FilterOption = 'all' | 'today' | 'week' | 'month';

export const GalleryView: React.FC<Props> = ({ onCreatePost }) => {
  const [mockups, setMockups] = useState<SavedMockup[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [addingToProductIds, setAddingToProductIds] = useState<Set<string>>(new Set());
  const [selectedMockup, setSelectedMockup] = useState<SavedMockup | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filtering and sorting state
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Check if we're in Shopify context (has session token)
  const isShopifyContext = !!getSessionToken();

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

  // Filtered and sorted mockups
  const processedMockups = useMemo(() => {
    let result = [...mockups];

    // Apply date filter
    if (filterBy !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filterBy) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      result = result.filter(m => m.createdAt >= filterDate);
    }

    // Apply sorting
    result.sort((a, b) => {
      const dateA = a.createdAt.getTime();
      const dateB = b.createdAt.getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [mockups, sortBy, filterBy]);

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

  const handleAddToProduct = async (mockup: SavedMockup, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    if (!mockup.sourceProduct) {
      setToast({ message: 'No source product linked to this mockup', type: 'error' });
      return;
    }

    setAddingToProductIds(prev => new Set(prev).add(mockup.id));
    
    try {
      await addProductImage({
        productId: mockup.sourceProduct.id,
        imageUrl: mockup.imageUrl,
        alt: `AI-generated mockup: ${mockup.styleDescription.slice(0, 100)}`,
      });
      
      setToast({ message: `Image added to "${mockup.sourceProduct.title}"`, type: 'success' });
    } catch (error) {
      console.error('Failed to add image to product:', error);
      setToast({ message: 'Failed to add image to product', type: 'error' });
    } finally {
      setAddingToProductIds(prev => {
        const next = new Set(prev);
        next.delete(mockup.id);
        return next;
      });
    }
  };

  const filterLabels: Record<FilterOption, string> = {
    all: 'All Time',
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
  };

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className={`
            flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg
            ${toast.type === 'success' 
              ? 'bg-sage-500 text-white' 
              : 'bg-coral-500 text-white'
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
            <h1 className="text-3xl md:text-4xl font-display text-slate-warm-900 mb-2">Image Gallery</h1>
            <p className="text-slate-warm-500">Browse and download your AI-generated mockups</p>
          </div>
          
          {onCreatePost && (
            <button
              onClick={onCreatePost}
              className="btn-primary text-white px-5 py-3 rounded-xl font-semibold inline-flex items-center gap-2"
            >
              <Sparkles size={18} />
              Create Mockup
            </button>
          )}
        </div>

        {/* Stats and Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="card-elevated px-5 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-coral-100 flex items-center justify-center">
                <ImageIcon size={18} className="text-coral-500" />
              </div>
              <div>
                <span className="text-2xl font-bold text-slate-warm-800">{processedMockups.length}</span>
                <span className="text-sm text-slate-warm-500 ml-2">
                  {processedMockups.length === 1 ? 'Image' : 'Images'}
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                  filterBy !== 'all' 
                    ? 'border-coral-300 bg-coral-50 text-coral-600' 
                    : 'border-slate-warm-200 bg-white text-slate-warm-600 hover:border-slate-warm-300'
                }`}
              >
                <Filter size={16} />
                {filterLabels[filterBy]}
              </button>
              
              {showFilters && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-warm-200 shadow-xl z-10 overflow-hidden modal-content">
                  {(Object.keys(filterLabels) as FilterOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setFilterBy(option);
                        setShowFilters(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
                        filterBy === option 
                          ? 'bg-coral-50 text-coral-600 font-medium' 
                          : 'text-slate-warm-600 hover:bg-slate-warm-50'
                      }`}
                    >
                      {filterLabels[option]}
                      {filterBy === option && <CheckCircle size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-warm-200 bg-white text-slate-warm-600 hover:border-slate-warm-300 transition-all text-sm font-medium"
            >
              {sortBy === 'newest' ? (
                <>
                  <SortDesc size={16} />
                  Newest
                </>
              ) : (
                <>
                  <SortAsc size={16} />
                  Oldest
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-coral-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-coral-500" />
            </div>
            <p className="text-slate-warm-600 font-medium">Loading your gallery...</p>
            <p className="text-sm text-slate-warm-400 mt-1">Fetching your mockups</p>
          </div>
        </div>
      ) : mockups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-24 h-24 rounded-3xl bg-slate-warm-100 flex items-center justify-center mb-6">
            <ImageIcon size={44} className="text-slate-warm-300" />
          </div>
          <h3 className="text-2xl font-display text-slate-warm-700 mb-3">No mockups yet</h3>
          <p className="text-slate-warm-500 mb-8 text-center max-w-md">
            Your AI-generated lifestyle mockups will appear here. Create your first post to get started!
          </p>
          {onCreatePost && (
            <button
              onClick={onCreatePost}
              className="btn-primary text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2"
            >
              <Sparkles size={18} />
              Create Your First Mockup
            </button>
          )}
        </div>
      ) : processedMockups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-20 h-20 rounded-2xl bg-slate-warm-100 flex items-center justify-center mb-5">
            <Filter size={32} className="text-slate-warm-300" />
          </div>
          <h3 className="text-xl font-display text-slate-warm-700 mb-2">No results found</h3>
          <p className="text-slate-warm-500 mb-6">Try adjusting your filter settings</p>
          <button
            onClick={() => setFilterBy('all')}
            className="text-coral-500 font-medium hover:text-coral-600 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
          {processedMockups.map((mockup, index) => (
            <div
              key={mockup.id}
              onClick={() => setSelectedMockup(mockup)}
              style={{ animationDelay: `${index * 40}ms` }}
              className="group card-elevated overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* Image */}
              <div className="relative aspect-square bg-slate-warm-100 overflow-hidden">
                <img
                  src={mockup.imageUrl}
                  alt={mockup.styleDescription}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                
                {/* Source Product Badge */}
                {mockup.sourceProduct && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-md text-xs font-medium text-slate-warm-700">
                    <Package size={12} className="text-coral-500" />
                    <span className="truncate max-w-[120px]">{mockup.sourceProduct.title}</span>
                  </div>
                )}
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-warm-900/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-end gap-2">
                    {/* Add to Product Button (only show if source product exists and in Shopify context) */}
                    {mockup.sourceProduct && isShopifyContext && (
                      <button
                        onClick={(e) => handleAddToProduct(mockup, e)}
                        disabled={addingToProductIds.has(mockup.id)}
                        className="p-2.5 rounded-xl bg-sage-500/95 backdrop-blur-sm text-white hover:bg-sage-600 transition-colors shadow-lg disabled:opacity-70"
                        title={`Add to ${mockup.sourceProduct.title}`}
                      >
                        {addingToProductIds.has(mockup.id) ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Upload size={18} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDownload(mockup, e)}
                      disabled={downloadingIds.has(mockup.id)}
                      className="p-2.5 rounded-xl bg-white/95 backdrop-blur-sm text-slate-warm-700 hover:bg-white hover:text-coral-500 transition-colors shadow-lg disabled:opacity-70"
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
                      className="p-2.5 rounded-xl bg-white/95 backdrop-blur-sm text-slate-warm-700 hover:bg-red-500 hover:text-white transition-colors shadow-lg disabled:opacity-70"
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
                <p className="text-sm font-medium text-slate-warm-700 line-clamp-2 mb-2 min-h-[2.5rem] group-hover:text-coral-600 transition-colors">
                  {mockup.styleDescription}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-warm-400">
                    <Clock size={12} />
                    <span>{formatDate(mockup.createdAt)}</span>
                  </div>
                  {mockup.sourceProduct && (
                    <div className="text-xs text-slate-warm-400 truncate max-w-[100px]" title={mockup.sourceProduct.title}>
                      from product
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal - Rendered via Portal to ensure full viewport coverage */}
      {selectedMockup && createPortal(
        <div 
          className="fixed top-0 left-0 w-screen h-screen bg-black/90 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setSelectedMockup(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setSelectedMockup(null)}
            className="fixed top-6 right-6 z-[10000] w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 hover:bg-black/80 hover:border-white/40 text-white flex items-center justify-center transition-all shadow-xl"
            aria-label="Close"
          >
            <X size={24} />
          </button>

          <div 
            className="flex flex-col items-center justify-center max-w-[90vw] max-h-[90vh] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={selectedMockup.imageUrl}
                alt={selectedMockup.styleDescription}
                className="max-w-full max-h-[65vh] w-auto h-auto object-contain"
              />
            </div>

            {/* Details */}
            <div className="mt-4 w-full max-w-xl bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 shadow-2xl">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-white/90 leading-relaxed line-clamp-2">
                  {selectedMockup.styleDescription}
                </p>
                
                {/* Source Product Info */}
                {selectedMockup.sourceProduct && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
                    <Package size={14} className="text-coral-400" />
                    <span className="text-xs text-white/80">
                      From product: <span className="font-medium text-white">{selectedMockup.sourceProduct.title}</span>
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Clock size={12} />
                    <span>{formatDate(selectedMockup.createdAt)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Add to Product Button */}
                    {selectedMockup.sourceProduct && isShopifyContext && (
                      <button
                        onClick={() => handleAddToProduct(selectedMockup)}
                        disabled={addingToProductIds.has(selectedMockup.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sage-500/90 hover:bg-sage-500 text-white text-xs font-medium transition-all disabled:opacity-70"
                      >
                        {addingToProductIds.has(selectedMockup.id) ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Adding...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            <span>Add to Product</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(selectedMockup)}
                      disabled={downloadingIds.has(selectedMockup.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-all disabled:opacity-70"
                    >
                      {downloadingIds.has(selectedMockup.id) ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download size={14} />
                          <span>Download</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(selectedMockup)}
                      disabled={deletingIds.has(selectedMockup.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs font-medium transition-all disabled:opacity-70"
                    >
                      {deletingIds.has(selectedMockup.id) ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
