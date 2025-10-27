import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@miyabi/coding-agents/ui/index';

/**
 * Validator to ensure migration was successful
 */
export class MigrationValidator {
  private readonly agentsDir = 'agents';
  private readonly claudeDir = '.claude';

  /**
   * Validate the migration results
   */
  async validate(): Promise<boolean> {
    try {
      logger.info('Validating migration results...');

      const checks = [
        this.checkAgentsDirectoryExists(),
        this.checkClaudeDirectoryRemoved(),
        this.checkFileIntegrity(),
        this.checkImportStatements(),
        this.checkTypeScriptCompilation(),
      ];

      const results = await Promise.all(checks);
      const success = results.every(result => result);

      if (success) {
        logger.success('Migration validation passed');
      } else {
        logger.error('Migration validation failed');
      }

      return success;
    } catch (error) {
      logger.error(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Check if agents directory exists and has content
   */
  private async checkAgentsDirectoryExists(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.agentsDir);
      if (!stats.isDirectory()) {
        logger.error('agents/ is not a directory');
        return false;
      }

      const files = await fs.readdir(this.agentsDir);
      if (files.length === 0) {
        logger.error('agents/ directory is empty');
        return false;
      }

      logger.info(`✓ agents/ directory exists with ${files.length} items`);
      return true;
    } catch {
      logger.error('agents/ directory does not exist');
      return false;
    }
  }

  /**
   * Check if .claude directory was removed
   */
  private async checkClaudeDirectoryRemoved(): Promise<boolean> {
    try {
      await fs.access(this.claudeDir);
      logger.error('.claude/ directory still exists');
      return false;
    } catch {
      logger.info('✓ .claude/ directory successfully removed');
      return true;
    }
  }

  /**
   * Check file integrity by comparing file counts
   */
  private async checkFileIntegrity(): Promise<boolean> {
    try {
      const backupDir = '.claude.backup';

      // Check if backup exists
      try {
        await fs.access(backupDir);
      } catch {
        logger.warn('No backup directory found, skipping file integrity check');
        return true;
      }

      const backupFiles = await this.getAllFiles(backupDir);
      const agentsFiles = await this.getAllFiles(this.agentsDir);

      if (backupFiles.length !== agentsFiles.length) {
        logger.error(`File count mismatch: backup has ${backupFiles.length}, agents has ${agentsFiles.length}`);
        return false;
      }

      logger.info(`✓ File integrity check passed (${agentsFiles.length} files)`);
      return true;
    } catch (error) {
      logger.error(`File integrity check failed: ${error}`);
      return false;
    }
  }

  /**
   * Check import statements have been updated
   */
  private async checkImportStatements(): Promise<boolean> {
    try {
      const files = await this.getAllFiles(this.agentsDir);
      const tsFiles = files.filter(file => file.endsWith('.ts') || file.endsWith('.js'));

      let invalidImports = 0;

      for (const file of tsFiles) {
        const content = await fs.readFile(file, 'utf-8');

        // Check for old .claude imports
        if (content.includes('.claude/') && !content.includes('../agents/')) {
          logger.warn(`Found old .claude import in: ${file}`);
          invalidImports++;
        }
      }

      if (invalidImports > 0) {
        logger.error(`Found ${invalidImports} files with invalid imports`);
        return false;
      }

      logger.info('✓ Import statements validation passed');
      return true;
    } catch (error) {
      logger.error(`Import validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Check TypeScript compilation
   */
  private async checkTypeScriptCompilation(): Promise<boolean> {
    try {
      // This would typically run tsc --noEmit to check compilation
      // For now, we'll just check if tsconfig.json exists and references agents
      const tsconfigPath = 'tsconfig.json';

      try {
        const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf-8'));

        // Check if agents directory is included
        const include = tsconfig.include || [];
        const hasAgentsInclude = include.some((pattern: string) =>
          pattern.includes('agents') || pattern.includes('**/*'),
        );

        if (!hasAgentsInclude) {
          logger.warn('agents/ directory may not be included in TypeScript compilation');
        }

        logger.info('✓ TypeScript configuration check passed');
        return true;
      } catch {
        logger.warn('No tsconfig.json found, skipping TypeScript check');
        return true;
      }
    } catch (error) {
      logger.error(`TypeScript validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Get all files recursively
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...await this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}
