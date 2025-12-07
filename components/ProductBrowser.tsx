/**
 * Product Browser Component
 *
 * Displays the merchant's Shopify product catalog with search and filtering.
 * Allows selecting products to use for mockup generation.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  SlidersHorizontal,
  ChevronDown,
  Circle,
  CheckCircle2,
  Archive,
  FileEdit,
  Store,
  Layers,
} from 'lucide-react';

interface ProductBrowserProps {
  onSelectProduct: (product: ShopifyProduct) => void;
  onSelectImage: (image: ShopifyProductImage, product: ShopifyProduct) => void;
}

type ViewMode = 'grid' | 'list';
type ProductStatus = '' | 'active' | 'draft' | 'archived';

interface FilterState {
  status: ProductStatus;
  vendor: string;
  productType: string;
  collection: string;
}

export const ProductBrowser: React.FC<ProductBrowserProps> = ({
  onSelectProduct,
  onSelectImage,
}) => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]); // For extracting filter options
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Advanced filter state
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    vendor: '',
    productType: '',
    collection: '',
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Product detail modal
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [showImageSelector, setShowImageSelector] = useState(false);

  // Extract unique vendors and product types from all products
  const { uniqueVendors, uniqueProductTypes } = useMemo(() => {
    const vendors = new Set<string>();
    const productTypes = new Set<string>();
    
    allProducts.forEach((product) => {
      if (product.vendor) vendors.add(product.vendor);
      if (product.productType) productTypes.add(product.productType);
    });
    
    return {
      uniqueVendors: Array.from(vendors).sort(),
      uniqueProductTypes: Array.from(productTypes).sort(),
    };
  }, [allProducts]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return [filters.status, filters.vendor, filters.productType, filters.collection]
      .filter(Boolean).length;
  }, [filters]);

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) {
        setShowFilterPanel(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowFilterPanel(false);
      }
    };

    if (showFilterPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showFilterPanel]);

  // Load products on mount
  useEffect(() => {
    loadProducts();
    loadCollections();
  }, []);

  // Filter products client-side based on current filters
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      // Status filter
      if (filters.status && product.status !== filters.status) {
        return false;
      }
      // Vendor filter
      if (filters.vendor && product.vendor !== filters.vendor) {
        return false;
      }
      // Product type filter
      if (filters.productType && product.productType !== filters.productType) {
        return false;
      }
      return true;
    });
  }, [allProducts, filters.status, filters.vendor, filters.productType]);

  // Update displayed products when filters change
  useEffect(() => {
    setProducts(filteredProducts);
  }, [filteredProducts]);

  const loadProducts = async (collectionId?: string, loadAll = false) => {
    if (loadAll) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await fetchProductsCached({
        limit: 250,
        collectionId,
        loadAll,
        onProgress: (count) => setLoadedCount(count),
      });
      setAllProducts(data);
      setProducts(data);
      // If we got exactly 250 products and not loading all, there might be more
      setHasMoreProducts(!loadAll && data.length === 250);
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
      setIsLoadingMore(false);
    }
  };

  const loadAllProducts = () => {
    loadProducts(filters.collection || undefined, true);
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
      loadProducts(filters.collection || undefined);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const { products: results } = await searchProducts(searchQuery);
      setAllProducts(results);
      setProducts(results);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, filters.collection]);

  const handleCollectionChange = (collectionId: string) => {
    setFilters((prev) => ({ ...prev, collection: collectionId }));
    setSearchQuery('');
    loadProducts(collectionId || undefined);
  };

  const handleRefresh = () => {
    clearProductCache();
    loadProducts(filters.collection || undefined);
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilter = (key: keyof FilterState) => {
    setFilters((prev) => ({ ...prev, [key]: '' }));
    if (key === 'collection') {
      loadProducts();
    }
  };

  const handleClearAllFilters = () => {
    setFilters({
      status: '',
      vendor: '',
      productType: '',
      collection: '',
    });
    loadProducts();
  };

  const getFilterLabel = (key: keyof FilterState, value: string): string => {
    switch (key) {
      case 'status':
        return value.charAt(0).toUpperCase() + value.slice(1);
      case 'collection':
        return collections.find((c) => c.id.toString() === value)?.title || value;
      default:
        return value;
    }
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
                  loadProducts(filters.collection || undefined);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-warm-400 hover:text-slate-warm-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Button with Panel */}
          <div className="relative" ref={filterPanelRef}>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                ${showFilterPanel || activeFilterCount > 0
                  ? 'border-coral-400 bg-coral-50 text-coral-700'
                  : 'border-slate-warm-200 bg-white text-slate-warm-600 hover:border-slate-warm-300'
                }
              `}
            >
              <SlidersHorizontal size={16} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-coral-500 text-white text-xs font-semibold">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showFilterPanel ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Filter Panel Dropdown */}
            {showFilterPanel && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border-2 border-slate-warm-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-slate-warm-100 bg-gradient-to-r from-slate-warm-50 to-white">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-warm-800">Filter Products</h3>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={handleClearAllFilters}
                        className="text-xs text-coral-600 hover:text-coral-700 font-medium"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-5">
                  {/* Status Filter */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-warm-500 uppercase tracking-wide mb-2.5">
                      <Circle size={12} />
                      Status
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: '', label: 'All', icon: Layers },
                        { value: 'active', label: 'Active', icon: CheckCircle2 },
                        { value: 'draft', label: 'Draft', icon: FileEdit },
                        { value: 'archived', label: 'Archived', icon: Archive },
                      ].map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => handleFilterChange('status', value as ProductStatus)}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                            ${filters.status === value
                              ? 'bg-coral-500 text-white shadow-sm'
                              : 'bg-slate-warm-100 text-slate-warm-600 hover:bg-slate-warm-200'
                            }
                          `}
                        >
                          <Icon size={12} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Collection Filter */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-warm-500 uppercase tracking-wide mb-2.5">
                      <Layers size={12} />
                      Collection
                    </label>
                    <select
                      value={filters.collection}
                      onChange={(e) => handleCollectionChange(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-warm-200 text-sm focus:ring-2 focus:ring-coral-500/20 focus:border-coral-400 outline-none appearance-none bg-white cursor-pointer"
                    >
                      <option value="">All Collections</option>
                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vendor Filter */}
                  {uniqueVendors.length > 0 && (
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-warm-500 uppercase tracking-wide mb-2.5">
                        <Store size={12} />
                        Vendor
                      </label>
                      <select
                        value={filters.vendor}
                        onChange={(e) => handleFilterChange('vendor', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-warm-200 text-sm focus:ring-2 focus:ring-coral-500/20 focus:border-coral-400 outline-none appearance-none bg-white cursor-pointer"
                      >
                        <option value="">All Vendors</option>
                        {uniqueVendors.map((vendor) => (
                          <option key={vendor} value={vendor}>
                            {vendor}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Product Type Filter */}
                  {uniqueProductTypes.length > 0 && (
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-warm-500 uppercase tracking-wide mb-2.5">
                        <Tag size={12} />
                        Product Type
                      </label>
                      <select
                        value={filters.productType}
                        onChange={(e) => handleFilterChange('productType', e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-warm-200 text-sm focus:ring-2 focus:ring-coral-500/20 focus:border-coral-400 outline-none appearance-none bg-white cursor-pointer"
                      >
                        <option value="">All Types</option>
                        {uniqueProductTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-warm-100 bg-slate-warm-50/50">
                  <button
                    onClick={() => setShowFilterPanel(false)}
                    className="w-full py-2.5 rounded-xl bg-coral-500 text-white text-sm font-medium hover:bg-coral-600 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
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

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="text-xs text-slate-warm-500 font-medium">Active filters:</span>
            {filters.status && (
              <FilterChip
                label={`Status: ${getFilterLabel('status', filters.status)}`}
                onRemove={() => handleClearFilter('status')}
              />
            )}
            {filters.collection && (
              <FilterChip
                label={`Collection: ${getFilterLabel('collection', filters.collection)}`}
                onRemove={() => handleClearFilter('collection')}
              />
            )}
            {filters.vendor && (
              <FilterChip
                label={`Vendor: ${filters.vendor}`}
                onRemove={() => handleClearFilter('vendor')}
              />
            )}
            {filters.productType && (
              <FilterChip
                label={`Type: ${filters.productType}`}
                onRemove={() => handleClearFilter('productType')}
              />
            )}
            {activeFilterCount > 1 && (
              <button
                onClick={handleClearAllFilters}
                className="text-xs text-coral-600 hover:text-coral-700 font-medium ml-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}
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
              {activeFilterCount > 0 ? (
                <Filter size={36} className="text-slate-warm-300" />
              ) : (
                <Package size={36} className="text-slate-warm-300" />
              )}
            </div>
            <p className="font-semibold text-slate-warm-600 mb-2">No products found</p>
            <p className="text-sm text-slate-warm-400 max-w-xs mx-auto mb-4">
              {searchQuery
                ? 'Try a different search term'
                : activeFilterCount > 0
                ? 'No products match your current filters'
                : 'Add products to your Shopify store to get started'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-coral-100 text-coral-700 text-sm font-medium hover:bg-coral-200 transition-colors"
              >
                <X size={14} />
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Products Grid */}
        {!isLoading && !error && products.length > 0 && (
          <>
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
            
            {/* Load All Products Button */}
            {hasMoreProducts && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadAllProducts}
                  disabled={isLoadingMore}
                  className="px-6 py-3 rounded-xl font-medium text-sm border-2 border-slate-warm-200 text-slate-warm-700 hover:border-coral-300 hover:bg-coral-50 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading all products... {loadedCount > 0 && `(${loadedCount})`}
                    </>
                  ) : (
                    <>
                      <Package size={16} />
                      Load All Products
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-warm-400 mt-2">
                  Showing {products.length} products. Click to load your complete catalog.
                </p>
              </div>
            )}
          </>
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

// Filter Chip Component
interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, onRemove }) => {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-coral-100 text-coral-700 text-xs font-medium animate-in fade-in zoom-in-95 duration-200">
      {label}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="w-4 h-4 rounded-full bg-coral-200 hover:bg-coral-300 flex items-center justify-center transition-colors"
      >
        <X size={10} strokeWidth={3} />
      </button>
    </span>
  );
};
