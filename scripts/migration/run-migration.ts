#!/usr/bin/env node

import { ClaudeToAgentsMigration } from './migrate-claude-to-agents';
import { MigrationValidator } from './post-migration-validator';
import { logger } from '@miyabi/coding-agents/ui/index';

/**
 * Main migration script
 */
async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting .claude/ to agents/ migration');

    // Run migration
    const migration = new ClaudeToAgentsMigration();
    await migration.execute();

    // Validate results
    const validator = new MigrationValidator();
    const isValid = await validator.validate();

    if (!isValid) {
      process.exit(1);
    }

    logger.success('🎉 Migration completed successfully!');
    logger.info('Next steps:');
    logger.info('1. Update any remaining import paths in your codebase');
    logger.info('2. Update documentation to reference agents/ instead of .claude/');
    logger.info('3. Update CI/CD scripts if they reference .claude/');
    logger.info('4. Run tests to ensure everything works correctly');

  } catch (error) {
    logger.error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
