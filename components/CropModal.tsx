import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { MockupOption } from '../types';
import { X, ChevronLeft, ChevronRight, Check, Square, RectangleVertical, RectangleHorizontal, Smartphone, Crop as CropIcon } from 'lucide-react';

interface Props {
  mockups: MockupOption[];
  onSave: (croppedMockups: MockupOption[]) => void;
  onClose: () => void;
}

interface AspectRatioOption {
  id: string;
  label: string;
  ratio: number;
  icon: React.ReactNode;
  description: string;
}

const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: 'square', label: '1:1', ratio: 1, icon: <Square size={16} />, description: 'Square' },
  { id: 'portrait', label: '4:5', ratio: 4/5, icon: <RectangleVertical size={16} />, description: 'Portrait' },
  { id: 'landscape', label: '1.91:1', ratio: 1.91, icon: <RectangleHorizontal size={16} />, description: 'Landscape' },
  { id: 'stories', label: '9:16', ratio: 9/16, icon: <Smartphone size={16} />, description: 'Stories' },
];

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

async function getCroppedImg(
  imageSrc: string,
  crop: PixelCrop,
  displayWidth: number,
  displayHeight: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      // Calculate scale between displayed size and natural size
      const scaleX = image.naturalWidth / displayWidth;
      const scaleY = image.naturalHeight / displayHeight;

      canvas.width = crop.width * scaleX;
      canvas.height = crop.height * scaleY;

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageSrc;
  });
}

interface ImageDimensions {
  width: number;
  height: number;
}

export const CropModal: React.FC<Props> = ({ mockups, onSave, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioOption>(ASPECT_RATIOS[0]);
  const [crops, setCrops] = useState<Map<string, Crop>>(new Map());
  const [completedCrops, setCompletedCrops] = useState<Map<string, PixelCrop>>(new Map());
  const [imageDimensions, setImageDimensions] = useState<Map<string, ImageDimensions>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState<Set<string>>(new Set());
  const imgRef = useRef<HTMLImageElement>(null);

  const currentMockup = mockups[currentIndex];

  // Track the previous ratio to detect actual changes
  const prevRatioRef = useRef(selectedRatio.ratio);

  // When ratio changes, recalculate crops for all loaded images
  useEffect(() => {
    // Only reset crops when the ratio actually changes, not on other re-renders
    if (prevRatioRef.current !== selectedRatio.ratio && imageDimensions.size > 0) {
      prevRatioRef.current = selectedRatio.ratio;
      
      const newCrops = new Map<string, Crop>();
      const newCompletedCrops = new Map<string, PixelCrop>();
      
      imageDimensions.forEach((dims, mockupId) => {
        const crop = centerAspectCrop(dims.width, dims.height, selectedRatio.ratio);
        newCrops.set(mockupId, crop);
        
        // Also update completed crops
        const pixelCrop: PixelCrop = {
          unit: 'px',
          x: (crop.x / 100) * dims.width,
          y: (crop.y / 100) * dims.height,
          width: (crop.width / 100) * dims.width,
          height: (crop.height / 100) * dims.height,
        };
        newCompletedCrops.set(mockupId, pixelCrop);
      });
      
      setCrops(newCrops);
      setCompletedCrops(newCompletedCrops);
    }
  }, [selectedRatio.ratio, imageDimensions]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const mockupId = currentMockup.id;
    
    // Always update dimensions with current rendered size
    const dims = { width: img.width, height: img.height };
    setImageDimensions(prev => new Map(prev).set(mockupId, dims));
    setImagesLoaded(prev => new Set(prev).add(mockupId));
    
    // Only set initial crop if we don't already have one for this image
    // This preserves user's manual adjustments when navigating between images
    setCrops(prev => {
      if (prev.has(mockupId)) {
        return prev; // Keep existing crop
      }
      const newCrop = centerAspectCrop(img.width, img.height, selectedRatio.ratio);
      return new Map(prev).set(mockupId, newCrop);
    });
    
    // Only set initial completed crop if we don't already have one
    setCompletedCrops(prev => {
      if (prev.has(mockupId)) {
        return prev; // Keep existing completed crop
      }
      const newCrop = centerAspectCrop(img.width, img.height, selectedRatio.ratio);
      const pixelCrop: PixelCrop = {
        unit: 'px',
        x: (newCrop.x / 100) * img.width,
        y: (newCrop.y / 100) * img.height,
        width: (newCrop.width / 100) * img.width,
        height: (newCrop.height / 100) * img.height,
      };
      return new Map(prev).set(mockupId, pixelCrop);
    });
  };

  const handleCropChange = (crop: Crop) => {
    setCrops(prev => new Map(prev).set(currentMockup.id, crop));
  };

  const handleCropComplete = (crop: PixelCrop) => {
    if (imgRef.current) {
      // Store the completed crop along with current display dimensions
      setCompletedCrops(prev => new Map(prev).set(currentMockup.id, crop));
      setImageDimensions(prev => new Map(prev).set(currentMockup.id, {
        width: imgRef.current!.width,
        height: imgRef.current!.height,
      }));
    }
  };

  const goToPrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : mockups.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev < mockups.length - 1 ? prev + 1 : 0));
  };

  const handleApplyCrops = async () => {
    setIsProcessing(true);
    
    try {
      const croppedMockups: MockupOption[] = await Promise.all(
        mockups.map(async (mockup) => {
          const completedCrop = completedCrops.get(mockup.id);
          const dims = imageDimensions.get(mockup.id);
          
          if (completedCrop && completedCrop.width && completedCrop.height && dims) {
            const croppedUrl = await getCroppedImg(
              mockup.imageUrl, 
              completedCrop,
              dims.width,
              dims.height
            );
            return {
              ...mockup,
              imageUrl: croppedUrl,
            };
          }
          
          return mockup;
        })
      );
      
      onSave(croppedMockups);
    } catch (error) {
      console.error('Failed to crop images:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle preloading of an image
  const handlePreloadImage = (e: React.SyntheticEvent<HTMLImageElement>, mockupId: string) => {
    const img = e.currentTarget;
    
    // Store dimensions for this image
    const dims = { width: img.naturalWidth, height: img.naturalHeight };
    
    // Only set if not already loaded (to not overwrite user adjustments)
    if (!imageDimensions.has(mockupId)) {
      setImageDimensions(prev => new Map(prev).set(mockupId, dims));
      setImagesLoaded(prev => new Set(prev).add(mockupId));
      
      // Set initial crop
      const newCrop = centerAspectCrop(dims.width, dims.height, selectedRatio.ratio);
      setCrops(prev => {
        if (!prev.has(mockupId)) {
          return new Map(prev).set(mockupId, newCrop);
        }
        return prev;
      });
      
      // Also set initial completed crop
      const pixelCrop: PixelCrop = {
        unit: 'px',
        x: (newCrop.x / 100) * dims.width,
        y: (newCrop.y / 100) * dims.height,
        width: (newCrop.width / 100) * dims.width,
        height: (newCrop.height / 100) * dims.height,
      };
      setCompletedCrops(prev => {
        if (!prev.has(mockupId)) {
          return new Map(prev).set(mockupId, pixelCrop);
        }
        return prev;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Hidden preload images */}
      <div className="hidden">
        {mockups.map((mockup) => (
          <img
            key={`preload-${mockup.id}`}
            src={mockup.imageUrl}
            alt=""
            onLoad={(e) => handlePreloadImage(e, mockup.id)}
            crossOrigin="anonymous"
          />
        ))}
      </div>

      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <CropIcon size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-slate-800">Crop Images</h2>
              <p className="text-xs text-slate-500">Choose an aspect ratio for all images</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 justify-center">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setSelectedRatio(ratio)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                  ${selectedRatio.id === ratio.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }
                `}
              >
                {ratio.icon}
                <span>{ratio.label}</span>
                <span className={`text-xs ${selectedRatio.id === ratio.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {ratio.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Crop Area */}
        <div className="flex-1 overflow-hidden flex flex-col items-center justify-center p-6 bg-slate-100 relative min-h-[400px]">
          {/* Navigation */}
          {mockups.length > 1 && (
            <>
              <button
                onClick={goToPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-all z-10"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg text-slate-700 flex items-center justify-center hover:bg-slate-50 transition-all z-10"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Image Counter */}
          {mockups.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium text-slate-700 shadow-sm z-10">
              {currentIndex + 1} / {mockups.length}
            </div>
          )}

          {/* Crop Interface */}
          <div className="max-w-full max-h-[50vh] overflow-hidden rounded-xl shadow-lg">
            <ReactCrop
              crop={crops.get(currentMockup.id)}
              onChange={handleCropChange}
              onComplete={handleCropComplete}
              aspect={selectedRatio.ratio}
              className="max-h-[50vh]"
            >
              <img
                ref={imgRef}
                key={currentMockup.id}
                src={currentMockup.imageUrl}
                alt={`Crop ${currentIndex + 1}`}
                onLoad={handleImageLoad}
                className="max-h-[50vh] max-w-full"
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>

          {/* Thumbnail Strip */}
          {mockups.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto py-2">
              {mockups.map((mockup, idx) => {
                const hasCrop = completedCrops.has(mockup.id);
                return (
                  <button
                    key={mockup.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`
                      relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all bg-white
                      ${idx === currentIndex
                        ? 'border-indigo-500 shadow-md shadow-indigo-500/20'
                        : 'border-transparent hover:border-slate-300 opacity-70 hover:opacity-100'
                      }
                    `}
                  >
                    <img
                      src={mockup.imageUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {hasCrop && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-white">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{selectedRatio.label}</span> ratio will be applied to all {mockups.length} image{mockups.length > 1 ? 's' : ''}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyCrops}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Apply Crop
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

