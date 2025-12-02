import React, { useState, useEffect } from 'react';
import { UploadedDesign, SavedStyle } from '../types';
import { Shirt, Trash2, Clock, Loader2, Lightbulb, ImagePlus, FolderOpen } from 'lucide-react';
import { getSavedStyles, saveStyle, deleteStyle } from '../services/stylesService';

interface Props {
  onUpload: (design: UploadedDesign) => void;
}

export const UploadSection: React.FC<Props> = ({ onUpload }) => {
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
          <div className="absolute -inset-1 rounded-2xl animate-gradient-border opacity-75 blur-sm" />
        )}
        <div 
          className={`
            relative rounded-2xl p-10 text-center transition-all cursor-pointer overflow-hidden
            ${isDragging 
              ? 'bg-indigo-50 border-2 border-indigo-400 shadow-lg shadow-indigo-500/10' 
              : 'bg-white border-2 border-slate-200 hover:border-indigo-300 hover:shadow-md'
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
              <Loader2 size={48} className="mx-auto mb-4 text-indigo-500 animate-spin" />
              <p className="text-slate-600 font-medium">Processing your image...</p>
            </div>
          ) : (
            <>
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-all
                ${isDragging 
                  ? 'bg-indigo-500 text-white scale-110' 
                  : 'bg-gradient-to-br from-indigo-50 to-slate-100 text-indigo-500'
                }
              `}>
                <ImagePlus size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-display font-semibold text-slate-800 mb-2">Upload your Apparel Style</h3>
              <p className="text-slate-500 mb-2">
                  Drag and drop a photo of your t-shirt or garment.
              </p>
              <p className="text-xs text-slate-400 mb-6">Flat lay or ghost mannequin photos work best.</p>
              <input 
                id="fileInput"
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              />
              <button className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-600 transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/25">
                Select Photo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save to library toggle */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => setSaveToLibrary(!saveToLibrary)}
          className={`
            relative w-11 h-6 rounded-full transition-colors duration-200
            ${saveToLibrary ? 'bg-indigo-600' : 'bg-slate-200'}
          `}
        >
          <span className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200
            ${saveToLibrary ? 'translate-x-5' : 'translate-x-0'}
          `} />
        </button>
        <span className="text-sm text-slate-600">Save to library for future use</span>
      </div>
      
      {/* Enhanced tip box */}
      <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/50 flex gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Lightbulb size={20} className="text-amber-600" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-amber-800 mb-0.5">Pro Tip</p>
          <p className="text-amber-700 leading-relaxed">
            Upload the actual garment photo. We'll use <span className="font-medium">Gemini 3 Pro</span> to faithfully place this exact item on a model in your chosen setting.
          </p>
        </div>
      </div>

      {/* Saved Styles Section */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-slate-400" />
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Saved Styles</h4>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        ) : savedStyles.length === 0 ? (
          <div className="text-center py-10 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-dashed border-slate-200">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm font-medium mb-1">No saved styles yet</p>
            <p className="text-slate-400 text-xs">
              Upload a style and it'll appear here for quick access
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 stagger-children">
            {savedStyles.map((style) => (
              <div
                key={style.id}
                className="group relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200 hover:border-indigo-400 transition-all cursor-pointer hover-lift"
                onClick={() => handleSelectSavedStyle(style)}
              >
                <img 
                  src={style.imageUrl} 
                  alt={style.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs font-medium truncate">{style.name}</p>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteStyle(e, style.id)}
                  disabled={deletingId === style.id}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500/90 backdrop-blur-sm text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110 disabled:opacity-50"
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
