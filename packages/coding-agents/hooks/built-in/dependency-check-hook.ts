/**
 * DependencyCheckHook - Validates task dependencies are resolved
 */

import { PreHook, HookContext } from '../../types/hooks';
import { logger } from '../../ui/index';
import * as fs from 'fs';
import * as path from 'path';

export class DependencyCheckHook implements PreHook {
  name = 'dependency-check';
  description = 'Validates task dependencies are resolved before execution';
  priority = 20; // Run after environment check

  private reportDirectory: string;

  constructor(reportDirectory: string = '.ai/parallel-reports') {
    this.reportDirectory = reportDirectory;
  }

  async execute(context: HookContext): Promise<void> {
    const { task } = context;

    if (!task.dependencies || task.dependencies.length === 0) {
      logger.info('No dependencies to check');
      return;
    }

    logger.info(`Checking ${task.dependencies.length} dependencies...`);

    const unresolved: string[] = [];

    for (const depId of task.dependencies) {
      const isResolved = await this.checkDependency(depId);

      if (!isResolved) {
        unresolved.push(depId);
      }
    }

    if (unresolved.length > 0) {
      throw new Error(
        `Unresolved dependencies: ${unresolved.join(', ')}. Cannot proceed.`
      );
    }

    logger.success(`✓ All ${task.dependencies.length} dependencies are resolved`);
  }

  /**
   * Check if a dependency is resolved
   */
  private async checkDependency(depId: string): Promise<boolean> {
    try {
      // Check if dependency task has completed
      // Look for completion marker file
      const markerFile = path.join(
        this.reportDirectory,
        'completed',
        `${depId}.json`
      );

      const exists = fs.existsSync(markerFile);

      if (exists) {
        // Verify the task completed successfully
        const content = await fs.promises.readFile(markerFile, 'utf-8');
        const result = JSON.parse(content);

        return result.status === 'success' || result.status === 'completed';
      }

      return false;
    } catch (error) {
      logger.warning(`Failed to check dependency ${depId}: ${(error as Error).message}`);
      return false;
    }
  }
}
