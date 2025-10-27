import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@miyabi/coding-agents/ui/index';

/**
 * Migration script to move files from .claude/ to agents/
 */
export class ClaudeToAgentsMigration {
  private readonly sourceDir = '.claude';
  private readonly targetDir = 'agents';
  private readonly backupDir = '.claude.backup';

  /**
   * Execute the migration process
   */
  async execute(): Promise<void> {
    try {
      logger.info('Starting migration from .claude/ to agents/');

      await this.validateDirectories();
      await this.createBackup();
      await this.migrateFiles();
      await this.updateImports();
      await this.cleanup();

      logger.success('Migration completed successfully');
    } catch (error) {
      logger.error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.rollback();
      throw error;
    }
  }

  /**
   * Validate source and target directories
   */
  private async validateDirectories(): Promise<void> {
    // Check if source directory exists
    try {
      await fs.access(this.sourceDir);
    } catch {
      throw new Error(`Source directory ${this.sourceDir} does not exist`);
    }

    // Create target directory if it doesn't exist
    try {
      await fs.mkdir(this.targetDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create target directory: ${error}`);
    }
  }

  /**
   * Create backup of existing .claude directory
   */
  private async createBackup(): Promise<void> {
    try {
      // Remove existing backup if it exists
      try {
        await fs.rm(this.backupDir, { recursive: true, force: true });
      } catch {
        // Ignore if backup doesn't exist
      }

      // Copy .claude to backup
      await this.copyDirectory(this.sourceDir, this.backupDir);
      logger.info(`Backup created at ${this.backupDir}`);
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  /**
   * Migrate files from .claude to agents
   */
  private async migrateFiles(): Promise<void> {
    const files = await this.getAllFiles(this.sourceDir);

    for (const file of files) {
      const relativePath = path.relative(this.sourceDir, file);
      const targetPath = path.join(this.targetDir, relativePath);

      // Ensure target directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Copy file
      await fs.copyFile(file, targetPath);
      logger.info(`Migrated: ${relativePath}`);
    }
  }

  /**
   * Update import statements in migrated files
   */
  private async updateImports(): Promise<void> {
    const files = await this.getAllFiles(this.targetDir);
    const tsFiles = files.filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of tsFiles) {
      await this.updateFileImports(file);
    }
  }

  /**
   * Update import statements in a single file
   */
  private async updateFileImports(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Update import paths
      const updatedContent = content
        .replace(/from\s+['"]\.claude\//g, "from '.claude/")
        .replace(/import\s+['"]\.claude\//g, "import '.claude/")
        .replace(/require\(['"]\.claude\//g, "require('.claude/");

      if (content !== updatedContent) {
        await fs.writeFile(filePath, updatedContent, 'utf-8');
        logger.info(`Updated imports in: ${path.relative(process.cwd(), filePath)}`);
      }
    } catch (error) {
      logger.warn(`Failed to update imports in ${filePath}: ${error}`);
    }
  }

  /**
   * Clean up old .claude directory
   */
  private async cleanup(): Promise<void> {
    try {
      await fs.rm(this.sourceDir, { recursive: true, force: true });
      logger.info('Removed old .claude directory');
    } catch (error) {
      logger.warn(`Failed to remove old directory: ${error}`);
    }
  }

  /**
   * Rollback migration in case of failure
   */
  private async rollback(): Promise<void> {
    try {
      logger.warn('Rolling back migration...');

      // Remove agents directory if it was created
      await fs.rm(this.targetDir, { recursive: true, force: true });

      // Restore from backup
      if (await this.exists(this.backupDir)) {
        await this.copyDirectory(this.backupDir, this.sourceDir);
        await fs.rm(this.backupDir, { recursive: true, force: true });
      }

      logger.info('Rollback completed');
    } catch (error) {
      logger.error(`Rollback failed: ${error}`);
    }
  }

  /**
   * Get all files in a directory recursively
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

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Check if file or directory exists
   */
  private async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
