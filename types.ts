export interface UploadedDesign {
  id: string;
  file: File;
  previewUrl: string;
  base64: string;
}

export interface SavedStyle {
  id: string;
  imageUrl: string;
  name: string;
  createdAt: Date;
}

export interface MockupOption {
  id: string;
  imageUrl: string;
  styleDescription: string;
}

// Source product reference for mockups generated from Shopify products
export interface SourceProduct {
  id: number;
  title: string;
  handle: string;
  description?: string;     // Product description from Shopify
  productType?: string;     // Product type/category from Shopify
  tags?: string[];          // Product tags for context
  vendor?: string;          // Brand/vendor name
}

export interface SavedMockup extends MockupOption {
  createdAt: Date;
  designId: string;
  sourceProduct?: SourceProduct;
  originalImageUrl?: string; // Preserved original before cropping, for revert functionality
}

export interface GeneratedCaptions {
  facebook: string[];
  instagram: string[];
}

// Caption tone presets for AI generation
export type CaptionTone = 
  | 'default'
  | 'professional'
  | 'casual'
  | 'funny'
  | 'inspiring'
  | 'urgent'
  | 'minimalist';

// Options for customizing caption generation
export interface CaptionGenerationOptions {
  tone?: CaptionTone;
  customTone?: string;
  context?: string;
}

export interface StyleSuggestion {
  title: string;
  description: string;
  reasoning: string;
  category?: ContentCategory;
}

// =============================================================================
// CONTENT CATEGORIES
// =============================================================================

// Content category types for AI style suggestions
export type ContentCategory = 
  | 'lifestyle'
  | 'product'
  | 'editorial'
  | 'ugc'
  | 'seasonal'
  | 'minimalist';

// Detected product type from AI analysis
export type DetectedProductType = 
  | 'apparel'
  | 'jewelry'
  | 'accessories'
  | 'home_decor'
  | 'food_beverage'
  | 'electronics'
  | 'beauty'
  | 'art'
  | 'other';

// Configuration for each content category
export interface CategoryConfig {
  id: ContentCategory;
  label: string;
  shortLabel: string;
  description: string;
  icon: string; // Lucide icon name
  // Which product types this category works well with
  applicableTo: DetectedProductType[] | 'all';
  // Whether this category typically includes people/models (affects gender selector visibility)
  includesPeople: boolean;
}

// Result from AI product analysis
export interface ProductAnalysisResult {
  productType: DetectedProductType;
  productDescription: string;
  applicableCategories: ContentCategory[];
  suggestedDefaultCategory: ContentCategory;
}

// Extended style suggestion with category-specific metadata
export interface CategoryStyleSuggestions {
  category: ContentCategory;
  suggestions: StyleSuggestion[];
  isLoading: boolean;
  error?: string;
}

// Category configurations - defines UI and behavior for each category
export const CONTENT_CATEGORIES: CategoryConfig[] = [
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    shortLabel: 'Lifestyle',
    description: 'Authentic moments of real people using your product in their daily lives',
    icon: 'Heart',
    applicableTo: 'all',
    includesPeople: true,
  },
  {
    id: 'product',
    label: 'Product Focus',
    shortLabel: 'Product',
    description: 'Detail shots, flat lays, and beauty shots highlighting product features',
    icon: 'Camera',
    applicableTo: 'all',
    includesPeople: false,
  },
  {
    id: 'editorial',
    label: 'Editorial',
    shortLabel: 'Editorial',
    description: 'Magazine-quality photography with dramatic lighting and artistic composition',
    icon: 'Sparkles',
    applicableTo: 'all',
    includesPeople: true,
  },
  {
    id: 'ugc',
    label: 'UGC Style',
    shortLabel: 'UGC',
    description: 'Authentic user-generated content aesthetic - casual, relatable, real',
    icon: 'Smartphone',
    applicableTo: ['apparel', 'jewelry', 'accessories', 'beauty', 'food_beverage'],
    includesPeople: true,
  },
  {
    id: 'seasonal',
    label: 'Seasonal',
    shortLabel: 'Seasonal',
    description: 'Holiday themes, seasonal settings, and event-specific contexts',
    icon: 'Calendar',
    applicableTo: 'all',
    includesPeople: true,
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    shortLabel: 'Minimal',
    description: 'Clean backgrounds, elegant simplicity, focus on form and details',
    icon: 'Square',
    applicableTo: 'all',
    includesPeople: false,
  },
];

export enum AppStep {
  UPLOAD = 'UPLOAD',
  MOCKUP_GENERATION = 'MOCKUP_GENERATION',
  CAPTIONING = 'CAPTIONING',
  REVIEW = 'REVIEW',
  SUCCESS = 'SUCCESS'
}

export type SocialPlatform = 'facebook' | 'instagram';

export type ModelGender = 'male' | 'female' | 'both';

export interface SocialPost {
  platform: SocialPlatform;
  content: string;
  image: string;
  images?: string[]; // For carousel posts with multiple images
  status: 'draft' | 'posted';
}

// Post status for scheduled posts
export type PostStatus = 'scheduled' | 'published' | 'failed';

// Scheduled post data structure (mirrors Firestore document)
export interface ScheduledPost {
  id: string;
  sessionId: string;
  platforms: SocialPlatform[];
  scheduledFor: Date;
  status: PostStatus;
  captions: {
    facebook?: string;
    instagram?: string;
  };
  imageUrls: string[];
  mockupData: MockupOption[];
  createdAt: Date;
  publishedAt?: Date;
  error?: string;
}

// For creating a new scheduled post (without id, createdAt auto-generated)
export interface CreateScheduledPostData {
  platforms: SocialPlatform[];
  scheduledFor: Date;
  captions: {
    facebook?: string;
    instagram?: string;
  };
  imageUrls: string[];
  mockupData: MockupOption[];
}

// App view modes
export type AppView = 'workflow' | 'calendar' | 'gallery';

// Options for editing an existing mockup image
export interface EditMockupOptions {
  mockupImage: string;       // Base64 of the current mockup to edit
  originalGarment: string;   // Base64 of the original garment design
  editInstructions: string;  // User's instructions for what to change
  preserveGarment?: boolean; // Whether to preserve the garment exactly (default: true)
}

// =============================================================================
// BRAND PROFILE
// =============================================================================

export type BrandProfileStatus = 'not_generated' | 'generating' | 'complete' | 'error';

// Brand Identity section
export interface BrandIdentity {
  name: string;
  positioningStatement: string;
  storySummary: string;
  coreValues: string[];
  missionThemes: string[];
}

// Product Intelligence section (product-type agnostic)
export interface ProductIntelligence {
  primaryCategories: string[];           // Main product categories (apparel, jewelry, electronics, etc.)
  productCharacteristics: string[];      // Materials, craftsmanship, key features
  useCases: string[];                    // How customers use the products
  uniqueSellingPoints: string[];         // What makes products different
  signatureItems: string[];              // Key product types or hero products
  priceRange: {
    min: number;
    max: number;
    average: number;
    currency: string;
  };
}

// Market Positioning section
export interface MarketPositioning {
  targetAudience: {
    demographics: string[];              // Age, gender, location hints
    psychographics: string[];            // Lifestyle, interests, values
    lifestyle: string[];                 // How they live, what they care about
  };
  pricePositioning: 'budget' | 'mid-range' | 'premium' | 'luxury';
  geographicFocus: string[];             // Markets they seem to target
  competitivePositioning: string;        // Brief competitive stance
}

// Brand Voice & Aesthetic section
export interface BrandVoiceAesthetic {
  toneCharacteristics: string[];         // playful, sophisticated, minimalist, bold, etc.
  visualAesthetic: string;               // Description of visual style
  colorPaletteTendencies: string[];      // Color themes observed
  photographyStyle: string;              // Style of product photography
  communicationStyle: 'formal' | 'casual' | 'technical' | 'emotional' | 'mixed';
  moodKeywords: string[];                // Keywords describing the brand mood
}

// Complete Brand Profile
export interface BrandProfile {
  id: string;
  shopDomain: string;
  status: BrandProfileStatus;
  
  // Profile sections
  identity: BrandIdentity;
  productIntelligence: ProductIntelligence;
  marketPositioning: MarketPositioning;
  voiceAndAesthetic: BrandVoiceAesthetic;
  
  // Summary for quick reference
  elevatorPitch: string;                 // One-paragraph brand summary
  
  // Metadata
  generatedAt: Date;
  lastUpdatedAt: Date;
  dataSourceSummary: {
    productsAnalyzed: number;
    collectionsAnalyzed: number;
  };
  
  // Error tracking
  error?: string;
}

// =============================================================================
// SUBSCRIPTION & USAGE
// =============================================================================

/**
 * Subscription tier identifiers
 */
export type SubscriptionTier = 'free' | 'pro' | 'business';

/**
 * Configuration for each subscription tier
 * Pricing is in USD cents to avoid floating point issues
 */
export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  description: string;
  monthlyPriceCents: number;        // Price in cents (e.g., 2900 = $29)
  imageQuota: number;               // Images allowed per month
  features: string[];               // Feature list for marketing
  recommended?: boolean;            // Highlight this tier in UI
}

/**
 * Tier configurations with pricing and quotas
 * Cost per image: ~$0.135 (Gemini 3 Pro Image Preview)
 */
export const SUBSCRIPTION_TIERS: TierConfig[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out AI mockups',
    monthlyPriceCents: 0,
    imageQuota: 10,
    features: [
      '10 AI mockups per month',
      'All style categories',
      'Basic caption generation',
      'Download images',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For growing brands and creators',
    monthlyPriceCents: 2900,         // $29/month
    imageQuota: 100,
    features: [
      '100 AI mockups per month',
      'All style categories',
      'Advanced caption generation',
      'Brand profile integration',
      'Priority support',
    ],
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For agencies and high-volume sellers',
    monthlyPriceCents: 7900,         // $79/month
    imageQuota: 300,
    features: [
      '300 AI mockups per month',
      'All style categories',
      'Advanced caption generation',
      'Brand profile integration',
      'Priority support',
      'Bulk generation tools',
    ],
  },
];

/**
 * Shop subscription record stored in Firestore
 */
export interface ShopSubscription {
  tier: SubscriptionTier;
  imageQuota: number;                // Current quota (may differ from tier default if custom)
  billingCycleStart: Date;
  billingCycleEnd: Date;
  createdAt: Date;
  updatedAt: Date;
  // Billing integration fields (for future Shopify/Stripe integration)
  externalSubscriptionId?: string;   // Shopify charge ID or Stripe subscription ID
  status?: 'active' | 'cancelled' | 'past_due';
}

/**
 * Monthly usage record stored in Firestore
 * Document ID format: YYYY-MM (e.g., "2025-01")
 */
export interface UsageRecord {
  imagesGenerated: number;
  lastUpdated: Date;
}

/**
 * Result of checking if generation is allowed
 */
export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  quota: number;
  remaining: number;
  tier: SubscriptionTier;
}

/**
 * Error thrown when quota is exceeded
 */
export class QuotaExceededError extends Error {
  public readonly used: number;
  public readonly quota: number;
  public readonly tier: SubscriptionTier;

  constructor(used: number, quota: number, tier: SubscriptionTier) {
    super(`Monthly quota exceeded: ${used}/${quota} images used on ${tier} tier`);
    this.name = 'QuotaExceededError';
    this.used = used;
    this.quota = quota;
    this.tier = tier;
  }
}
