/**
 * Product Browser Component
 *
 * Displays the merchant's Shopify product catalog with search and filtering.
 * Allows selecting products to use for mockup generation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyCollection,
  fetchProductsCached,
  fetchCollections,
  searchProducts,
  getResizedImageUrl,
  clearProductCache,
  isOAuthRequired,
  redirectToOAuth,
} from '../services/shopifyProductService';
import {
  Search,
  Filter,
  RefreshCcw,
  Loader2,
  Package,
  Image as ImageIcon,
  Check,
  ChevronRight,
  X,
  Grid,
  List,
  Tag,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface ProductBrowserProps {
  onSelectProduct: (product: ShopifyProduct) => void;
  onSelectImage: (image: ShopifyProductImage, product: ShopifyProduct) => void;
}

type ViewMode = 'grid' | 'list';

export const ProductBrowser: React.FC<ProductBrowserProps> = ({
  onSelectProduct,
  onSelectImage,
}) => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Product detail modal
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [showImageSelector, setShowImageSelector] = useState(false);

  // Load products on mount
  useEffect(() => {
    loadProducts();
    loadCollections();
  }, []);

  const loadProducts = async (collectionId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchProductsCached({
        limit: 50,
        collectionId,
      });
      setProducts(data);
    } catch (err: any) {
      console.error('Error loading products:', err);
      
      // Check if OAuth is required and auto-redirect
      if (isOAuthRequired(err)) {
        console.log('[ProductBrowser] OAuth required, redirecting...');
        setError('Connecting to your Shopify store...');
        // Small delay to show the message before redirecting
        setTimeout(() => {
          redirectToOAuth();
        }, 1000);
        return;
      }
      
      setError(err.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const { collections: data } = await fetchCollections();
      setCollections(data);
    } catch (err) {
      console.error('Error loading collections:', err);
      // Non-critical error, don't show to user
    }
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadProducts(selectedCollection || undefined);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const { products: results } = await searchProducts(searchQuery);
      setProducts(results);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectedCollection]);

  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollection(collectionId);
    setSearchQuery('');
    loadProducts(collectionId || undefined);
  };

  const handleRefresh = () => {
    clearProductCache();
    loadProducts(selectedCollection || undefined);
  };

  const handleProductClick = (product: ShopifyProduct) => {
    setSelectedProduct(product);
    setShowImageSelector(true);
  };

  const handleImageSelect = (image: ShopifyProductImage) => {
    if (selectedProduct) {
      onSelectImage(image, selectedProduct);
      setShowImageSelector(false);
      setSelectedProduct(null);
    }
  };

  const handleUseProduct = (product: ShopifyProduct) => {
    onSelectProduct(product);
  };

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-warm-100 bg-gradient-to-r from-slate-warm-50 to-white">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="icon-container icon-container-sage w-12 h-12">
              <Package size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display text-slate-warm-900">
                Your Products
              </h2>
              <p className="text-sm text-slate-warm-500">
                Select a product to create social content
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2.5 rounded-xl hover:bg-slate-warm-100 text-slate-warm-500 transition-colors border border-transparent hover:border-slate-warm-200"
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <List size={18} /> : <Grid size={18} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2.5 rounded-xl hover:bg-slate-warm-100 text-slate-warm-500 transition-colors disabled:opacity-50 border border-transparent hover:border-slate-warm-200"
              title="Refresh products"
            >
              <RefreshCcw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-warm-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search products..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-warm-200 text-sm focus:ring-2 focus:ring-coral-500/20 focus:border-coral-400 outline-none transition-all bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  loadProducts(selectedCollection || undefined);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-warm-400 hover:text-slate-warm-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Collection Filter */}
          <div className="relative">
            <Filter
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-warm-400 pointer-events-none"
            />
            <select
              value={selectedCollection}
              onChange={(e) => handleCollectionChange(e.target.value)}
              className="pl-11 pr-10 py-3 rounded-xl border-2 border-slate-warm-200 text-sm focus:ring-2 focus:ring-coral-500/20 focus:border-coral-400 outline-none appearance-none bg-white cursor-pointer min-w-[180px]"
            >
              <option value="">All Products</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="btn-primary text-white px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Search
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 max-h-[600px] overflow-y-auto custom-scrollbar">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center mb-4">
              <Loader2 size={28} className="text-sage-500 animate-spin" />
            </div>
            <p className="text-slate-warm-600 font-medium">Loading products...</p>
            <p className="text-sm text-slate-warm-400 mt-1">Fetching your catalog</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-coral-50 border-2 border-coral-200 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-coral-100 flex items-center justify-center mx-auto mb-3">
              <X size={24} className="text-coral-500" />
            </div>
            <p className="text-coral-700 font-medium mb-2">{error}</p>
            <button
              onClick={handleRefresh}
              className="text-coral-600 text-sm font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && products.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-slate-warm-100 flex items-center justify-center mx-auto mb-5">
              <Package size={36} className="text-slate-warm-300" />
            </div>
            <p className="font-semibold text-slate-warm-600 mb-2">No products found</p>
            <p className="text-sm text-slate-warm-400 max-w-xs mx-auto">
              {searchQuery
                ? 'Try a different search term'
                : 'Add products to your Shopify store to get started'}
            </p>
          </div>
        )}

        {/* Products Grid */}
        {!isLoading && !error && products.length > 0 && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 stagger-children'
                : 'space-y-3'
            }
          >
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                viewMode={viewMode}
                onClick={() => handleProductClick(product)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info & Image Selector Modal */}
      {showImageSelector && selectedProduct && (
        <ImageSelectorModal
          product={selectedProduct}
          onSelectImage={handleImageSelect}
          onUseProduct={() => {
            handleUseProduct(selectedProduct);
            setShowImageSelector(false);
            setSelectedProduct(null);
          }}
          onClose={() => {
            setShowImageSelector(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
};

// Product Card Component
interface ProductCardProps {
  product: ShopifyProduct;
  viewMode: ViewMode;
  onClick: () => void;
  index: number;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, onClick, index }) => {
  const imageUrl = product.featuredImage
    ? getResizedImageUrl(product.featuredImage, 'medium')
    : null;

  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-warm-200 hover:border-coral-300 hover:shadow-md cursor-pointer transition-all group bg-white"
        style={{ animationDelay: `${index * 30}ms` }}
      >
        <div className="w-16 h-16 rounded-xl bg-slate-warm-100 overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={24} className="text-slate-warm-300" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-warm-800 text-sm truncate group-hover:text-coral-600 transition-colors">
            {product.title}
          </h3>
          <p className="text-xs text-slate-warm-500 truncate">{product.vendor}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-slate-warm-400">
              {product.images.length} image{product.images.length !== 1 ? 's' : ''}
            </span>
            {product.tags.length > 0 && (
              <>
                <span className="text-slate-warm-300">•</span>
                <Tag size={10} className="text-slate-warm-400" />
                <span className="text-xs text-slate-warm-400 truncate">
                  {product.tags.slice(0, 2).join(', ')}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-coral-500">
            Select
          </div>
          <ChevronRight size={18} className="text-slate-warm-300 group-hover:text-coral-500 transition-colors" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="rounded-2xl border-2 border-slate-warm-200 overflow-hidden hover:border-coral-300 hover:shadow-lg cursor-pointer transition-all group bg-white"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="aspect-square bg-slate-warm-100 relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={32} className="text-slate-warm-300" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-warm-900/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-white text-xs font-medium">
              {product.images.length} image{product.images.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1 text-white text-xs font-medium">
              <Sparkles size={12} />
              <span>Create</span>
            </div>
          </div>
        </div>

        {/* Image count badge */}
        {product.images.length > 1 && (
          <div className="absolute top-3 right-3 bg-slate-warm-900/70 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-lg font-medium">
            +{product.images.length - 1}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-slate-warm-800 text-sm truncate group-hover:text-coral-600 transition-colors">
          {product.title}
        </h3>
        <p className="text-xs text-slate-warm-500 truncate">{product.vendor || product.productType}</p>
      </div>
    </div>
  );
};

// Image Selector Modal
interface ImageSelectorModalProps {
  product: ShopifyProduct;
  onSelectImage: (image: ShopifyProductImage) => void;
  onUseProduct: () => void;
  onClose: () => void;
}

const ImageSelectorModal: React.FC<ImageSelectorModalProps> = ({
  product,
  onSelectImage,
  onUseProduct,
  onClose,
}) => {
  const [selectedImageId, setSelectedImageId] = useState<number | null>(
    product.images[0]?.id || null
  );

  const handleConfirm = () => {
    const selectedImage = product.images.find((img) => img.id === selectedImageId);
    if (selectedImage) {
      onSelectImage(selectedImage);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-warm-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-warm-100 flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl text-slate-warm-900">{product.title}</h3>
            <p className="text-sm text-slate-warm-500">{product.vendor}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-slate-warm-100 rounded-xl transition-colors"
          >
            <X size={20} className="text-slate-warm-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
          <p className="text-sm text-slate-warm-600 mb-5">
            Select an image to use for AI mockup generation:
          </p>

          {product.images.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-slate-warm-100 flex items-center justify-center mx-auto mb-4">
                <ImageIcon size={28} className="text-slate-warm-300" />
              </div>
              <p className="text-slate-warm-500">No images available</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {product.images.map((image) => (
                <div
                  key={image.id}
                  onClick={() => setSelectedImageId(image.id)}
                  className={`
                    relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all
                    ${selectedImageId === image.id
                      ? 'border-coral-500 shadow-lg shadow-coral-500/20 scale-[1.02]'
                      : 'border-transparent hover:border-slate-warm-300'
                    }
                  `}
                >
                  <img
                    src={getResizedImageUrl(image.src, 'compact')}
                    alt={image.alt || product.title}
                    className="w-full h-full object-cover"
                  />
                  {selectedImageId === image.id && (
                    <div className="absolute top-2 right-2 w-7 h-7 bg-coral-500 rounded-lg flex items-center justify-center shadow-lg">
                      <Check size={16} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Product Description */}
          {product.description && (
            <div className="mt-5 p-4 bg-slate-warm-50 rounded-2xl">
              <p
                className="text-xs text-slate-warm-600 line-clamp-3"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-warm-100 flex justify-between items-center bg-slate-warm-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-warm-600 hover:bg-slate-warm-100 rounded-xl text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={onUseProduct}
              className="px-5 py-2.5 border-2 border-slate-warm-200 text-slate-warm-700 hover:bg-white rounded-xl text-sm font-medium transition-colors"
            >
              Use All Images
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedImageId}
              className="btn-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Sparkles size={16} />
              Create Mockup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
