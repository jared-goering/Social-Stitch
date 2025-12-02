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

export interface SavedMockup extends MockupOption {
  createdAt: Date;
  designId: string;
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
export type AppView = 'workflow' | 'calendar';
