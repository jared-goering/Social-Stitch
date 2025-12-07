import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedCaptions, StyleSuggestion, ModelGender, CaptionGenerationOptions, CaptionTone, EditMockupOptions, BrandProfile, ContentCategory, DetectedProductType, ProductAnalysisResult, QuotaExceededError } from "../types";
import { enforceQuota, incrementUsage, canGenerateImage } from "./subscriptionService";

// Re-export quota checking for UI components
export { canGenerateImage } from "./subscriptionService";
export { QuotaExceededError } from "../types";

// =============================================================================
// BRAND CONTEXT BUILDER
// =============================================================================

/**
 * Context objects for different AI generation functions
 */
interface ImageGenerationBrandContext {
  photographyDirection: string;
  visualAesthetic: string;
  colorGuidance: string;
  moodAtmosphere: string;
  audienceLifestyle: string;
}

interface StyleSuggestionBrandContext {
  lifestyleActivities: string;
  useCases: string;
  toneAndMood: string;
  colorHarmony: string;
  targetAudience: string;
}

interface CaptionBrandContext {
  voiceDirection: string;
  brandPositioning: string;
  communicationStyle: string;
  moodKeywords: string;
  audienceProfile: string;
}

/**
 * Builds brand-specific context for image generation prompts.
 * Extracts and formats the most relevant brand profile data for visual content.
 */
export function buildImageGenerationContext(profile: BrandProfile): ImageGenerationBrandContext {
  const { voiceAndAesthetic, marketPositioning, productIntelligence } = profile;
  
  return {
    photographyDirection: voiceAndAesthetic.photographyStyle || '',
    visualAesthetic: voiceAndAesthetic.visualAesthetic || '',
    colorGuidance: voiceAndAesthetic.colorPaletteTendencies.length > 0
      ? `Color palette: ${voiceAndAesthetic.colorPaletteTendencies.join(', ')}`
      : '',
    moodAtmosphere: voiceAndAesthetic.moodKeywords.length > 0
      ? `Mood: ${voiceAndAesthetic.moodKeywords.join(', ')}`
      : '',
    audienceLifestyle: marketPositioning.targetAudience.lifestyle.length > 0
      ? `Target audience lifestyle: ${marketPositioning.targetAudience.lifestyle.join(', ')}`
      : '',
  };
}

/**
 * Builds brand-specific context for style suggestion prompts.
 * Focuses on lifestyle, use cases, and audience preferences.
 */
export function buildStyleSuggestionContext(profile: BrandProfile): StyleSuggestionBrandContext {
  const { voiceAndAesthetic, marketPositioning, productIntelligence } = profile;
  
  return {
    lifestyleActivities: marketPositioning.targetAudience.lifestyle.length > 0
      ? marketPositioning.targetAudience.lifestyle.join(', ')
      : '',
    useCases: productIntelligence.useCases.length > 0
      ? productIntelligence.useCases.join(', ')
      : '',
    toneAndMood: voiceAndAesthetic.toneCharacteristics.length > 0
      ? voiceAndAesthetic.toneCharacteristics.join(', ')
      : '',
    colorHarmony: voiceAndAesthetic.colorPaletteTendencies.length > 0
      ? voiceAndAesthetic.colorPaletteTendencies.join(', ')
      : '',
    targetAudience: [
      ...marketPositioning.targetAudience.demographics,
      ...marketPositioning.targetAudience.psychographics.slice(0, 3)
    ].join(', ') || '',
  };
}

/**
 * Builds brand-specific context for caption generation prompts.
 * Focuses on voice, tone, and communication style.
 */
export function buildCaptionContext(profile: BrandProfile): CaptionBrandContext {
  const { voiceAndAesthetic, marketPositioning, identity } = profile;
  
  // Map communication style to descriptive guidance
  const communicationGuidance: Record<string, string> = {
    formal: 'Use formal, professional language. Maintain a polished and sophisticated tone.',
    casual: 'Use casual, conversational language. Be friendly and approachable.',
    technical: 'Include technical details and specifications. Appeal to informed buyers.',
    emotional: 'Create emotional connections. Use storytelling and evocative language.',
    mixed: 'Balance professional credibility with approachable warmth.',
  };
  
  return {
    voiceDirection: voiceAndAesthetic.toneCharacteristics.length > 0
      ? `Brand voice: ${voiceAndAesthetic.toneCharacteristics.join(', ')}`
      : '',
    brandPositioning: identity.positioningStatement || '',
    communicationStyle: communicationGuidance[voiceAndAesthetic.communicationStyle] || '',
    moodKeywords: voiceAndAesthetic.moodKeywords.length > 0
      ? voiceAndAesthetic.moodKeywords.join(', ')
      : '',
    audienceProfile: [
      ...marketPositioning.targetAudience.demographics.slice(0, 2),
      ...marketPositioning.targetAudience.psychographics.slice(0, 2)
    ].join(', ') || '',
  };
}

/**
 * Generates a complete brand context block for image generation prompts.
 * Returns an empty string if no brand profile is provided.
 */
export function formatImageBrandContext(profile?: BrandProfile): string {
  if (!profile) return '';
  
  const ctx = buildImageGenerationContext(profile);
  const parts: string[] = [];
  
  if (ctx.photographyDirection) {
    parts.push(`BRAND PHOTOGRAPHY STYLE: ${ctx.photographyDirection}`);
  }
  if (ctx.visualAesthetic) {
    parts.push(`VISUAL AESTHETIC: ${ctx.visualAesthetic}`);
  }
  if (ctx.colorGuidance) {
    parts.push(ctx.colorGuidance);
  }
  if (ctx.moodAtmosphere) {
    parts.push(ctx.moodAtmosphere);
  }
  if (ctx.audienceLifestyle) {
    parts.push(ctx.audienceLifestyle);
  }
  
  if (parts.length === 0) return '';
  
  return `
      BRAND CONTEXT (use this to inform the visual style):
      ${parts.join('\n      ')}
  `;
}

/**
 * Generates a complete brand context block for style suggestion prompts.
 * This is intentionally light - it provides brand flavor without being prescriptive.
 * The garment's unique characteristics should drive the suggestions, not the brand profile.
 * Returns an empty string if no brand profile is provided.
 */
export function formatStyleBrandContext(profile?: BrandProfile): string {
  if (!profile) return '';
  
  const ctx = buildStyleSuggestionContext(profile);
  const parts: string[] = [];
  
  // Only include tone/mood and audience demographics - NOT specific activities
  // This prevents all suggestions from being the same "outdoor adventure" type
  if (ctx.targetAudience) {
    parts.push(`Target demographic: ${ctx.targetAudience}`);
  }
  if (ctx.toneAndMood) {
    parts.push(`Brand mood: ${ctx.toneAndMood}`);
  }
  if (ctx.colorHarmony) {
    parts.push(`Brand color palette: ${ctx.colorHarmony}`);
  }
  
  if (parts.length === 0) return '';
  
  return `
      BRAND FLAVOR (subtle guidance, not a prescription):
      ${parts.join('\n      ')}
      
      Note: Use brand context as subtle flavor, but let the GARMENT'S unique design drive the scene choices.
  `;
}

/**
 * Generates a complete brand context block for caption generation prompts.
 * Returns an empty string if no brand profile is provided.
 */
export function formatCaptionBrandContext(profile?: BrandProfile): string {
  if (!profile) return '';
  
  const ctx = buildCaptionContext(profile);
  const parts: string[] = [];
  
  if (ctx.voiceDirection) {
    parts.push(ctx.voiceDirection);
  }
  if (ctx.brandPositioning) {
    parts.push(`Brand positioning: ${ctx.brandPositioning}`);
  }
  if (ctx.communicationStyle) {
    parts.push(`Communication style: ${ctx.communicationStyle}`);
  }
  if (ctx.audienceProfile) {
    parts.push(`Target audience: ${ctx.audienceProfile}`);
  }
  if (ctx.moodKeywords) {
    parts.push(`Brand mood: ${ctx.moodKeywords}`);
  }
  
  if (parts.length === 0) return '';
  
  return `
      BRAND VOICE CONTEXT (write captions that embody this brand):
      ${parts.join('\n      ')}
      
      CRITICAL: Every caption must feel authentically on-brand. The voice should be consistent
      with how this brand communicates - not generic social media copy. Make the audience feel
      like the brand truly understands them.
  `;
}

// =============================================================================
// TONE PRESETS
// =============================================================================

// Map tone presets to descriptive instructions
const toneInstructions: Record<CaptionTone, string> = {
  default: '',
  professional: 'Write in a professional, polished tone. Use clear, confident language suitable for business audiences. Avoid slang and keep it sophisticated.',
  casual: 'Write in a casual, friendly tone. Use conversational language like you\'re talking to a friend. Feel relaxed and approachable.',
  funny: 'Write in a humorous, witty tone. Use puns, jokes, or playful language. Make readers smile or laugh while still showcasing the product.',
  inspiring: 'Write in an inspiring, motivational tone. Use uplifting language that empowers and encourages. Create an emotional connection.',
  urgent: 'Write with urgency and FOMO (fear of missing out). Use action words, limited-time language, and create excitement. Make readers feel they need to act now.',
  minimalist: 'Write in a minimalist, clean tone. Use short, impactful phrases. Less is more - be concise and let the image speak.',
};

/**
 * Options for mockup image generation
 */
export interface MockupGenerationOptions {
  gender?: ModelGender;
  brandProfile?: BrandProfile;
}

/**
 * Generates a lifestyle mockup based on the uploaded design.
 * Uses Gemini 3 Pro Image Preview (Nano Banana Pro) for high-fidelity composition.
 * 
 * When a brandProfile is provided, the prompt is enhanced with brand-specific
 * photography style, visual aesthetic, color guidance, and target audience lifestyle.
 * 
 * QUOTA ENFORCEMENT: This function checks and enforces the user's monthly image quota.
 * Throws QuotaExceededError if the quota is exhausted.
 */
export const generateMockupImage = async (
  base64Design: string,
  stylePrompt: string,
  genderOrOptions?: ModelGender | MockupGenerationOptions
): Promise<string> => {
  // Enforce quota before generating
  await enforceQuota();
  
  // Handle both old signature (gender only) and new signature (options object)
  let gender: ModelGender | undefined;
  let brandProfile: BrandProfile | undefined;
  
  if (typeof genderOrOptions === 'object') {
    gender = genderOrOptions.gender;
    brandProfile = genderOrOptions.brandProfile;
  } else {
    gender = genderOrOptions;
  }
  
  // Always create a new instance to ensure the latest API key is used
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  const ai = new GoogleGenAI({ apiKey });

  // Build gender instruction based on parameter
  const genderInstruction = gender === 'male' 
    ? 'The model should be male.'
    : gender === 'female' 
    ? 'The model should be female.'
    : '';
  
  // Build brand context if profile is provided
  const brandContext = formatImageBrandContext(brandProfile);

  try {
    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64Design = base64Design.includes(',') ? base64Design.split(',')[1] : base64Design;
    // Detect mime type from data URL or default to png
    const mimeTypeMatch = base64Design.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const detectedMimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

    const prompt = `
      You are a lifestyle and editorial photographer capturing authentic, candid moments.
      Task: Create a photorealistic LIFESTYLE image featuring someone wearing the EXACT garment shown in the reference image.
      ${brandContext}
      CRITICAL STYLE DIRECTION - LIFESTYLE NOT PORTRAIT:
      - This is NOT a model photoshoot or fashion portrait. Avoid posed, model-centric shots where the person stares at the camera.
      - Create a CANDID MOMENT - the person should be engaged in an activity, interacting with their environment, or captured mid-action.
      - The person should feel like a character in a story, not a model on display.
      - Show more of the environment and scene - the setting is just as important as the person.
      - Use wider framing or environmental portraits rather than tight headshots.
      - The person can be looking away, walking, laughing, reaching for something, sitting casually, etc.
      
      GARMENT INSTRUCTIONS:
      1. The reference image contains a specific piece of apparel (t-shirt/hoodie/top).
      2. PRINT VISIBILITY: First, analyze where the main graphic/print/design is located on the garment:
         - If the design is on the FRONT of the garment: Position the person so the front print is visible (but they don't need to face the camera directly).
         - If the design is on the BACK of the garment: Position the person with their back partially or fully visible.
         - The print/design should be visible but naturally integrated into the scene.
      3. Dress a realistic person in this EXACT garment. ${genderInstruction}
      4. CRITICAL: Preserve the cut, style, fabric texture, color, and graphic design of the uploaded garment perfectly. Do not generate a generic t-shirt.
      
      SCENE & MOOD:
      5. Setting description: ${stylePrompt}
      6. Add lifestyle elements: other people in background, environmental details, props that fit the scene, movement.
      7. Lighting should feel natural and authentic to the setting - golden hour, overcast, natural window light, etc.
      8. Capture a genuine moment - someone living their life, not posing for a photo.
      9. Do not add any text overlays, watermarks, or extra graphics.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            text: prompt
          },
          {
            inlineData: {
              mimeType: detectedMimeType,
              data: cleanBase64Design
            }
          }
        ]
      },
      config: {
        imageConfig: {
            aspectRatio: "3:4", // Better for fashion/vertical social content
            imageSize: "2K"     // High quality for "Pro" model
        }
      }
    });

    // Extract the image from the response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        // Increment usage after successful generation
        await incrementUsage();
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image generated.");
  } catch (error) {
    console.error("Error generating mockup:", error);
    throw error;
  }
};

/**
 * Edits an existing mockup image based on user instructions.
 * Uses Gemini to modify the image while preserving the garment design.
 * 
 * QUOTA ENFORCEMENT: This function checks and enforces the user's monthly image quota.
 * Throws QuotaExceededError if the quota is exhausted.
 */
export const editMockupImage = async (
  options: EditMockupOptions
): Promise<string> => {
  // Enforce quota before editing (edits count against quota)
  await enforceQuota();
  
  const { mockupImage, originalGarment, editInstructions, preserveGarment = true } = options;
  
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  const ai = new GoogleGenAI({ apiKey });

  try {
    // Strip data URL prefixes and detect mime types
    const cleanMockupImage = mockupImage.includes(',') ? mockupImage.split(',')[1] : mockupImage;
    const mockupMimeMatch = mockupImage.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const mockupMimeType = mockupMimeMatch ? mockupMimeMatch[1] : 'image/png';

    const cleanGarmentImage = originalGarment.includes(',') ? originalGarment.split(',')[1] : originalGarment;
    const garmentMimeMatch = originalGarment.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const garmentMimeType = garmentMimeMatch ? garmentMimeMatch[1] : 'image/png';

    const garmentPreservation = preserveGarment 
      ? `CRITICAL: The person MUST be wearing the EXACT same garment as shown in the second reference image. 
         Preserve the garment's design, colors, graphics, and style EXACTLY as it appears.
         Only change what the user has specifically requested - keep everything else about the garment identical.`
      : `You may adjust the garment slightly to match the new scene, but keep it recognizable as the same design.`;

    const prompt = `
      You are an expert photo editor and lifestyle photographer.
      
      TASK: Edit the first image (the mockup) based on the user's instructions while maintaining high quality.
      
      USER'S EDIT REQUEST: ${editInstructions}
      
      ${garmentPreservation}
      
      EDITING GUIDELINES:
      1. Apply ONLY the changes the user has requested
      2. Maintain the overall quality and photorealistic style of the original image
      3. Keep the same aspect ratio and composition unless specifically asked to change it
      4. Preserve natural lighting and shadows that match the scene
      5. Ensure any changes blend seamlessly with the existing image
      6. The result should look like a professional lifestyle photograph
      
      REFERENCE IMAGES:
      - First image: The current mockup that needs editing
      - Second image: The original garment design (for reference to preserve the garment accurately)
      
      Generate an edited version of the mockup that incorporates the user's requested changes.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mockupMimeType,
              data: cleanMockupImage
            }
          },
          {
            inlineData: {
              mimeType: garmentMimeType,
              data: cleanGarmentImage
            }
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "2K"
        }
      }
    });

    // Extract the image from the response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        // Increment usage after successful edit
        await incrementUsage();
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No edited image generated.");
  } catch (error) {
    console.error("Error editing mockup:", error);
    throw error;
  }
};

/**
 * Analyzes the uploaded garment and suggests relevant mockup styles.
 * Uses Gemini to understand the garment's characteristics and recommend fitting scenes.
 * 
 * When a brandProfile is provided, suggestions are tailored to the brand's target audience,
 * use cases, tone, and color palette for on-brand lifestyle scenarios.
 */
export const analyzeGarmentAndSuggestStyles = async (
  base64Design: string,
  brandProfile?: BrandProfile
): Promise<StyleSuggestion[]> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  const ai = new GoogleGenAI({ apiKey });
  
  // Build brand context if profile is provided
  const brandContext = formatStyleBrandContext(brandProfile);

  try {
    const responseSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "A short, catchy title for the style (2-4 words)",
          },
          description: {
            type: Type.STRING,
            description: "A detailed scene description for the mockup prompt including background, lighting, and mood",
          },
          reasoning: {
            type: Type.STRING,
            description: "Brief explanation of why this style matches the garment and brand",
          },
        },
        required: ["title", "description", "reasoning"],
      },
    };

    const prompt = `
      STEP 1 - ANALYZE THIS SPECIFIC GARMENT IN DETAIL:
      Look closely at the image and identify:
      - What specific graphic, text, or design is printed on it? (This is crucial!)
      - What colors are in the design?
      - What vibe does the specific design suggest? (vintage, humorous, patriotic, artistic, sporty, etc.)
      - What type of person would wear THIS specific design?
      
      STEP 2 - SUGGEST 5 DIVERSE SCENES:
      Based on your garment analysis, suggest 5 DIFFERENT lifestyle photography scenes.
      
      CRITICAL - DIVERSITY REQUIREMENT:
      - Each scene must be in a DIFFERENT type of location/environment
      - Vary the activities: mix indoor/outdoor, social/solo, active/relaxed
      - Don't make all suggestions the same theme - if one is outdoors, make another urban, another at home, etc.
      - The GARMENT'S DESIGN should inspire the scenes, not generic brand themes
      
      SCENE TYPES TO DRAW FROM (use variety):
      - Urban: coffee shops, city streets, rooftops, markets, art galleries
      - Social: with friends, at events, parties, gatherings
      - Outdoor: parks, beaches, trails, camping (but don't overuse if design doesn't suggest it)
      - Casual: at home, cooking, reading, morning routines
      - Active: sports, fitness, adventures
      - Work/Creative: studios, workspaces, creative activities
      
      IMPORTANT - LIFESTYLE FOCUS:
      - Suggest scenes where a person is DOING something, not just posing
      - Think editorial/documentary style, not model photoshoots
      - The person should feel like they're living their life, captured in a moment
      ${brandContext}
      Each suggestion should include:
      1. A catchy title (2-4 words, specific to the scene)
      2. A detailed LIFESTYLE scene description including:
         - What activity the person is doing
         - The environmental setting with specific details
         - Lighting and time of day
         - Mood and energy
      3. Brief reasoning on why this specific scene complements THIS garment's design
      
      REMEMBER: The design on this specific garment should drive your suggestions.
      A shirt with a mountain graphic suggests different scenes than a shirt with a retro logo or funny text.
    `;

    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64Design = base64Design.includes(',') ? base64Design.split(',')[1] : base64Design;
    // Detect mime type from data URL or default to png
    const mimeTypeMatch = base64Design.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const detectedMimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: detectedMimeType,
              data: cleanBase64Design
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text || "[]";
    return JSON.parse(jsonText) as StyleSuggestion[];

  } catch (error) {
    console.error("Error analyzing garment:", error);
    // Return empty array to fall back to preset styles
    return [];
  }
};

// =============================================================================
// CATEGORY-SPECIFIC PROMPT TEMPLATES
// =============================================================================

const CATEGORY_PROMPTS: Record<ContentCategory, string> = {
  lifestyle: `
    CONTENT TYPE: LIFESTYLE
    Create scenes showing real people USING or WEARING the product in authentic daily life moments.
    
    FOR APPAREL/WEARABLES: Person wearing the item while doing activities - walking, laughing with friends, 
    working at a coffee shop, hiking, at a party, etc. Candid, documentary-style shots.
    
    FOR JEWELRY/ACCESSORIES: Close-ups of hands/wrists/ears with the product while doing activities -
    holding coffee, typing, gardening, reaching for something. The jewelry should be visible but the 
    moment should feel natural and lived-in.
    
    FOR HOME PRODUCTS: Product styled in a real living space, being used by someone - arranging flowers 
    in a vase, drinking from a mug, wrapping in a blanket, lighting a candle.
    
    FOR OTHER PRODUCTS: Show the product being used in its natural context by real people in real moments.
    
    Focus on: Natural lighting, candid moments, environmental context, storytelling.
  `,
  
  product: `
    CONTENT TYPE: PRODUCT FOCUS
    Create beautiful product photography that highlights the item's details and craftsmanship.
    
    FOR APPAREL: Flat lay arrangements on textured surfaces (wood, marble, linen), detail shots of 
    fabric texture and stitching, styled with complementary accessories.
    
    FOR JEWELRY: Macro shots showing craftsmanship, product on elegant surfaces (velvet, stone, 
    ceramic), artistic shadow play, detail of clasps and materials.
    
    FOR HOME PRODUCTS: Isolated beauty shots with gradient backgrounds, texture close-ups, 
    scale reference shots, packaging reveals.
    
    FOR OTHER PRODUCTS: Hero shots, detail photography, material close-ups, artful arrangements.
    
    Focus on: Clean compositions, beautiful lighting, texture visibility, professional product photography.
  `,
  
  editorial: `
    CONTENT TYPE: EDITORIAL
    Create magazine-quality, artistic photography with dramatic composition and lighting.
    
    FOR APPAREL: High-fashion poses with dramatic lighting, artistic locations (architecture, 
    galleries, striking landscapes), bold styling choices, fashion-forward compositions.
    
    FOR JEWELRY: Dramatic close-ups with theatrical lighting, artistic shadow play, 
    unconventional angles, editorial styling.
    
    FOR HOME PRODUCTS: Architectural interiors, design-magazine styling, artistic compositions,
    dramatic natural light, minimalist but impactful.
    
    FOR OTHER PRODUCTS: Art-directed setups, striking visual compositions, gallery-worthy imagery.
    
    Focus on: Dramatic lighting, artistic composition, high-end aesthetic, magazine-worthy shots.
  `,
  
  ugc: `
    CONTENT TYPE: UGC (USER-GENERATED CONTENT) STYLE
    Create authentic, relatable content that looks like it was captured by a real customer.
    
    FOR APPAREL: Mirror selfies, casual outfit photos, "get ready with me" moments, 
    unboxing excitement, styling videos frozen in frame.
    
    FOR JEWELRY: "Look what arrived!" unboxing shots, hand selfies showing off rings/bracelets,
    trying-on moments, casual styling shots.
    
    FOR BEAUTY PRODUCTS: Application moments, before/after energy, vanity setups, 
    casual bathroom mirror shots.
    
    FOR OTHER PRODUCTS: Unboxing excitement, first impressions, "haul" style shots.
    
    Focus on: Authentic feel, smartphone-quality aesthetic, relatable moments, real-person energy.
  `,
  
  seasonal: `
    CONTENT TYPE: SEASONAL/EVENT
    Create imagery tied to specific seasons, holidays, or events.
    
    SEASONAL IDEAS:
    - Spring: Fresh blooms, pastel settings, outdoor renewal, Easter themes
    - Summer: Beach vibes, vacation energy, outdoor adventures, Fourth of July
    - Fall: Cozy autumn leaves, pumpkin spice season, harvest themes, Halloween
    - Winter: Holiday magic, cozy interiors, gift-giving, New Year celebrations
    
    EVENT IDEAS:
    - Valentine's Day, Mother's Day, Father's Day
    - Graduation season, Back to school
    - Wedding season, summer parties
    - Black Friday/holiday shopping
    
    Match the product to an appropriate seasonal or event context that feels natural.
    
    Focus on: Seasonal colors, holiday elements, timely relevance, celebratory energy.
  `,
  
  minimalist: `
    CONTENT TYPE: MINIMALIST
    Create clean, elegant imagery with maximum focus on the product itself.
    
    FOR ALL PRODUCTS:
    - Clean solid or gradient backgrounds (white, cream, soft gray, muted tones)
    - Lots of negative space
    - Single product hero shots
    - Subtle shadows for depth
    - No distracting elements
    - Elegant simplicity
    
    BACKGROUND OPTIONS:
    - Pure white seamless
    - Soft gradient (white to light gray)
    - Subtle textured paper
    - Clean marble or concrete
    - Soft fabric sweep
    
    Focus on: Simplicity, elegance, product as the star, gallery-worthy clean aesthetic.
  `,
};

/**
 * Options for the new product analysis function
 */
export interface ProductAnalysisOptions {
  brandProfile?: BrandProfile;
  category?: ContentCategory;
}

/**
 * Result from the comprehensive product analysis
 */
export interface ProductAnalysisWithSuggestionsResult {
  productType: DetectedProductType;
  productDescription: string;
  applicableCategories: ContentCategory[];
  suggestedDefaultCategory: ContentCategory;
  suggestions: StyleSuggestion[];
}

/**
 * Analyzes the uploaded product and suggests relevant styles based on category.
 * This is the new "magic" function that automatically understands any product type
 * and generates contextually relevant suggestions.
 * 
 * When a brandProfile is provided, suggestions are deeply tailored to the brand's
 * voice, target audience, and aesthetic preferences.
 */
export const analyzeProductAndSuggestStyles = async (
  base64Design: string,
  brandProfile?: BrandProfile,
  category?: ContentCategory
): Promise<ProductAnalysisWithSuggestionsResult> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  const ai = new GoogleGenAI({ apiKey });
  
  // Build brand context if profile is provided
  const brandContext = formatStyleBrandContext(brandProfile);
  
  // Get category-specific prompt addition
  const categoryPrompt = category ? CATEGORY_PROMPTS[category] : '';

  try {
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        productType: {
          type: Type.STRING,
          description: "Detected product type: apparel, jewelry, accessories, home_decor, food_beverage, electronics, beauty, art, or other",
        },
        productDescription: {
          type: Type.STRING,
          description: "Brief, friendly description of what the product is (e.g., 'Mountain graphic t-shirt', 'Gold hoop earrings', 'Ceramic planter')",
        },
        applicableCategories: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Which content categories work best for this product: lifestyle, product, editorial, ugc, seasonal, minimalist",
        },
        suggestedDefaultCategory: {
          type: Type.STRING,
          description: "The single best content category for this specific product",
        },
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A short, catchy title for the style (2-4 words)",
              },
              description: {
                type: Type.STRING,
                description: "A detailed scene description for the mockup prompt including setting, lighting, and mood",
              },
              reasoning: {
                type: Type.STRING,
                description: "Brief explanation of why this style matches the product and brand",
              },
              category: {
                type: Type.STRING,
                description: "Which content category this suggestion belongs to",
              },
            },
            required: ["title", "description", "reasoning", "category"],
          },
        },
      },
      required: ["productType", "productDescription", "applicableCategories", "suggestedDefaultCategory", "suggestions"],
    };

    const prompt = `
      You are a world-class creative director for social media content. Your job is to understand
      products deeply and suggest perfect imagery that will resonate with audiences.
      
      STEP 1 - PRODUCT ANALYSIS:
      Look at this product image and identify:
      - What TYPE of product is this? (apparel, jewelry, accessories, home_decor, food_beverage, electronics, beauty, art, other)
      - What specific item is it? (Be specific: "vintage band t-shirt", "minimalist gold necklace", "hand-thrown ceramic mug")
      - What makes it unique? (design, colors, materials, style, vibe)
      - Who would buy this? What kind of person?
      
      ${brandContext ? `
      BRAND CONTEXT - This product belongs to a brand with these characteristics:
      ${brandContext}
      
      Use this brand knowledge to inform your suggestions. The imagery should feel authentically on-brand.
      ` : ''}
      
      STEP 2 - CATEGORY ANALYSIS:
      Determine which content types work best for THIS specific product:
      - lifestyle: Real moments with real people using/wearing the product
      - product: Beauty shots, flat lays, detail photography
      - editorial: Magazine-quality, artistic, dramatic
      - ugc: User-generated content style, authentic, relatable
      - seasonal: Holiday/seasonal themed imagery
      - minimalist: Clean, simple, product-focused
      
      ${category ? `
      REQUESTED CATEGORY: ${category.toUpperCase()}
      ${categoryPrompt}
      
      Generate 5 suggestions specifically for this content type.
      ` : `
      Generate 5 DIVERSE suggestions across different content types.
      Each suggestion should be in a different category to give variety.
      `}
      
      CRITICAL REQUIREMENTS:
      1. Every suggestion must be SPECIFIC to THIS product - not generic
      2. Consider the product's unique design/features when suggesting scenes
      3. Make suggestions that would actually work well in social media
      4. ${brandContext ? 'Ensure all suggestions feel on-brand' : 'Make suggestions versatile and appealing'}
      5. Each suggestion should be immediately actionable as an image generation prompt
      
      SUGGESTION FORMAT:
      For each suggestion, provide:
      - title: Catchy 2-4 word name
      - description: Detailed scene description (setting, lighting, mood, composition, any people and what they're doing)
      - reasoning: Why this works for this product (1-2 sentences)
      - category: Which content type this belongs to
    `;

    // Strip data URL prefix if present
    const cleanBase64Design = base64Design.includes(',') ? base64Design.split(',')[1] : base64Design;
    const mimeTypeMatch = base64Design.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const detectedMimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: detectedMimeType,
              data: cleanBase64Design
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text || "{}";
    const result = JSON.parse(jsonText);
    
    return {
      productType: result.productType as DetectedProductType || 'other',
      productDescription: result.productDescription || 'Product',
      applicableCategories: (result.applicableCategories || ['lifestyle', 'product', 'minimalist']) as ContentCategory[],
      suggestedDefaultCategory: (result.suggestedDefaultCategory || 'lifestyle') as ContentCategory,
      suggestions: (result.suggestions || []).map((s: any) => ({
        title: s.title,
        description: s.description,
        reasoning: s.reasoning,
        category: s.category as ContentCategory,
      })),
    };

  } catch (error) {
    console.error("Error analyzing product:", error);
    // Return default fallback
    return {
      productType: 'other',
      productDescription: 'Product',
      applicableCategories: ['lifestyle', 'product', 'minimalist'],
      suggestedDefaultCategory: 'lifestyle',
      suggestions: [],
    };
  }
};

/**
 * Extended caption generation options that include brand profile
 */
export interface CaptionGenerationOptionsWithBrand extends CaptionGenerationOptions {
  brandProfile?: BrandProfile;
}

/**
 * Generates social media captions based on the generated mockup and style.
 * 
 * When a brandProfile is provided, captions are written in the brand's authentic voice,
 * using appropriate tone characteristics, communication style, and resonating with
 * the target audience.
 */
export const generateSocialCaptions = async (
  styleDescription: string,
  base64Mockup: string,
  options?: CaptionGenerationOptionsWithBrand
): Promise<GeneratedCaptions> => {
  // Always create a new instance to ensure the latest API key is used
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  const ai = new GoogleGenAI({ apiKey });
  
  // Build brand context if profile is provided
  const brandContext = formatCaptionBrandContext(options?.brandProfile);

  try {
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        facebook: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "A friendly, engaging caption suitable for Facebook audience.",
          },
          description: "5 different Facebook caption options with varied tones and styles.",
        },
        instagram: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "A trendy, visual-focused caption with 5-10 relevant hashtags for Instagram.",
          },
          description: "5 different Instagram caption options with varied tones and styles.",
        },
      },
      required: ["facebook", "instagram"],
    };

    // Build tone instruction - brand profile voice takes precedence over preset tones
    let toneInstruction = '';
    if (options?.customTone) {
      toneInstruction = `TONE INSTRUCTION: ${options.customTone}`;
    } else if (options?.tone && options.tone !== 'default') {
      toneInstruction = `TONE INSTRUCTION: ${toneInstructions[options.tone]}`;
    }

    // Build context instruction
    const contextInstruction = options?.context 
      ? `ADDITIONAL CONTEXT: ${options.context}` 
      : '';

    const prompt = `
      Look at this fashion lifestyle image.
      Write 5 different social media caption options for EACH platform for this new apparel launch.
      The vibe is: ${styleDescription}.
      ${brandContext}
      ${toneInstruction ? `\n      ${toneInstruction}` : ''}
      ${contextInstruction ? `\n      ${contextInstruction}` : ''}
      
      For each platform, create 5 UNIQUE captions with different approaches:
      1. One that's short and punchy
      2. One that tells a story or creates a mood
      3. One that's question-based to drive engagement
      4. One that highlights the product features
      5. One that's trendy/playful with personality
      
      Facebook captions: Engaging, encourage clicks or shares, conversational tone.
      Instagram captions: Aesthetic, use emojis, include 5-10 relevant hashtags each.
      
      Make each caption feel distinct and give the user real variety to choose from.
      ${options?.brandProfile ? 'IMPORTANT: Every caption must sound authentically on-brand. Avoid generic social media copy.' : ''}
    `;

    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64Mockup = base64Mockup.includes(',') ? base64Mockup.split(',')[1] : base64Mockup;
    // Detect mime type from data URL or default to png
    const mimeTypeMatch = base64Mockup.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const detectedMimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
            { text: prompt },
            {
                inlineData: {
                    mimeType: detectedMimeType,
                    data: cleanBase64Mockup
                }
            }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText) as GeneratedCaptions;

  } catch (error) {
    console.error("Error generating captions:", error);
    // Fallback if AI fails
    return {
      facebook: [
        "Check out our latest drop! 🔥",
        "New season, new style. This piece is everything we've been dreaming about.",
        "What's your go-to look for the weekend? We've got you covered.",
        "Premium comfort meets modern design. Feel the difference.",
        "POV: You just found your new favorite fit. You're welcome. 😎"
      ],
      instagram: [
        "Fresh fit alert 🔥 Link in bio. #ootd #fashion #style #newdrop #streetwear",
        "Main character energy only ✨ This look hits different. #fashioninspo #outfitoftheday #stylegoals #lookbook #trending",
        "What would you pair this with? Drop your ideas below 👇 #stylequestion #fashiontalk #ootdshare #getcreative #communityvibes",
        "Crafted for comfort. Designed to turn heads. 💫 #qualityfashion #premiumwear #comfortmeetsstyle #wardrobe #musthave",
        "No cap, this might be our best drop yet 🧢🔥 #nocap #bestdrop #firefit #streetstyle #hypebeast"
      ]
    };
  }
};