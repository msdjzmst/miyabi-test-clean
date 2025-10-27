/**
 * TypeScript type definitions for Miyabi Context Engineering API
 */

export interface ContextEngineeringConfig {
  /** API base URL (default: http://localhost:9001) */
  apiUrl?: string;
  /** Enable/disable context engineering features (default: true) */
  enabled?: boolean;
  /** Quality score threshold for auto-optimization (default: 80) */
  optimizationThreshold?: number;
  /** Timeout for API requests in milliseconds (default: 30000) */
  timeout?: number;
}

export interface ContextSession {
  session_id: string;
  name: string;
  description?: string;
  created_at: string;
  context_windows: ContextWindow[];
}

export interface ContextWindow {
  window_id: string;
  session_id: string;
  max_tokens: number;
  created_at: string;
  updated_at: string;
  elements: ContextElement[];
  metadata?: Record<string, any>;
}

export interface ContextElement {
  element_id: string;
  content: string;
  type: 'system' | 'user' | 'assistant' | 'data';
  priority: number;
  token_count: number;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface AnalysisResult {
  window_id: string;
  quality_score: number;
  token_count: number;
  semantic_coherence: number;
  information_density: number;
  clarity_score: number;
  relevance_score: number;
  issues: string[];
  recommendations: string[];
  analyzed_at: string;
}

export interface OptimizationGoal {
  name: 'token-efficiency' | 'clarity' | 'relevance' | 'structure' | 'completeness';
  weight?: number;
}

export interface OptimizationRequest {
  content: string;
  goals: (string | OptimizationGoal)[];
  preserve_meaning?: boolean;
  max_iterations?: number;
}

export interface OptimizationResult {
  task_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  original_content: string;
  optimized_content?: string;
  quality_score?: number;
  original_token_count: number;
  optimized_token_count?: number;
  token_reduction_percent?: number;
  improvements: string[];
  created_at: string;
  completed_at?: string;
}

export interface PromptTemplate {
  template_id: string;
  name: string;
  template: string;
  category: string;
  tags: string[];
  variables: string[];
  created_at: string;
  updated_at: string;
  usage_count: number;
  metadata?: Record<string, any>;
}

export interface TemplateGenerationRequest {
  purpose: string;
  examples?: string[];
  constraints?: string[];
  target_length?: number;
}

export interface TemplateRenderRequest {
  template_id: string;
  variables: Record<string, string>;
}

export interface SystemStats {
  total_sessions: number;
  total_contexts: number;
  total_templates: number;
  total_optimizations: number;
  average_quality_score: number;
  average_token_reduction: number;
  uptime_seconds: number;
}

export interface CreateSessionRequest {
  name: string;
  description?: string;
}

export interface CreateWindowRequest {
  session_id: string;
  max_tokens?: number;
  metadata?: Record<string, any>;
}

export interface AddElementRequest {
  window_id: string;
  content: string;
  type: 'system' | 'user' | 'assistant' | 'data';
  priority: number;
  metadata?: Record<string, any>;
}

export interface AnalyzeRequest {
  content: string;
  goals?: string[];
}

export interface APIError {
  error: string;
  detail?: string;
  status_code: number;
}

export class ContextEngineeringError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ContextEngineeringError';
  }
}
