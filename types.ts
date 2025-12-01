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

export interface GeneratedCaptions {
  facebook: string[];
  instagram: string[];
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

export interface SocialPost {
  platform: SocialPlatform;
  content: string;
  image: string;
  status: 'draft' | 'posted';
}
