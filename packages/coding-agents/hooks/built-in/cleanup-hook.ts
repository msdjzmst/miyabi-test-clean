/**
 * CleanupHook - Cleans up temporary files and resources after execution
 */

import { PostHook, HookContext } from '../../types/hooks';
import { AgentResult } from '../../types/index';
import { logger } from '../../ui/index';
import * as fs from 'fs';
import * as path from 'path';

export class CleanupHook implements PostHook {
  name = 'cleanup';
  description = 'Cleans up temporary files and resources after execution';
  priority = 100; // Run late (after other posthooks)

  private tempDirs: string[] = [];
  private tempFiles: string[] = [];

  constructor(options: { tempDirs?: string[]; tempFiles?: string[] } = {}) {
    this.tempDirs = options.tempDirs || [];
    this.tempFiles = options.tempFiles || [];
  }

  async execute(context: HookContext, _result: AgentResult): Promise<void> {
    logger.info('Starting cleanup...');

    let cleanedFiles = 0;
    let cleanedDirs = 0;

    // Clean up temporary files
    for (const file of this.tempFiles) {
      try {
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file);
          cleanedFiles++;
        }
      } catch (error) {
        logger.warning(`Failed to delete temp file ${file}: ${(error as Error).message}`);
      }
    }

    // Clean up temporary directories
    for (const dir of this.tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          await fs.promises.rm(dir, { recursive: true, force: true });
          cleanedDirs++;
        }
      } catch (error) {
        logger.warning(`Failed to delete temp dir ${dir}: ${(error as Error).message}`);
      }
    }

    // Clean up agent-specific temp files
    await this.cleanupAgentTempFiles(context);

    logger.success(`✓ Cleanup complete: ${cleanedFiles} files, ${cleanedDirs} directories`);
  }

  /**
   * Clean up agent-specific temporary files
   */
  private async cleanupAgentTempFiles(context: HookContext): Promise<void> {
    try {
      const tempDir = path.join(process.cwd(), '.temp', context.agentType);

      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        logger.info(`Cleaned up ${context.agentType} temp directory`);
      }
    } catch (error) {
      logger.warning(`Failed to cleanup agent temp files: ${(error as Error).message}`);
    }
  }

  /**
   * Add temporary file to cleanup list
   */
  addTempFile(filePath: string): void {
    if (!this.tempFiles.includes(filePath)) {
      this.tempFiles.push(filePath);
    }
  }

  /**
   * Add temporary directory to cleanup list
   */
  addTempDir(dirPath: string): void {
    if (!this.tempDirs.includes(dirPath)) {
      this.tempDirs.push(dirPath);
    }
  }

  /**
   * Remove from cleanup list
   */
  removeTempFile(filePath: string): void {
    this.tempFiles = this.tempFiles.filter((f) => f !== filePath);
  }

  /**
   * Remove from cleanup list
   */
  removeTempDir(dirPath: string): void {
    this.tempDirs = this.tempDirs.filter((d) => d !== dirPath);
  }
}
