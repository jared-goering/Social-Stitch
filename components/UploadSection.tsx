import React, { useState, useEffect } from 'react';
import { UploadedDesign, SavedStyle } from '../types';
import { Shirt, Trash2, Clock, Loader2, Save } from 'lucide-react';
import { getSavedStyles, saveStyle, deleteStyle } from '../services/stylesService';

interface Props {
  onUpload: (design: UploadedDesign) => void;
}

export const UploadSection: React.FC<Props> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUpload, setPendingUpload] = useState<{ file: File; base64: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPendingUpload({ file, base64 });
    };
    reader.readAsDataURL(file);
  };

  const proceedWithUpload = async (saveToLibrary: boolean) => {
    if (!pendingUpload) return;

    const { file, base64 } = pendingUpload;

    // Save to library if requested - wait for it to complete before proceeding
    if (saveToLibrary) {
      setIsSaving(true);
      try {
        const saved = await saveStyle(file);
        setSavedStyles((prev) => [saved, ...prev]);
      } catch (err) {
        console.error('Failed to save style:', err);
      } finally {
        setIsSaving(false);
      }
    }

    // Proceed with the upload
    onUpload({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      base64: base64.split(',')[1]
    });

    setPendingUpload(null);
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

  // Pending upload confirmation modal
  if (pendingUpload) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <img 
              src={URL.createObjectURL(pendingUpload.file)} 
              alt="Preview" 
              className="w-24 h-24 object-cover rounded-lg border border-slate-200"
            />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Ready to continue</h3>
              <p className="text-sm text-slate-500">{pendingUpload.file.name}</p>
            </div>
          </div>
          
          <p className="text-slate-600 mb-6">
            Would you like to save this style to your library for future use?
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={() => proceedWithUpload(true)}
              disabled={isSaving}
              className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save & Continue
            </button>
            <button
              onClick={() => proceedWithUpload(false)}
              className="flex-1 bg-slate-100 text-slate-700 px-4 py-3 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              Just Continue
            </button>
          </div>
          
          <button
            onClick={() => setPendingUpload(null)}
            className="w-full mt-3 text-slate-500 text-sm hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Upload area */}
      <div 
        className={`
          border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-white'}
        `}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
          <Shirt size={32} />
        </div>
        <h3 className="text-xl font-semibold text-slate-800 mb-2">Upload your Apparel Style</h3>
        <p className="text-slate-500 mb-6">
            Drag and drop a photo of your t-shirt or garment. <br/>
            <span className="text-xs text-slate-400">Flat lay or ghost mannequin photos work best.</span>
        </p>
        <input 
          id="fileInput"
          type="file" 
          className="hidden" 
          accept="image/*"
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
          Select Photo
        </button>
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100">
        <strong>Tip:</strong> Upload the actual garment photo. We will use the <strong>Gemini 3 Pro</strong> model to faithfully place this exact item on a model in your chosen setting.
      </div>

      {/* Saved Styles Section */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-slate-400" />
          <h4 className="text-lg font-semibold text-slate-700">Saved Styles</h4>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        ) : savedStyles.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm">
              No saved styles yet. Upload a style and save it to your library!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {savedStyles.map((style) => (
              <div
                key={style.id}
                className="group relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-indigo-500 transition-all hover:shadow-lg cursor-pointer"
                onClick={() => handleSelectSavedStyle(style)}
              >
                <img 
                  src={style.imageUrl} 
                  alt={style.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white text-xs font-medium truncate">{style.name}</p>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteStyle(e, style.id)}
                  disabled={deletingId === style.id}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
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
