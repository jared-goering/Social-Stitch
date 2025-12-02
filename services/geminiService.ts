import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedCaptions, StyleSuggestion, ModelGender } from "../types";

/**
 * Generates a lifestyle mockup based on the uploaded design.
 * Uses Gemini 3 Pro Image Preview (Nano Banana Pro) for high-fidelity composition.
 */
export const generateMockupImage = async (
  base64Design: string,
  stylePrompt: string,
  gender?: ModelGender
): Promise<string> => {
  // Always create a new instance to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Build gender instruction based on parameter
  const genderInstruction = gender === 'male' 
    ? 'The model should be male.'
    : gender === 'female' 
    ? 'The model should be female.'
    : '';

  try {
    const prompt = `
      You are a lifestyle and editorial photographer capturing authentic, candid moments.
      Task: Create a photorealistic LIFESTYLE image featuring someone wearing the EXACT garment shown in the reference image.
      
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
              mimeType: 'image/png',
              data: base64Design
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
 * Generates social media captions based on the generated mockup and style.
 */
/**
 * Analyzes the uploaded garment and suggests relevant mockup styles.
 * Uses Gemini to understand the garment's characteristics and recommend fitting scenes.
 */
export const analyzeGarmentAndSuggestStyles = async (
  base64Design: string
): Promise<StyleSuggestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
            description: "Brief explanation of why this style matches the garment",
          },
        },
        required: ["title", "description", "reasoning"],
      },
    };

    const prompt = `
      Analyze this garment image carefully. Consider:
      - The garment type (t-shirt, hoodie, tank top, etc.)
      - Color palette and any graphics/designs
      - Overall aesthetic (streetwear, casual, athletic, vintage, etc.)
      - Target demographic and use cases
      
      Based on your analysis, suggest 5 unique LIFESTYLE photography scenes that would 
      best showcase this specific garment for social media marketing.
      
      IMPORTANT - LIFESTYLE FOCUS:
      - Suggest scenes where a person is DOING something, not just posing
      - Include activities, environments, and candid moments
      - Think editorial/documentary style, not model photoshoots
      - The person should feel like they're living their life, captured in a moment
      
      Each suggestion should include:
      1. A catchy title (e.g., "Morning Coffee Run", "Weekend Market Stroll")
      2. A detailed LIFESTYLE scene description including:
         - What activity the person is doing
         - The environmental setting with specific details
         - Lighting and time of day
         - Mood and energy (relaxed, adventurous, cozy, etc.)
      3. Brief reasoning on why this lifestyle context complements the garment
      
      Be creative and specific to THIS garment - don't give generic suggestions.
      Consider color harmony, target audience, and lifestyle scenarios that fit the vibe.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Design
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

export const generateSocialCaptions = async (
  styleDescription: string,
  base64Mockup: string
): Promise<GeneratedCaptions> => {
  // Always create a new instance to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

    const prompt = `
      Look at this fashion lifestyle image.
      Write 5 different social media caption options for EACH platform for this new apparel launch.
      The vibe is: ${styleDescription}.
      
      For each platform, create 5 UNIQUE captions with different approaches:
      1. One that's short and punchy
      2. One that tells a story or creates a mood
      3. One that's question-based to drive engagement
      4. One that highlights the product features
      5. One that's trendy/playful with personality
      
      Facebook captions: Engaging, encourage clicks or shares, conversational tone.
      Instagram captions: Aesthetic, use emojis, include 5-10 relevant hashtags each.
      
      Make each caption feel distinct and give the user real variety to choose from.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
            { text: prompt },
            {
                inlineData: {
                    mimeType: 'image/png', // Assuming PNG/base64 input
                    data: base64Mockup.split(',')[1] // Strip header if present
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