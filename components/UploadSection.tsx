import React, { useState, useEffect } from 'react';
import { UploadedDesign, SavedStyle } from '../types';
import { 
  Trash2, 
  Clock, 
  Loader2, 
  Lightbulb, 
  ImagePlus, 
  FolderOpen, 
  Sparkles,
  Upload,
  Check,
  Package
} from 'lucide-react';
import { getSavedStyles, saveStyle, deleteStyle } from '../services/stylesService';

interface Props {
  onUpload: (design: UploadedDesign) => void;
  onNavigateToProducts?: () => void;
}

export const UploadSection: React.FC<Props> = ({ onUpload, onNavigateToProducts }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load saved styles on mount
  useEffect(() => {
    loadSavedStyles();
  }, []);

  const loadSavedStyles = async () => {
    try {
      const styles = await getSavedStyles();
      setSavedStyles(styles);
    } catch (error) {
      console.error('Failed to load saved styles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file.");
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;

      // Save to library if toggle is enabled
      if (saveToLibrary) {
        try {
          const saved = await saveStyle(file);
          setSavedStyles((prev) => [saved, ...prev]);
        } catch (err) {
          console.error('Failed to save style:', err);
        }
      }

      // Proceed with the upload
      onUpload({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        base64: base64.split(',')[1]
      });

      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSavedStyle = async (style: SavedStyle) => {
    // Fetch the image and convert to base64
    try {
      const response = await fetch(style.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], style.name, { type: blob.type });
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onUpload({
          id: crypto.randomUUID(),
          file,
          previewUrl: style.imageUrl,
          base64: base64.split(',')[1]
        });
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to load saved style:', error);
      alert('Failed to load this style. Please try again.');
    }
  };

  const handleDeleteStyle = async (e: React.MouseEvent, styleId: string) => {
    e.stopPropagation();
    if (deletingId) return;
    
    setDeletingId(styleId);
    try {
      await deleteStyle(styleId);
      setSavedStyles((prev) => prev.filter((s) => s.id !== styleId));
    } catch (error) {
      console.error('Failed to delete style:', error);
      alert('Failed to delete style. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="max-w-xl mx-auto">
      {/* Upload area with animated gradient border on drag */}
      <div className="relative group">
        {isDragging && (
          <div className="absolute -inset-1 rounded-3xl animate-gradient-border opacity-75 blur-sm" />
        )}
        <div 
          className={`
            relative rounded-3xl p-10 text-center transition-all cursor-pointer overflow-hidden
            ${isDragging 
              ? 'bg-coral-50 border-2 border-coral-400 shadow-lg shadow-coral-500/10' 
              : 'bg-white border-2 border-slate-warm-200 hover:border-coral-300 hover:shadow-lg hover:shadow-coral-500/5'
            }
            ${isUploading ? 'pointer-events-none opacity-70' : ''}
          `}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !isUploading && document.getElementById('fileInput')?.click()}
        >
          {isUploading ? (
            <div className="py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-coral-100 flex items-center justify-center">
                <Loader2 size={32} className="text-coral-500 animate-spin" />
              </div>
              <p className="text-slate-warm-700 font-medium">Processing your image...</p>
              <p className="text-sm text-slate-warm-400 mt-1">This won't take long</p>
            </div>
          ) : (
            <>
              <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all
                ${isDragging 
                  ? 'bg-coral-500 text-white scale-110 shadow-lg shadow-coral-500/30' 
                  : 'bg-gradient-to-br from-coral-100 to-coral-50 text-coral-500 group-hover:scale-105'
                }
              `}>
                {isDragging ? (
                  <Upload size={32} strokeWidth={2} />
                ) : (
                  <ImagePlus size={32} strokeWidth={1.5} />
                )}
              </div>
              <h3 className="text-2xl font-display text-slate-warm-900 mb-3">
                {isDragging ? 'Drop it here!' : 'Upload your Apparel Style'}
              </h3>
              <p className="text-slate-warm-500 mb-2 max-w-sm mx-auto">
                Drag and drop a photo of your t-shirt or garment
              </p>
              <p className="text-xs text-slate-warm-400 mb-6">
                Flat lay or ghost mannequin photos work best
              </p>
              <input 
                id="fileInput"
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              />
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button className="btn-primary text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2">
                  <Upload size={18} />
                  Select Photo
                </button>
                {onNavigateToProducts && (
                  <>
                    <span className="text-slate-warm-400 text-sm">or</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToProducts();
                      }}
                      className="px-6 py-3 rounded-xl font-semibold inline-flex items-center gap-2 border-2 border-slate-warm-200 text-slate-warm-700 hover:border-coral-300 hover:bg-coral-50 transition-all"
                    >
                      <Package size={18} />
                      Choose from Products
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save to library toggle */}
      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          onClick={() => setSaveToLibrary(!saveToLibrary)}
          className={`
            relative w-12 h-7 rounded-full transition-colors duration-200
            ${saveToLibrary ? 'bg-coral-500' : 'bg-slate-warm-300'}
          `}
        >
          <span className={`
            absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 flex items-center justify-center
            ${saveToLibrary ? 'translate-x-5' : 'translate-x-0'}
          `}>
            {saveToLibrary && <Check size={12} className="text-coral-500" />}
          </span>
        </button>
        <span className="text-sm text-slate-warm-600">Save to library for future use</span>
      </div>
      
      {/* Enhanced tip box */}
      <div className="mt-6 p-5 bg-gradient-to-r from-amber-light/50 to-amber-light/30 rounded-2xl border border-amber-accent/20 flex gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-amber-accent/20 flex items-center justify-center">
          <Sparkles size={20} className="text-amber-dark" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-slate-warm-800 mb-1">AI Magic Tip</p>
          <p className="text-slate-warm-600 leading-relaxed">
            Upload the actual garment photo. Our <span className="font-medium text-coral-600">Gemini AI</span> will faithfully place this exact item on a model in your chosen lifestyle setting.
          </p>
        </div>
      </div>

      {/* Saved Styles Section */}
      <div className="mt-12">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-slate-warm-100 flex items-center justify-center">
            <Clock size={16} className="text-slate-warm-500" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-warm-700">Saved Styles</h4>
            <p className="text-xs text-slate-warm-400">Quick access to your designs</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-coral-500" />
          </div>
        ) : savedStyles.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-b from-slate-warm-50 to-white rounded-2xl border-2 border-dashed border-slate-warm-200">
            <div className="w-16 h-16 bg-slate-warm-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={28} className="text-slate-warm-400" />
            </div>
            <p className="text-slate-warm-600 text-sm font-medium mb-1">No saved styles yet</p>
            <p className="text-slate-warm-400 text-xs">
              Upload a style and it'll appear here for quick access
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 stagger-children">
            {savedStyles.map((style) => (
              <div
                key={style.id}
                className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-warm-200 hover:border-coral-400 transition-all cursor-pointer hover-lift"
                onClick={() => handleSelectSavedStyle(style)}
              >
                <img 
                  src={style.imageUrl} 
                  alt={style.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-warm-900/80 via-slate-warm-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs font-medium truncate">{style.name}</p>
                  </div>
                </div>

                {/* Use indicator */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                    <Upload size={20} className="text-coral-500" />
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteStyle(e, style.id)}
                  disabled={deletingId === style.id}
                  className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm text-slate-warm-600 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white hover:scale-110 disabled:opacity-50 shadow-sm"
                  title="Delete style"
                >
                  {deletingId === style.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
