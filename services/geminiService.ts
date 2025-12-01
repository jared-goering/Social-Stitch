import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedCaptions, StyleSuggestion } from "../types";

/**
 * Generates a lifestyle mockup based on the uploaded design.
 * Uses Gemini 3 Pro Image Preview (Nano Banana Pro) for high-fidelity composition.
 */
export const generateMockupImage = async (
  base64Design: string,
  stylePrompt: string
): Promise<string> => {
  // Always create a new instance to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const prompt = `
      You are a professional fashion photographer.
      Task: Create a photorealistic lifestyle image featuring the EXACT garment shown in the reference image.
      
      Instructions:
      1. The reference image contains a specific piece of apparel (t-shirt/top).
      2. Dress a realistic model in this EXACT garment. 
      3. CRITICAL: You must preserve the cut, style, fabric texture, color, and graphic design of the uploaded garment perfectly. Do not generate a generic t-shirt with the logo; use the actual shirt style provided.
      4. Place the model in a setting matching this description: ${stylePrompt}.
      5. Ensure high-quality lighting, realistic shadows, and natural skin textures.
      6. Do not add any text overlays, watermarks, or extra graphics.
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
      
      Based on your analysis, suggest 5 unique photography/mockup styles that would 
      best showcase this specific garment for social media marketing.
      
      Each suggestion should include:
      1. A catchy title (e.g., "Urban Streetwear", "Beach Vibes")
      2. A detailed scene description with background, lighting, and mood
      3. Brief reasoning on why this style complements the garment
      
      Be creative and specific to THIS garment - don't give generic suggestions.
      Consider color harmony, target audience, and seasonal appropriateness.
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