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
      setError(err.message || 'Failed to load products');
      console.error('Error loading products:', err);
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
              <Package size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900">
                Your Products
              </h2>
              <p className="text-xs text-slate-500">
                Select a product to create social content
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <List size={18} /> : <Grid size={18} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
              title="Refresh products"
            >
              <RefreshCcw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-400 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  loadProducts(selectedCollection || undefined);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Collection Filter */}
          <div className="relative">
            <Filter
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={selectedCollection}
              onChange={(e) => handleCollectionChange(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-400 outline-none appearance-none bg-white cursor-pointer min-w-[160px]"
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
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-50 flex items-center gap-2"
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
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={32} className="text-green-500 animate-spin mb-3" />
            <p className="text-slate-500 text-sm">Loading products...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-600 text-sm mb-2">{error}</p>
            <button
              onClick={handleRefresh}
              className="text-red-600 text-sm font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && products.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Package size={28} className="text-slate-300" />
            </div>
            <p className="font-semibold text-slate-500 mb-1">No products found</p>
            <p className="text-xs text-slate-400">
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
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3'
                : 'space-y-2'
            }
          >
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                viewMode={viewMode}
                onClick={() => handleProductClick(product)}
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
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, onClick }) => {
  const imageUrl = product.featuredImage
    ? getResizedImageUrl(product.featuredImage, 'medium')
    : null;

  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 hover:border-green-300 hover:shadow-sm cursor-pointer transition-all group"
      >
        <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={24} className="text-slate-300" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 text-sm truncate group-hover:text-green-700">
            {product.title}
          </h3>
          <p className="text-xs text-slate-500 truncate">{product.vendor}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-400">
              {product.images.length} image{product.images.length !== 1 ? 's' : ''}
            </span>
            {product.tags.length > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <Tag size={10} className="text-slate-400" />
                <span className="text-xs text-slate-400 truncate">
                  {product.tags.slice(0, 2).join(', ')}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-300 group-hover:text-green-500" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="rounded-xl border border-slate-200 overflow-hidden hover:border-green-300 hover:shadow-md cursor-pointer transition-all group"
    >
      <div className="aspect-square bg-slate-100 relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={32} className="text-slate-300" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <span className="text-white text-xs font-medium">
            {product.images.length} image{product.images.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Image count badge */}
        {product.images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
            +{product.images.length - 1}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-slate-800 text-sm truncate group-hover:text-green-700">
          {product.title}
        </h3>
        <p className="text-xs text-slate-500 truncate">{product.vendor || product.productType}</p>
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-900">{product.title}</h3>
            <p className="text-sm text-slate-500">{product.vendor}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <p className="text-sm text-slate-600 mb-4">
            Select an image to use for mockup generation:
          </p>

          {product.images.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No images available</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {product.images.map((image) => (
                <div
                  key={image.id}
                  onClick={() => setSelectedImageId(image.id)}
                  className={`
                    relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all
                    ${selectedImageId === image.id
                      ? 'border-green-500 shadow-lg shadow-green-500/20'
                      : 'border-transparent hover:border-slate-200'
                    }
                  `}
                >
                  <img
                    src={getResizedImageUrl(image.src, 'compact')}
                    alt={image.alt || product.title}
                    className="w-full h-full object-cover"
                  />
                  {selectedImageId === image.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <Check size={14} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Product Description */}
          {product.description && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl">
              <p
                className="text-xs text-slate-600 line-clamp-3"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={onUseProduct}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-white rounded-xl text-sm font-medium transition-colors"
            >
              Use All Images
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedImageId}
              className="px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl text-sm font-semibold hover:from-green-700 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check size={16} />
              Use Selected Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

