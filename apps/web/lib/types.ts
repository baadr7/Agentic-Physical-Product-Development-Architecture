/**
 * Types TypeScript pour la plateforme Design IA
 */

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  product_type: 'furniture' | 'electronics' | 'mechanical' | 'other';
  // Optional logo URL for prototypes
  logo_url?: string;
  brief: string;
  materials?: string[];
  constraints?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  run_id: string; // unique identifier
  project_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  parameters: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Variant {
  id: string;
  run_id: string;
  stl_url?: string;
  step_url?: string;
  thumbnail_url: string;
  image_url?: string;
  metrics: {
    mass?: number; // kg (legacy mock)
    mass_g?: number; // grams (from worker)
    volume_cm3?: number;
    safety_factor?: number;
    deflection_mm?: number;
    fabricability_score?: number;
    sustainability_score?: number;
  };
  score: number;
  dfx_analysis?: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  run_id: string;
  prompt_text: string;
  model: string;
  version: number;
  embedding_id?: string;
  created_at: string;
}

export interface Export {
  id: string;
  run_id: string;
  pdf_url?: string;
  zip_url?: string;
  stl_url?: string;
  expires_at: string;
  created_at: string;
}

export interface DfxSummary {
  variant_id: string;
  summary: string;
  fabricability_score: number;
  assemblability_score: number;
  sustainability_score: number;
  recommendations: string[];
  created_at: string;
}
