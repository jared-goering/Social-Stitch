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
}

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
