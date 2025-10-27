import axios, { AxiosInstance, AxiosError } from 'axios';
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
  ContextEngineeringError as ContextEngineeringErrorType,
} from './types';
import { ContextEngineeringError } from './types';

/**
 * HTTP client for Miyabi Context Engineering API
 */
export class ContextEngineeringClient {
  private client: AxiosInstance;
  private enabled: boolean;
  private optimizationThreshold: number;

  constructor(config: ContextEngineeringConfig = {}) {
    const {
      apiUrl = process.env.CONTEXT_ENGINEERING_API_URL || 'http://localhost:9001',
      enabled = process.env.CONTEXT_ENGINEERING_ENABLED !== 'false',
      optimizationThreshold = parseInt(process.env.CONTEXT_OPTIMIZATION_THRESHOLD || '80', 10),
      timeout = 30000,
    } = config;

    this.enabled = enabled;
    this.optimizationThreshold = optimizationThreshold;

    this.client = axios.create({
      baseURL: apiUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error?: string }>) => {
        if (error.response) {
          throw new ContextEngineeringError(
            error.response.data?.error || error.message,
            error.response.status,
            error.response.data
          );
        } else if (error.request) {
          throw new ContextEngineeringError(
            'No response from Context Engineering API',
            undefined,
            { originalError: error.message }
          );
        } else {
          throw new ContextEngineeringError(error.message);
        }
      }
    );
  }

  /**
   * Check if Context Engineering is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get optimization threshold
   */
  getOptimizationThreshold(): number {
    return this.optimizationThreshold;
  }

  // --- Session Management ---

  /**
   * Create a new context session
   */
  async createSession(request: CreateSessionRequest): Promise<ContextSession> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.post<ContextSession>('/api/sessions', request);
    return response.data;
  }

  /**
   * List all context sessions
   */
  async listSessions(): Promise<ContextSession[]> {
    if (!this.enabled) {
      return [];
    }

    const response = await this.client.get<ContextSession[]>('/api/sessions');
    return response.data;
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<ContextSession> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.get<ContextSession>(`/api/sessions/${sessionId}`);
    return response.data;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.client.delete(`/api/sessions/${sessionId}`);
  }

  // --- Context Window Management ---

  /**
   * Create a new context window
   */
  async createWindow(request: CreateWindowRequest): Promise<ContextWindow> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.post<ContextWindow>(
      `/api/sessions/${request.session_id}/windows`,
      {
        max_tokens: request.max_tokens || 8192,
        metadata: request.metadata || {},
      }
    );
    return response.data;
  }

  /**
   * Get context window details
   */
  async getWindow(windowId: string): Promise<ContextWindow> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.get<ContextWindow>(`/api/contexts/${windowId}`);
    return response.data;
  }

  /**
   * Add element to context window
   */
  async addElement(request: AddElementRequest): Promise<ContextElement> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.post<ContextElement>(
      `/api/contexts/${request.window_id}/elements`,
      {
        content: request.content,
        type: request.type,
        priority: request.priority,
        metadata: request.metadata || {},
      }
    );
    return response.data;
  }

  /**
   * Remove element from context window
   */
  async removeElement(windowId: string, elementId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.client.delete(`/api/contexts/${windowId}/elements/${elementId}`);
  }

  // --- Analysis ---

  /**
   * Analyze context quality
   */
  async analyze(request: AnalyzeRequest | string): Promise<AnalysisResult> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    // Handle string input (direct content)
    if (typeof request === 'string') {
      request = { content: request };
    }

    // Create temporary session and window for analysis
    const session = await this.createSession({
      name: 'temp-analysis-session',
      description: 'Temporary session for quick analysis',
    });

    const window = await this.createWindow({
      session_id: session.session_id,
      max_tokens: 8192,
    });

    await this.addElement({
      window_id: window.window_id,
      content: request.content,
      type: 'system',
      priority: 10,
    });

    const response = await this.client.post<AnalysisResult>(
      `/api/contexts/${window.window_id}/analyze`
    );

    // Clean up temporary session
    await this.deleteSession(session.session_id);

    return response.data;
  }

  /**
   * Analyze existing context window
   */
  async analyzeWindow(windowId: string): Promise<AnalysisResult> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.post<AnalysisResult>(`/api/contexts/${windowId}/analyze`);
    return response.data;
  }

  // --- Optimization ---

  /**
   * Optimize context content
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResult> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    // Create temporary session and window
    const session = await this.createSession({
      name: 'temp-optimization-session',
      description: 'Temporary session for optimization',
    });

    const window = await this.createWindow({
      session_id: session.session_id,
      max_tokens: 8192,
    });

    await this.addElement({
      window_id: window.window_id,
      content: request.content,
      type: 'system',
      priority: 10,
    });

    const response = await this.client.post<{ task_id: string }>(
      `/api/contexts/${window.window_id}/optimize`,
      {
        goals: request.goals,
        preserve_meaning: request.preserve_meaning ?? true,
        max_iterations: request.max_iterations || 3,
      }
    );

    // Poll for completion
    const result = await this.waitForOptimization(response.data.task_id);

    // Clean up temporary session
    await this.deleteSession(session.session_id);

    return result;
  }

  /**
   * Auto-optimize context (AI decides strategy)
   */
  async autoOptimize(content: string): Promise<OptimizationResult> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    // Create temporary session and window
    const session = await this.createSession({
      name: 'temp-auto-optimization',
      description: 'Temporary session for auto-optimization',
    });

    const window = await this.createWindow({
      session_id: session.session_id,
      max_tokens: 8192,
    });

    await this.addElement({
      window_id: window.window_id,
      content,
      type: 'system',
      priority: 10,
    });

    const response = await this.client.post<{ task_id: string }>(
      `/api/contexts/${window.window_id}/auto-optimize`
    );

    const result = await this.waitForOptimization(response.data.task_id);

    await this.deleteSession(session.session_id);

    return result;
  }

  /**
   * Wait for optimization task to complete
   */
  private async waitForOptimization(taskId: string, maxWaitMs = 60000): Promise<OptimizationResult> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 second

    while (Date.now() - startTime < maxWaitMs) {
      const response = await this.client.get<OptimizationResult>(`/api/optimization/${taskId}`);
      const result = response.data;

      if (result.status === 'completed') {
        return result;
      } else if (result.status === 'failed') {
        throw new ContextEngineeringError('Optimization failed');
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new ContextEngineeringError('Optimization timeout');
  }

  // --- Template Management ---

  /**
   * Create a new prompt template
   */
  async createTemplate(template: Partial<PromptTemplate>): Promise<PromptTemplate> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.post<PromptTemplate>('/api/templates', template);
    return response.data;
  }

  /**
   * Generate template using AI
   */
  async generateTemplate(request: TemplateGenerationRequest): Promise<PromptTemplate> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.post<PromptTemplate>('/api/templates/generate', request);
    return response.data;
  }

  /**
   * List all templates
   */
  async listTemplates(category?: string, tags?: string[]): Promise<PromptTemplate[]> {
    if (!this.enabled) {
      return [];
    }

    const params: any = {};
    if (category) params.category = category;
    if (tags && tags.length > 0) params.tags = tags.join(',');

    const response = await this.client.get<PromptTemplate[]>('/api/templates', { params });
    return response.data;
  }

  /**
   * Get specific template
   */
  async getTemplate(templateId: string): Promise<PromptTemplate> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.get<PromptTemplate>(`/api/templates/${templateId}`);
    return response.data;
  }

  /**
   * Render template with variables
   */
  async renderTemplate(request: TemplateRenderRequest): Promise<string> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.post<{ rendered_content: string }>(
      `/api/templates/${request.template_id}/render`,
      { variables: request.variables }
    );
    return response.data.rendered_content;
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, updates: Partial<PromptTemplate>): Promise<PromptTemplate> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.put<PromptTemplate>(`/api/templates/${templateId}`, updates);
    return response.data;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.client.delete(`/api/templates/${templateId}`);
  }

  // --- System ---

  /**
   * Get system statistics
   */
  async getStats(): Promise<SystemStats> {
    if (!this.enabled) {
      throw new ContextEngineeringError('Context Engineering is disabled');
    }

    const response = await this.client.get<SystemStats>('/api/stats');
    return response.data;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/api/stats');
      return true;
    } catch {
      return false;
    }
  }
}
