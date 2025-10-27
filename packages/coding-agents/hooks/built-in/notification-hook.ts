/**
 * NotificationHook - Sends notifications on agent completion/failure
 */

import { PostHook, ErrorHook, HookContext } from '../../types/hooks';
import { AgentResult } from '../../types/index';
import { logger } from '../../ui/index';

export interface NotificationConfig {
  /** Slack webhook URL */
  slackWebhookUrl?: string;

  /** Discord webhook URL */
  discordWebhookUrl?: string;

  /** Whether to notify on success */
  notifyOnSuccess?: boolean;

  /** Whether to notify on failure */
  notifyOnFailure?: boolean;

  /** Mention users on failure (@username) */
  mentionOnFailure?: string[];
}

export class NotificationHook implements PostHook {
  name = 'notification';
  description = 'Sends notifications to Slack/Discord on completion';
  priority = 90; // Run late but before cleanup

  protected config: NotificationConfig;

  constructor(config: NotificationConfig = {}) {
    this.config = {
      notifyOnSuccess: true,
      notifyOnFailure: true,
      mentionOnFailure: [],
      ...config,
    };
  }

  /**
   * Execute as PostHook (successful completion)
   */
  async execute(context: HookContext, result: AgentResult): Promise<void> {
    if (!this.config.notifyOnSuccess) {
      return;
    }

    const message = this.formatSuccessMessage(context, result);

    await this.sendNotifications(message);
  }

  /**
   * Format success message
   */
  protected formatSuccessMessage(
    context: HookContext,
    result: AgentResult
  ): string {
    const duration = Date.now() - context.startTime;

    return `✅ **${context.agentType}** completed successfully

**Task**: ${context.task.title} (#${context.task.id})
**Duration**: ${(duration / 1000).toFixed(2)}s
**Status**: ${result.status}
${result.metrics?.qualityScore ? `**Quality Score**: ${result.metrics.qualityScore}/100` : ''}
`;
  }

  /**
   * Format error message
   */
  protected formatErrorMessage(context: HookContext, error: Error): string {
    const duration = Date.now() - context.startTime;

    const mentions =
      this.config.mentionOnFailure && this.config.mentionOnFailure.length > 0
        ? this.config.mentionOnFailure.map((u) => `@${u}`).join(' ')
        : '';

    return `❌ **${context.agentType}** failed ${mentions}

**Task**: ${context.task.title} (#${context.task.id})
**Duration**: ${(duration / 1000).toFixed(2)}s
**Error**: ${error.message}
`;
  }

  /**
   * Send notifications to configured channels
   */
  protected async sendNotifications(message: string): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.slackWebhookUrl) {
      promises.push(this.sendSlackNotification(message));
    }

    if (this.config.discordWebhookUrl) {
      promises.push(this.sendDiscordNotification(message));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(message: string): Promise<void> {
    try {
      if (!this.config.slackWebhookUrl) {
        return;
      }

      const response = await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }

      logger.info('Slack notification sent');
    } catch (error) {
      logger.warning(`Failed to send Slack notification: ${(error as Error).message}`);
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(message: string): Promise<void> {
    try {
      if (!this.config.discordWebhookUrl) {
        return;
      }

      const response = await fetch(this.config.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.statusText}`);
      }

      logger.info('Discord notification sent');
    } catch (error) {
      logger.warning(`Failed to send Discord notification: ${(error as Error).message}`);
    }
  }
}

/**
 * ErrorNotificationHook - Sends notifications on agent errors
 */
export class ErrorNotificationHook implements ErrorHook {
  name = 'error-notification';
  description = 'Sends notifications to Slack/Discord on error';
  priority = 90;

  protected config: NotificationConfig;

  constructor(config: NotificationConfig = {}) {
    this.config = {
      notifyOnSuccess: true,
      notifyOnFailure: true,
      mentionOnFailure: [],
      ...config,
    };
  }

  /**
   * Execute as ErrorHook (failure)
   */
  async execute(context: HookContext, error: Error): Promise<void> {
    if (!this.config.notifyOnFailure) {
      return;
    }

    const message = this.formatErrorMessage(context, error);

    await this.sendNotifications(message);
  }

  /**
   * Format error message
   */
  protected formatErrorMessage(context: HookContext, error: Error): string {
    const duration = Date.now() - context.startTime;

    const mentions =
      this.config.mentionOnFailure && this.config.mentionOnFailure.length > 0
        ? this.config.mentionOnFailure.map((u) => `@${u}`).join(' ')
        : '';

    return `❌ **${context.agentType}** failed ${mentions}

**Task**: ${context.task.title} (#${context.task.id})
**Duration**: ${(duration / 1000).toFixed(2)}s
**Error**: ${error.message}
`;
  }

  /**
   * Send notifications to configured channels
   */
  protected async sendNotifications(message: string): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.config.slackWebhookUrl) {
      promises.push(this.sendSlackNotification(message));
    }

    if (this.config.discordWebhookUrl) {
      promises.push(this.sendDiscordNotification(message));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(message: string): Promise<void> {
    try {
      if (!this.config.slackWebhookUrl) {
        return;
      }

      const response = await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }

      logger.info('Slack notification sent');
    } catch (error) {
      logger.warning(`Failed to send Slack notification: ${(error as Error).message}`);
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(message: string): Promise<void> {
    try {
      if (!this.config.discordWebhookUrl) {
        return;
      }

      const response = await fetch(this.config.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.statusText}`);
      }

      logger.info('Discord notification sent');
    } catch (error) {
      logger.warning(`Failed to send Discord notification: ${(error as Error).message}`);
    }
  }
}
