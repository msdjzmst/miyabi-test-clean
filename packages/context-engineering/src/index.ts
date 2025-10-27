/**
 * @miyabi/context-engineering
 *
 * TypeScript SDK for Miyabi Context Engineering API
 *
 * Provides AI-powered prompt analysis, optimization, and template management
 * using Google Gemini AI.
 *
 * @example
 * ```typescript
 * import { ContextEngineering } from '@miyabi/context-engineering';
 *
 * const ce = new ContextEngineering();
 *
 * // Analyze prompt quality
 * const analysis = await ce.analyze('Your prompt here');
 * console.log(`Quality: ${analysis.quality_score}/100`);
 *
 * // Optimize if needed
 * if (analysis.quality_score < 80) {
 *   const optimized = await ce.optimize({
 *     content: 'Your prompt here',
 *     goals: ['clarity', 'token-efficiency']
 *   });
 *   console.log(`Improved to: ${optimized.quality_score}/100`);
 * }
 * ```
 *
 * @packageDocumentation
 */

import { ContextEngineeringClient } from './client';
import type {
  ContextEngineeringConfig,
  ContextSession,
  ContextWindow,
  ContextElement,
  AnalysisResult,
  OptimizationRequest,
  OptimizationResult,
  PromptTemplate,
  TemplateGenerationRequest,
  TemplateRenderRequest,
  SystemStats,
  CreateSessionRequest,
  CreateWindowRequest,
  AddElementRequest,
  AnalyzeRequest,
  OptimizationGoal,
} from './types';
import { ContextEngineeringError } from './types';

/**
 * Main Context Engineering SDK class
 *
 * High-level interface for working with the Context Engineering API.
 * Provides simplified methods for common operations.
 */
export class ContextEngineering {
  private client: ContextEngineeringClient;

  constructor(config?: ContextEngineeringConfig) {
    this.client = new ContextEngineeringClient(config);
  }

  /**
   * Check if Context Engineering is enabled
   */
  get enabled(): boolean {
    return this.client.isEnabled();
  }

  /**
   * Get the configured optimization threshold
   */
  get optimizationThreshold(): number {
    return this.client.getOptimizationThreshold();
  }

  // --- Quick Analysis & Optimization ---

  /**
   * Analyze a prompt and return quality metrics
   *
   * @param content - The prompt content to analyze
   * @returns Analysis result with quality score and recommendations
   *
   * @example
   * ```typescript
   * const analysis = await ce.analyze('You are a helpful AI assistant...');
   * console.log(`Quality: ${analysis.quality_score}/100`);
   * console.log('Issues:', analysis.issues);
   * console.log('Recommendations:', analysis.recommendations);
   * ```
   */
  async analyze(content: string): Promise<AnalysisResult> {
    return this.client.analyze(content);
  }

  /**
   * Optimize a prompt for specific goals
   *
   * @param request - Optimization request with content and goals
   * @returns Optimized result with improved content
   *
   * @example
   * ```typescript
   * const optimized = await ce.optimize({
   *   content: 'Original prompt...',
   *   goals: ['clarity', 'token-efficiency']
   * });
   * console.log('Token reduction:', optimized.token_reduction_percent + '%');
   * console.log('New content:', optimized.optimized_content);
   * ```
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResult> {
    return this.client.optimize(request);
  }

  /**
   * Auto-optimize a prompt (AI decides the best strategy)
   *
   * @param content - The prompt content to optimize
   * @returns Optimized result
   *
   * @example
   * ```typescript
   * const optimized = await ce.autoOptimize('Your prompt here');
   * console.log('Quality improvement:', optimized.quality_score);
   * ```
   */
  async autoOptimize(content: string): Promise<OptimizationResult> {
    return this.client.autoOptimize(content);
  }

  /**
   * Analyze and auto-optimize if quality is below threshold
   *
   * @param content - The prompt content
   * @param threshold - Quality score threshold (default: from config)
   * @returns Object with analysis and optional optimization result
   *
   * @example
   * ```typescript
   * const result = await ce.analyzeAndOptimize('Your prompt', 80);
   * if (result.optimized) {
   *   console.log('Prompt was optimized to:', result.optimized.quality_score);
   *   return result.optimized.optimized_content;
   * } else {
   *   console.log('Prompt quality is good:', result.analysis.quality_score);
   *   return content;
   * }
   * ```
   */
  async analyzeAndOptimize(
    content: string,
    threshold?: number
  ): Promise<{
    analysis: AnalysisResult;
    optimized?: OptimizationResult;
    shouldUseOptimized: boolean;
  }> {
    const analysis = await this.analyze(content);
    const qualityThreshold = threshold ?? this.optimizationThreshold;

    if (analysis.quality_score < qualityThreshold) {
      const optimized = await this.autoOptimize(content);
      return {
        analysis,
        optimized,
        shouldUseOptimized: true,
      };
    }

    return {
      analysis,
      shouldUseOptimized: false,
    };
  }

  // --- Session Management ---

  /**
   * Create a new context session
   */
  async createSession(request: CreateSessionRequest): Promise<ContextSession> {
    return this.client.createSession(request);
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<ContextSession[]> {
    return this.client.listSessions();
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<ContextSession> {
    return this.client.getSession(sessionId);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    return this.client.deleteSession(sessionId);
  }

  // --- Context Windows ---

  /**
   * Create a new context window
   */
  async createWindow(request: CreateWindowRequest): Promise<ContextWindow> {
    return this.client.createWindow(request);
  }

  /**
   * Get context window
   */
  async getWindow(windowId: string): Promise<ContextWindow> {
    return this.client.getWindow(windowId);
  }

  /**
   * Add element to context window
   */
  async addElement(request: AddElementRequest): Promise<ContextElement> {
    return this.client.addElement(request);
  }

  /**
   * Remove element from context window
   */
  async removeElement(windowId: string, elementId: string): Promise<void> {
    return this.client.removeElement(windowId, elementId);
  }

  /**
   * Analyze existing context window
   */
  async analyzeWindow(windowId: string): Promise<AnalysisResult> {
    return this.client.analyzeWindow(windowId);
  }

  // --- Template Management ---

  /**
   * Create a new prompt template
   *
   * @example
   * ```typescript
   * const template = await ce.createTemplate({
   *   name: 'Code Review',
   *   template: 'Review this {language} code for {focus}...',
   *   category: 'review',
   *   tags: ['code', 'quality']
   * });
   * ```
   */
  async createTemplate(template: Partial<PromptTemplate>): Promise<PromptTemplate> {
    return this.client.createTemplate(template);
  }

  /**
   * Generate template using AI
   *
   * @example
   * ```typescript
   * const template = await ce.generateTemplate({
   *   purpose: 'Generate React components with TypeScript',
   *   examples: ['Create button component', 'Create form component'],
   *   constraints: ['Use functional components', 'Include PropTypes']
   * });
   * ```
   */
  async generateTemplate(request: TemplateGenerationRequest): Promise<PromptTemplate> {
    return this.client.generateTemplate(request);
  }

  /**
   * List all templates
   */
  async listTemplates(category?: string, tags?: string[]): Promise<PromptTemplate[]> {
    return this.client.listTemplates(category, tags);
  }

  /**
   * Get specific template
   */
  async getTemplate(templateId: string): Promise<PromptTemplate> {
    return this.client.getTemplate(templateId);
  }

  /**
   * Render template with variables
   *
   * @example
   * ```typescript
   * const content = await ce.renderTemplate({
   *   template_id: 'code-review-template',
   *   variables: {
   *     language: 'TypeScript',
   *     focus: 'security and performance'
   *   }
   * });
   * ```
   */
  async renderTemplate(request: TemplateRenderRequest): Promise<string> {
    return this.client.renderTemplate(request);
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate> {
    return this.client.updateTemplate(templateId, updates);
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    return this.client.deleteTemplate(templateId);
  }

  // --- System ---

  /**
   * Get system statistics
   */
  async getStats(): Promise<SystemStats> {
    return this.client.getStats();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck();
  }
}

// Re-export types
export type {
  ContextEngineeringConfig,
  ContextSession,
  ContextWindow,
  ContextElement,
  AnalysisResult,
  OptimizationRequest,
  OptimizationResult,
  OptimizationGoal,
  PromptTemplate,
  TemplateGenerationRequest,
  TemplateRenderRequest,
  SystemStats,
  CreateSessionRequest,
  CreateWindowRequest,
  AddElementRequest,
  AnalyzeRequest,
};

export { ContextEngineeringError };

// Default export
export default ContextEngineering;
