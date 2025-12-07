/**
 * Brand Profile Service
 *
 * Scans Shopify store data and uses Gemini AI to generate
 * a comprehensive brand profile for customizing AI-generated content.
 */

import { GoogleGenAI, Type, Schema } from "@google/genai";
import {
  BrandProfile,
  BrandIdentity,
  ProductIntelligence,
  MarketPositioning,
  BrandVoiceAesthetic,
  BrandProfileStatus,
} from "../types";
import {
  fetchProductsCached,
  fetchCollections,
  fetchShopInfo,
  ShopifyProduct,
  ShopifyCollection,
  ShopInfo,
} from "./shopifyProductService";
import {
  saveBrandProfile as saveToFirestore,
  getBrandProfile as getFromFirestore,
  deleteBrandProfile as deleteFromFirestore,
} from "./shopScopedStorageService";

// Progress callback type
export type GenerationProgressCallback = (stage: string, progress: number) => void;

/**
 * Generate a unique ID for the brand profile
 */
function generateProfileId(): string {
  return `brand_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract price statistics from products
 */
function analyzePricing(products: ShopifyProduct[], currency: string): ProductIntelligence['priceRange'] {
  const prices = products
    .flatMap(p => p.variants?.map(v => parseFloat(v.price)) || [])
    .filter(p => !isNaN(p) && p > 0);

  if (prices.length === 0) {
    return { min: 0, max: 0, average: 0, currency };
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const average = prices.reduce((a, b) => a + b, 0) / prices.length;

  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    average: Math.round(average * 100) / 100,
    currency,
  };
}

/**
 * Prepare product data summary for AI analysis
 */
function prepareProductDataForAI(products: ShopifyProduct[]): string {
  // Limit to first 50 products to avoid token limits
  const sampleProducts = products.slice(0, 50);
  
  const productSummaries = sampleProducts.map(p => ({
    title: p.title,
    description: p.description?.substring(0, 300) || '',
    productType: p.productType,
    vendor: p.vendor,
    tags: p.tags?.slice(0, 10) || [],
    price: p.variants?.[0]?.price || 'N/A',
  }));

  return JSON.stringify(productSummaries, null, 2);
}

/**
 * Prepare collection data for AI analysis
 */
function prepareCollectionDataForAI(collections: ShopifyCollection[]): string {
  const collectionSummaries = collections.map(c => ({
    title: c.title,
    type: c.type,
    productsCount: c.productsCount,
  }));

  return JSON.stringify(collectionSummaries, null, 2);
}

/**
 * Define the JSON schema for brand profile generation
 */
function getBrandProfileSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      identity: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The brand name" },
          positioningStatement: { type: Type.STRING, description: "A clear statement of what the brand stands for and its unique position in the market" },
          storySummary: { type: Type.STRING, description: "A brief narrative about the brand's story and origins (inferred from products/style)" },
          coreValues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 core values the brand embodies" },
          missionThemes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-4 key themes in the brand's mission" },
        },
        required: ["name", "positioningStatement", "storySummary", "coreValues", "missionThemes"],
      },
      productIntelligence: {
        type: Type.OBJECT,
        properties: {
          primaryCategories: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Main product categories (e.g., apparel, jewelry, electronics, home goods)" },
          productCharacteristics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key characteristics like materials, craftsmanship, features" },
          useCases: { type: Type.ARRAY, items: { type: Type.STRING }, description: "How customers use the products (daily wear, gifts, special occasions, etc.)" },
          uniqueSellingPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "What makes these products different (handmade, sustainable, tech-forward, etc.)" },
          signatureItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key product types or hero products that define the brand" },
        },
        required: ["primaryCategories", "productCharacteristics", "useCases", "uniqueSellingPoints", "signatureItems"],
      },
      marketPositioning: {
        type: Type.OBJECT,
        properties: {
          targetAudience: {
            type: Type.OBJECT,
            properties: {
              demographics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Age groups, gender tendencies, location hints" },
              psychographics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lifestyle interests, values, and attitudes" },
              lifestyle: { type: Type.ARRAY, items: { type: Type.STRING }, description: "How target customers live and what they care about" },
            },
            required: ["demographics", "psychographics", "lifestyle"],
          },
          pricePositioning: { type: Type.STRING, description: "One of: budget, mid-range, premium, luxury" },
          geographicFocus: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Geographic markets the brand targets" },
          competitivePositioning: { type: Type.STRING, description: "Brief description of competitive stance" },
        },
        required: ["targetAudience", "pricePositioning", "geographicFocus", "competitivePositioning"],
      },
      voiceAndAesthetic: {
        type: Type.OBJECT,
        properties: {
          toneCharacteristics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tone descriptors (playful, sophisticated, minimalist, bold, etc.)" },
          visualAesthetic: { type: Type.STRING, description: "Description of the brand's visual style" },
          colorPaletteTendencies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Color themes observed in the brand" },
          photographyStyle: { type: Type.STRING, description: "Style of product photography recommended" },
          communicationStyle: { type: Type.STRING, description: "One of: formal, casual, technical, emotional, mixed" },
          moodKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Keywords describing the brand mood and feeling" },
        },
        required: ["toneCharacteristics", "visualAesthetic", "colorPaletteTendencies", "photographyStyle", "communicationStyle", "moodKeywords"],
      },
      elevatorPitch: { type: Type.STRING, description: "A compelling one-paragraph summary of the brand" },
    },
    required: ["identity", "productIntelligence", "marketPositioning", "voiceAndAesthetic", "elevatorPitch"],
  };
}

/**
 * Generate brand profile using Gemini AI
 */
async function analyzeWithGemini(
  shopInfo: ShopInfo,
  products: ShopifyProduct[],
  collections: ShopifyCollection[],
  priceRange: ProductIntelligence['priceRange']
): Promise<Omit<BrandProfile, 'id' | 'shopDomain' | 'status' | 'generatedAt' | 'lastUpdatedAt' | 'dataSourceSummary'>> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const productData = prepareProductDataForAI(products);
  const collectionData = prepareCollectionDataForAI(collections);
  
  const prompt = `
You are a brand strategist and market analyst. Analyze the following e-commerce store data and create a comprehensive brand profile.

SHOP INFORMATION:
- Name: ${shopInfo.name}
- Domain: ${shopInfo.domain}
- Country: ${shopInfo.country}
- Currency: ${shopInfo.currency}
- Price Range: ${priceRange.currency} ${priceRange.min} - ${priceRange.max} (avg: ${priceRange.average})

PRODUCT CATALOG (sample of ${products.length} products):
${productData}

COLLECTIONS:
${collectionData}

Based on this data, create a detailed brand profile. Be specific and insightful:

1. IDENTITY: Infer the brand's positioning, story, values, and mission from the product catalog
2. PRODUCT INTELLIGENCE: Analyze what types of products they sell, their characteristics, use cases, and what makes them unique. Be product-type agnostic - this could be apparel, jewelry, electronics, food, home goods, or any other e-commerce category.
3. MARKET POSITIONING: Determine target audience, price positioning (${priceRange.average > 200 ? 'likely premium/luxury' : priceRange.average > 50 ? 'likely mid-range to premium' : 'likely budget to mid-range'}), and geographic focus
4. VOICE & AESTHETIC: Analyze the tone, visual style, and mood from product descriptions and naming conventions

Be creative but grounded in the actual data provided. Make inferences that would help create on-brand marketing content.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: getBrandProfileSchema(),
    },
  });

  const jsonText = response.text || "{}";
  const parsed = JSON.parse(jsonText);
  
  // Validate and normalize the response
  const identity: BrandIdentity = {
    name: parsed.identity?.name || shopInfo.name,
    positioningStatement: parsed.identity?.positioningStatement || '',
    storySummary: parsed.identity?.storySummary || '',
    coreValues: parsed.identity?.coreValues || [],
    missionThemes: parsed.identity?.missionThemes || [],
  };

  const productIntelligence: ProductIntelligence = {
    primaryCategories: parsed.productIntelligence?.primaryCategories || [],
    productCharacteristics: parsed.productIntelligence?.productCharacteristics || [],
    useCases: parsed.productIntelligence?.useCases || [],
    uniqueSellingPoints: parsed.productIntelligence?.uniqueSellingPoints || [],
    signatureItems: parsed.productIntelligence?.signatureItems || [],
    priceRange,
  };

  const marketPositioning: MarketPositioning = {
    targetAudience: {
      demographics: parsed.marketPositioning?.targetAudience?.demographics || [],
      psychographics: parsed.marketPositioning?.targetAudience?.psychographics || [],
      lifestyle: parsed.marketPositioning?.targetAudience?.lifestyle || [],
    },
    pricePositioning: validatePricePositioning(parsed.marketPositioning?.pricePositioning),
    geographicFocus: parsed.marketPositioning?.geographicFocus || [shopInfo.country],
    competitivePositioning: parsed.marketPositioning?.competitivePositioning || '',
  };

  const voiceAndAesthetic: BrandVoiceAesthetic = {
    toneCharacteristics: parsed.voiceAndAesthetic?.toneCharacteristics || [],
    visualAesthetic: parsed.voiceAndAesthetic?.visualAesthetic || '',
    colorPaletteTendencies: parsed.voiceAndAesthetic?.colorPaletteTendencies || [],
    photographyStyle: parsed.voiceAndAesthetic?.photographyStyle || '',
    communicationStyle: validateCommunicationStyle(parsed.voiceAndAesthetic?.communicationStyle),
    moodKeywords: parsed.voiceAndAesthetic?.moodKeywords || [],
  };

  return {
    identity,
    productIntelligence,
    marketPositioning,
    voiceAndAesthetic,
    elevatorPitch: parsed.elevatorPitch || '',
  };
}

/**
 * Validate price positioning value
 */
function validatePricePositioning(value: string): MarketPositioning['pricePositioning'] {
  const valid = ['budget', 'mid-range', 'premium', 'luxury'];
  if (valid.includes(value)) {
    return value as MarketPositioning['pricePositioning'];
  }
  return 'mid-range';
}

/**
 * Validate communication style value
 */
function validateCommunicationStyle(value: string): BrandVoiceAesthetic['communicationStyle'] {
  const valid = ['formal', 'casual', 'technical', 'emotional', 'mixed'];
  if (valid.includes(value)) {
    return value as BrandVoiceAesthetic['communicationStyle'];
  }
  return 'mixed';
}

/**
 * Generate a complete brand profile by scanning the Shopify store
 */
export async function generateBrandProfile(
  shopDomain: string,
  onProgress?: GenerationProgressCallback
): Promise<BrandProfile> {
  const profileId = generateProfileId();
  
  try {
    // Stage 1: Fetch shop info
    onProgress?.('Fetching shop information...', 10);
    const { shop: shopInfo } = await fetchShopInfo();
    
    // Stage 2: Fetch products
    onProgress?.('Loading product catalog...', 25);
    const products = await fetchProductsCached({ 
      loadAll: true,
      onProgress: (loaded) => {
        const progress = Math.min(25 + (loaded / 100) * 25, 50);
        onProgress?.(`Loaded ${loaded} products...`, progress);
      }
    });
    
    // Stage 3: Fetch collections
    onProgress?.('Analyzing collections...', 55);
    const { collections } = await fetchCollections();
    
    // Stage 4: Analyze pricing
    onProgress?.('Analyzing pricing strategy...', 60);
    const priceRange = analyzePricing(products, shopInfo.currency);
    
    // Stage 5: AI Analysis
    onProgress?.('Generating brand insights with AI...', 70);
    const aiProfile = await analyzeWithGemini(shopInfo, products, collections, priceRange);
    
    // Stage 6: Build complete profile
    onProgress?.('Finalizing brand profile...', 90);
    const now = new Date();
    
    const profile: BrandProfile = {
      id: profileId,
      shopDomain,
      status: 'complete',
      ...aiProfile,
      generatedAt: now,
      lastUpdatedAt: now,
      dataSourceSummary: {
        productsAnalyzed: products.length,
        collectionsAnalyzed: collections.length,
      },
    };
    
    // Stage 7: Save to Firestore
    onProgress?.('Saving brand profile...', 95);
    await saveToFirestore(profile);
    
    onProgress?.('Complete!', 100);
    return profile;
    
  } catch (error: any) {
    console.error('[brandProfileService] Error generating profile:', error);
    
    // Create an error profile
    const errorProfile: BrandProfile = {
      id: profileId,
      shopDomain,
      status: 'error',
      identity: {
        name: '',
        positioningStatement: '',
        storySummary: '',
        coreValues: [],
        missionThemes: [],
      },
      productIntelligence: {
        primaryCategories: [],
        productCharacteristics: [],
        useCases: [],
        uniqueSellingPoints: [],
        signatureItems: [],
        priceRange: { min: 0, max: 0, average: 0, currency: 'USD' },
      },
      marketPositioning: {
        targetAudience: {
          demographics: [],
          psychographics: [],
          lifestyle: [],
        },
        pricePositioning: 'mid-range',
        geographicFocus: [],
        competitivePositioning: '',
      },
      voiceAndAesthetic: {
        toneCharacteristics: [],
        visualAesthetic: '',
        colorPaletteTendencies: [],
        photographyStyle: '',
        communicationStyle: 'mixed',
        moodKeywords: [],
      },
      elevatorPitch: '',
      generatedAt: new Date(),
      lastUpdatedAt: new Date(),
      dataSourceSummary: {
        productsAnalyzed: 0,
        collectionsAnalyzed: 0,
      },
      error: error.message || 'Unknown error occurred',
    };
    
    throw error;
  }
}

/**
 * Get existing brand profile
 */
export async function getBrandProfile(): Promise<BrandProfile | null> {
  return getFromFirestore();
}

/**
 * Check if a brand profile exists and is complete
 */
export async function hasBrandProfile(): Promise<boolean> {
  const profile = await getFromFirestore();
  return profile !== null && profile.status === 'complete';
}

/**
 * Delete the brand profile
 */
export async function deleteBrandProfile(): Promise<void> {
  await deleteFromFirestore();
}

// =============================================================================
// SECTION REGENERATION
// =============================================================================

export type BrandProfileSection = 'identity' | 'productIntelligence' | 'marketPositioning' | 'voiceAndAesthetic';

/**
 * Get section-specific schema for regeneration
 */
function getSectionSchema(section: BrandProfileSection): Schema {
  switch (section) {
    case 'identity':
      return {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The brand name" },
          positioningStatement: { type: Type.STRING, description: "A clear statement of what the brand stands for" },
          storySummary: { type: Type.STRING, description: "A brief narrative about the brand's story" },
          coreValues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 core values" },
          missionThemes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-4 mission themes" },
        },
        required: ["name", "positioningStatement", "storySummary", "coreValues", "missionThemes"],
      };
    case 'productIntelligence':
      return {
        type: Type.OBJECT,
        properties: {
          primaryCategories: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Main product categories" },
          productCharacteristics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key characteristics" },
          useCases: { type: Type.ARRAY, items: { type: Type.STRING }, description: "How customers use products" },
          uniqueSellingPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "What makes products unique" },
          signatureItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key product types" },
        },
        required: ["primaryCategories", "productCharacteristics", "useCases", "uniqueSellingPoints", "signatureItems"],
      };
    case 'marketPositioning':
      return {
        type: Type.OBJECT,
        properties: {
          targetAudience: {
            type: Type.OBJECT,
            properties: {
              demographics: { type: Type.ARRAY, items: { type: Type.STRING } },
              psychographics: { type: Type.ARRAY, items: { type: Type.STRING } },
              lifestyle: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["demographics", "psychographics", "lifestyle"],
          },
          pricePositioning: { type: Type.STRING, description: "One of: budget, mid-range, premium, luxury" },
          geographicFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
          competitivePositioning: { type: Type.STRING },
        },
        required: ["targetAudience", "pricePositioning", "geographicFocus", "competitivePositioning"],
      };
    case 'voiceAndAesthetic':
      return {
        type: Type.OBJECT,
        properties: {
          toneCharacteristics: { type: Type.ARRAY, items: { type: Type.STRING } },
          visualAesthetic: { type: Type.STRING },
          colorPaletteTendencies: { type: Type.ARRAY, items: { type: Type.STRING } },
          photographyStyle: { type: Type.STRING },
          communicationStyle: { type: Type.STRING, description: "One of: formal, casual, technical, emotional, mixed" },
          moodKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["toneCharacteristics", "visualAesthetic", "colorPaletteTendencies", "photographyStyle", "communicationStyle", "moodKeywords"],
      };
  }
}

/**
 * Get section-specific prompt for regeneration
 */
function getSectionPrompt(
  section: BrandProfileSection,
  currentProfile: BrandProfile,
  userContext: string
): string {
  const baseContext = `
You are refining a specific section of an existing brand profile.

CURRENT BRAND OVERVIEW:
- Brand: ${currentProfile.identity.name}
- Elevator Pitch: ${currentProfile.elevatorPitch}
- Price Range: ${currentProfile.productIntelligence.priceRange.currency} ${currentProfile.productIntelligence.priceRange.min} - ${currentProfile.productIntelligence.priceRange.max}
- Products Analyzed: ${currentProfile.dataSourceSummary.productsAnalyzed}

USER'S ADDITIONAL CONTEXT/GUIDANCE:
${userContext}

Based on the user's guidance, regenerate ONLY the specified section while keeping it consistent with the overall brand.
`;

  switch (section) {
    case 'identity':
      return `${baseContext}
      
CURRENT IDENTITY SECTION:
- Positioning: ${currentProfile.identity.positioningStatement}
- Story: ${currentProfile.identity.storySummary}
- Values: ${currentProfile.identity.coreValues.join(', ')}

Regenerate the Brand Identity section with the user's guidance in mind. 
Focus on: name, positioning statement, brand story, core values, and mission themes.`;

    case 'productIntelligence':
      return `${baseContext}
      
CURRENT PRODUCT INTELLIGENCE:
- Categories: ${currentProfile.productIntelligence.primaryCategories.join(', ')}
- Use Cases: ${currentProfile.productIntelligence.useCases.join(', ')}
- USPs: ${currentProfile.productIntelligence.uniqueSellingPoints.join(', ')}

Regenerate the Product Intelligence section with the user's guidance in mind.
Focus on: product categories, characteristics, use cases, unique selling points, and signature items.`;

    case 'marketPositioning':
      return `${baseContext}
      
CURRENT MARKET POSITIONING:
- Demographics: ${currentProfile.marketPositioning.targetAudience.demographics.join(', ')}
- Price Position: ${currentProfile.marketPositioning.pricePositioning}
- Geographic Focus: ${currentProfile.marketPositioning.geographicFocus.join(', ')}

Regenerate the Target Audience/Market Positioning section with the user's guidance in mind.
Focus on: demographics, psychographics, lifestyle, price positioning, geographic focus, and competitive positioning.`;

    case 'voiceAndAesthetic':
      return `${baseContext}
      
CURRENT VOICE & AESTHETIC:
- Tone: ${currentProfile.voiceAndAesthetic.toneCharacteristics.join(', ')}
- Visual: ${currentProfile.voiceAndAesthetic.visualAesthetic}
- Colors: ${currentProfile.voiceAndAesthetic.colorPaletteTendencies.join(', ')}

Regenerate the Voice & Aesthetic section with the user's guidance in mind.
Focus on: tone characteristics, visual aesthetic, color palette, photography style, communication style, and mood keywords.`;
  }
}

/**
 * Regenerate a specific section of the brand profile with user context
 */
export async function regenerateSection(
  section: BrandProfileSection,
  currentProfile: BrandProfile,
  userContext: string
): Promise<BrandProfile> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = getSectionPrompt(section, currentProfile, userContext);
  const schema = getSectionSchema(section);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const jsonText = response.text || "{}";
  const parsed = JSON.parse(jsonText);
  
  // Update the specific section in the profile
  const updatedProfile: BrandProfile = {
    ...currentProfile,
    lastUpdatedAt: new Date(),
  };
  
  switch (section) {
    case 'identity':
      updatedProfile.identity = {
        name: parsed.name || currentProfile.identity.name,
        positioningStatement: parsed.positioningStatement || currentProfile.identity.positioningStatement,
        storySummary: parsed.storySummary || currentProfile.identity.storySummary,
        coreValues: parsed.coreValues || currentProfile.identity.coreValues,
        missionThemes: parsed.missionThemes || currentProfile.identity.missionThemes,
      };
      break;
    case 'productIntelligence':
      updatedProfile.productIntelligence = {
        ...currentProfile.productIntelligence, // Keep priceRange
        primaryCategories: parsed.primaryCategories || currentProfile.productIntelligence.primaryCategories,
        productCharacteristics: parsed.productCharacteristics || currentProfile.productIntelligence.productCharacteristics,
        useCases: parsed.useCases || currentProfile.productIntelligence.useCases,
        uniqueSellingPoints: parsed.uniqueSellingPoints || currentProfile.productIntelligence.uniqueSellingPoints,
        signatureItems: parsed.signatureItems || currentProfile.productIntelligence.signatureItems,
      };
      break;
    case 'marketPositioning':
      updatedProfile.marketPositioning = {
        targetAudience: {
          demographics: parsed.targetAudience?.demographics || currentProfile.marketPositioning.targetAudience.demographics,
          psychographics: parsed.targetAudience?.psychographics || currentProfile.marketPositioning.targetAudience.psychographics,
          lifestyle: parsed.targetAudience?.lifestyle || currentProfile.marketPositioning.targetAudience.lifestyle,
        },
        pricePositioning: validatePricePositioning(parsed.pricePositioning) || currentProfile.marketPositioning.pricePositioning,
        geographicFocus: parsed.geographicFocus || currentProfile.marketPositioning.geographicFocus,
        competitivePositioning: parsed.competitivePositioning || currentProfile.marketPositioning.competitivePositioning,
      };
      break;
    case 'voiceAndAesthetic':
      updatedProfile.voiceAndAesthetic = {
        toneCharacteristics: parsed.toneCharacteristics || currentProfile.voiceAndAesthetic.toneCharacteristics,
        visualAesthetic: parsed.visualAesthetic || currentProfile.voiceAndAesthetic.visualAesthetic,
        colorPaletteTendencies: parsed.colorPaletteTendencies || currentProfile.voiceAndAesthetic.colorPaletteTendencies,
        photographyStyle: parsed.photographyStyle || currentProfile.voiceAndAesthetic.photographyStyle,
        communicationStyle: validateCommunicationStyle(parsed.communicationStyle) || currentProfile.voiceAndAesthetic.communicationStyle,
        moodKeywords: parsed.moodKeywords || currentProfile.voiceAndAesthetic.moodKeywords,
      };
      break;
  }
  
  // Save updated profile
  await saveToFirestore(updatedProfile);
  
  return updatedProfile;
}

/**
 * Regenerate the elevator pitch based on current profile sections
 */
export async function regenerateElevatorPitch(
  currentProfile: BrandProfile,
  userContext?: string
): Promise<BrandProfile> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
Based on this brand profile, write a compelling one-paragraph elevator pitch (2-4 sentences).

BRAND: ${currentProfile.identity.name}
POSITIONING: ${currentProfile.identity.positioningStatement}
PRODUCTS: ${currentProfile.productIntelligence.primaryCategories.join(', ')}
TARGET: ${currentProfile.marketPositioning.targetAudience.demographics.join(', ')}
TONE: ${currentProfile.voiceAndAesthetic.toneCharacteristics.join(', ')}
${userContext ? `\nUSER GUIDANCE: ${userContext}` : ''}

Write the elevator pitch in the brand's voice. Make it memorable and compelling.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          elevatorPitch: { type: Type.STRING, description: "A compelling one-paragraph brand summary" },
        },
        required: ["elevatorPitch"],
      },
    },
  });

  const jsonText = response.text || "{}";
  const parsed = JSON.parse(jsonText);
  
  const updatedProfile: BrandProfile = {
    ...currentProfile,
    elevatorPitch: parsed.elevatorPitch || currentProfile.elevatorPitch,
    lastUpdatedAt: new Date(),
  };
  
  await saveToFirestore(updatedProfile);
  
  return updatedProfile;
}

