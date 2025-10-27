/**
 * EnvironmentCheckHook - Validates required environment variables
 */

import { PreHook, HookContext } from '../../types/hooks';
import { logger } from '../../ui/index';

export class EnvironmentCheckHook implements PreHook {
  name = 'environment-check';
  description = 'Validates required environment variables before execution';
  priority = 10; // Run early

  private requiredEnvVars: string[];

  constructor(requiredEnvVars: string[] = []) {
    this.requiredEnvVars = requiredEnvVars;
  }

  async execute(_context: HookContext): Promise<void> {
    logger.info(`Checking ${this.requiredEnvVars.length} environment variables...`);

    const missing: string[] = [];

    for (const envVar of this.requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }

    logger.success(`✓ All required environment variables are set`);
  }

  /**
   * Add required environment variable
   */
  addRequirement(envVar: string): void {
    if (!this.requiredEnvVars.includes(envVar)) {
      this.requiredEnvVars.push(envVar);
    }
  }

  /**
   * Remove required environment variable
   */
  removeRequirement(envVar: string): void {
    this.requiredEnvVars = this.requiredEnvVars.filter((v) => v !== envVar);
  }
}
