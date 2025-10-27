/**
 * DashboardWebhookHook - Sends events to dashboard via webhook
 *
 * Supports PreHook, PostHook, and ErrorHook interfaces for complete lifecycle tracking
 */

import { PreHook, PostHook, ErrorHook, HookContext } from '../../types/hooks';
import { AgentResult } from '../../types/index';
import {
  DashboardEvent,
  DashboardWebhookResponse,
  AgentStartedEvent,
  AgentProgressEvent,
  AgentCompletedEvent,
  AgentErrorEvent,
} from '../../types/dashboard-events';
import { logger } from '../../ui/index';

export interface DashboardWebhookConfig {
  /** Dashboard URL */
  dashboardUrl: string;

  /** Webhook endpoint path (default: /api/agent-event) */
  webhookPath?: string;

  /** Enable retry on failure */
  enableRetry?: boolean;

  /** Max retry attempts */
  maxRetries?: number;

  /** Retry delay in milliseconds */
  retryDelay?: number;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Enable silent mode (don't log warnings) */
  silent?: boolean;

  /** Session ID for tracking related events */
  sessionId?: string;

  /** Device identifier */
  deviceIdentifier?: string;

  /** Custom headers */
  headers?: Record<string, string>;
}

export class DashboardWebhookHook implements PreHook, PostHook, ErrorHook {
  name = 'dashboard-webhook';
  description = 'Sends events to dashboard via webhook';
  priority = 5; // Run early to capture start time

  private config: Required<DashboardWebhookConfig>;
  private eventQueue: DashboardEvent[] = [];

  constructor(config: DashboardWebhookConfig) {
    this.config = {
      webhookPath: '/api/agent-event',
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 5000,
      silent: false,
      sessionId: `session-${Date.now()}`,
      deviceIdentifier: process.env.DEVICE_IDENTIFIER || 'unknown',
      headers: {},
      ...config,
    };
  }

  /**
   * Execute as PreHook - Send agent:started event
   */
  async execute(context: HookContext): Promise<void> {
    const event: AgentStartedEvent = {
      eventType: 'agent:started',
      timestamp: new Date().toISOString(),
      agentId: context.agentType.toLowerCase().replace('agent', ''),
      issueNumber: context.task.metadata?.issueNumber,
      sessionId: this.config.sessionId,
      deviceIdentifier: this.config.deviceIdentifier,
      parameters: {
        taskId: context.task.id,
        taskTitle: context.task.title,
        taskDescription: context.task.description,
        priority: `P${context.task.priority}`,
        estimatedDuration: context.task.estimatedDuration,
        dependencies: context.task.dependencies,
      },
    };

    await this.sendEvent(event);
  }

  /**
   * Execute as PostHook - Send agent:completed event
   */
  async executePost(context: HookContext, result: AgentResult): Promise<void> {
    const event: AgentCompletedEvent = {
      eventType: 'agent:completed',
      timestamp: new Date().toISOString(),
      agentId: context.agentType.toLowerCase().replace('agent', ''),
      issueNumber: context.task.metadata?.issueNumber,
      sessionId: this.config.sessionId,
      deviceIdentifier: this.config.deviceIdentifier,
      result: {
        success: result.status === 'success',
        status: result.status,
        durationMs: Date.now() - context.startTime,
        qualityScore: result.metrics?.qualityScore,
        filesChanged: result.metrics?.linesChanged,
        testsAdded: result.metrics?.testsAdded,
        metrics: result.metrics,
        data: result.data,
      },
    };

    await this.sendEvent(event);
  }

  /**
   * Execute as ErrorHook - Send agent:error event
   */
  async executeError(context: HookContext, error: Error): Promise<void> {
    const event: AgentErrorEvent = {
      eventType: 'agent:error',
      timestamp: new Date().toISOString(),
      agentId: context.agentType.toLowerCase().replace('agent', ''),
      issueNumber: context.task.metadata?.issueNumber,
      sessionId: this.config.sessionId,
      deviceIdentifier: this.config.deviceIdentifier,
      error: {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack,
        severity: this.determineSeverity(error),
        context: {
          taskId: context.task.id,
          agentType: context.agentType,
        },
      },
    };

    await this.sendEvent(event);
  }

  /**
   * Send progress update (can be called manually during execution)
   */
  async sendProgress(
    context: HookContext,
    currentStep: string,
    percentage: number,
    completedSteps: string[],
    remainingSteps: string[]
  ): Promise<void> {
    const event: AgentProgressEvent = {
      eventType: 'agent:progress',
      timestamp: new Date().toISOString(),
      agentId: context.agentType.toLowerCase().replace('agent', ''),
      issueNumber: context.task.metadata?.issueNumber,
      sessionId: this.config.sessionId,
      deviceIdentifier: this.config.deviceIdentifier,
      progress: {
        currentStep,
        percentage,
        completedSteps,
        remainingSteps,
      },
    };

    await this.sendEvent(event);
  }

  /**
   * Send custom event
   */
  async sendCustomEvent(event: DashboardEvent): Promise<void> {
    await this.sendEvent(event);
  }

  /**
   * Send event to dashboard with retry logic
   */
  private async sendEvent(event: DashboardEvent): Promise<void> {
    const url = `${this.config.dashboardUrl}${this.config.webhookPath}`;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(event),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Dashboard webhook failed: ${response.status} ${response.statusText}`);
        }

        const result = (await response.json()) as DashboardWebhookResponse;

        if (!result.success) {
          throw new Error(`Dashboard webhook rejected: ${result.error || 'Unknown error'}`);
        }

        if (!this.config.silent) {
          logger.info(`✓ Dashboard event sent: ${event.eventType} (eventId: ${result.eventId})`);
        }

        return; // Success
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries && this.config.enableRetry) {
          const delay = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff

          if (!this.config.silent) {
            logger.warning(
              `Dashboard webhook failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}), retrying in ${delay}ms...`
            );
          }

          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    if (!this.config.silent) {
      logger.warning(
        `Failed to send dashboard event after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`
      );
    }

    // Queue event for later (optional - could implement background retry)
    this.eventQueue.push(event);
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();

    if (
      message.includes('critical') ||
      message.includes('security') ||
      message.includes('data loss')
    ) {
      return 'critical';
    }

    if (
      message.includes('error') ||
      message.includes('failed') ||
      message.includes('timeout')
    ) {
      return 'high';
    }

    if (message.includes('warning') || message.includes('deprecated')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queued events (failed events)
   */
  getQueuedEvents(): DashboardEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Clear event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Retry queued events
   */
  async retryQueuedEvents(): Promise<void> {
    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (!this.config.silent) {
      logger.info(`Retrying ${events.length} queued dashboard events...`);
    }

    for (const event of events) {
      await this.sendEvent(event);
    }
  }

  /**
   * Get dashboard URL
   */
  getDashboardUrl(): string {
    return this.config.dashboardUrl;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.config.sessionId;
  }
}
