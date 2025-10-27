/**
 * WebhookClient - Session Status Communication
 *
 * Posts session status to webhook server and receives responses
 */

import type { SessionStatus } from './water-spider-agent';

export class WebhookClient {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  /**
   * Post session status to webhook server
   */
  async postStatus(sessions: SessionStatus[]): Promise<void> {
    try {
      const response = await fetch(`${this.webhookUrl}/api/session/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          sessions: sessions.map((s) => ({
            sessionId: s.sessionId,
            status: s.status,
            lastActivity: s.lastActivity,
            idleTime: s.idleTime,
            needsContinue: s.needsContinue,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Silently fail if webhook server is not available
      // This allows Water Spider to work without webhook server
    }
  }

  /**
   * Notify continue signal sent
   */
  async notifyContinue(sessionId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.webhookUrl}/api/session/${sessionId}/continue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            sessionId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get continue recommendation from server
   */
  async getContinueRecommendation(
    sessionId: string
  ): Promise<{ action: 'continue' | 'wait'; message: string }> {
    try {
      const response = await fetch(
        `${this.webhookUrl}/api/session/${sessionId}/recommendation`
      );

      if (!response.ok) {
        return { action: 'wait', message: 'Server unavailable' };
      }

      const data = (await response.json()) as { action: 'continue' | 'wait'; message: string };
      return data;
    } catch {
      return { action: 'wait', message: 'Server unavailable' };
    }
  }
}
