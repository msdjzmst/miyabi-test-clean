/**
 * Business Base Agent
 *
 * Base class for all Business Agents (Strategy, Marketing, Sales)
 * Separated from Coding Agents to focus on business logic operations
 */

import Anthropic from '@anthropic-ai/sdk';

export interface BusinessAgentConfig {
  anthropicApiKey: string;
  githubToken?: string;
  debug?: boolean;
  logDirectory?: string;
}

export interface BusinessTask {
  type: string;
  description: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface BusinessResult {
  success: boolean;
  data: Record<string, unknown>;
  insights?: string[];
  recommendations?: string[];
  nextSteps?: string[];
  error?: string;
}

export abstract class BusinessBaseAgent {
  protected config: BusinessAgentConfig;
  protected anthropic: Anthropic;
  protected agentType: string;

  constructor(config: BusinessAgentConfig, agentType: string) {
    this.config = config;
    this.agentType = agentType;
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  /**
   * Main execution method - must be implemented by each agent
   */
  abstract execute(task: BusinessTask): Promise<BusinessResult>;

  /**
   * Validate task before execution
   */
  protected validateTask(task: BusinessTask): void {
    if (!task.type) {
      throw new Error('Task type is required');
    }
    if (!task.description) {
      throw new Error('Task description is required');
    }
  }

  /**
   * Log message (console or file)
   */
  protected log(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.agentType}] [${level.toUpperCase()}]`;

    if (this.config.debug) {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Call Claude API with system prompt
   */
  protected async callClaude(
    prompt: string,
    systemPrompt?: string,
    model: string = 'claude-sonnet-4-20250514'
  ): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      throw new Error('Unexpected response type from Claude');
    } catch (error) {
      this.log(`Claude API error: ${(error as Error).message}`, 'error');
      throw error;
    }
  }

  /**
   * Format result for output
   */
  protected formatResult(
    success: boolean,
    data: Record<string, unknown>,
    insights: string[] = [],
    recommendations: string[] = [],
    nextSteps: string[] = []
  ): BusinessResult {
    return {
      success,
      data,
      insights,
      recommendations,
      nextSteps,
    };
  }

  /**
   * Handle errors gracefully
   */
  protected handleError(error: Error, context: string): BusinessResult {
    this.log(`Error in ${context}: ${error.message}`, 'error');

    return {
      success: false,
      data: {},
      error: error.message,
    };
  }
}
