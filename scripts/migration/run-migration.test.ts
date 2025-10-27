import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from './migrate';

// Mock external dependencies
vi.mock('./migrate-claude-to-agents.js', () => ({
  ClaudeToAgentsMigration: vi.fn().mockImplementation(() => ({
    execute: vi.fn()
  }))
}));

vi.mock('./post-migration-validator.js', () => ({
  MigrationValidator: vi.fn().mockImplementation(() => ({
    validate: vi.fn()
  }))
}));

vi.mock('../src/ui/index.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Import mocked classes and logger after mocking
import { ClaudeToAgentsMigration } from './migrate-claude-to-agents';
import { MigrationValidator } from './post-migration-validator';
import { logger } from '@miyabi/coding-agents/ui/index';

describe('Migration Script', () => {
  let mockMigration: any;
  let mockValidator: any;
  let originalProcessExit: typeof process.exit;
  let processExitSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create fresh mock instances
    mockMigration = {
      execute: vi.fn()
    };
    mockValidator = {
      validate: vi.fn()
    };
    
    // Setup mock constructors to return our mock instances
    (ClaudeToAgentsMigration as any).mockImplementation(() => mockMigration);
    (MigrationValidator as any).mockImplementation(() => mockValidator);
    
    // Mock process.exit to prevent actual exits during tests
    originalProcessExit = process.exit;
    processExitSpy = vi.fn();
    process.exit = processExitSpy as any;
  });

  afterEach(() => {
    // Restore original process.exit
    process.exit = originalProcessExit;
  });

  describe('main function', () => {
    it('should complete successful migration flow', async () => {
      // Arrange
      mockMigration.execute.mockResolvedValue(undefined);
      mockValidator.validate.mockResolvedValue(true);

      // Act
      await main();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('🚀 Starting .claude/ to agents/ migration');
      expect(ClaudeToAgentsMigration).toHaveBeenCalledOnce();
      expect(mockMigration.execute).toHaveBeenCalledOnce();
      expect(MigrationValidator).toHaveBeenCalledOnce();
      expect(mockValidator.validate).toHaveBeenCalledOnce();
      expect(logger.success).toHaveBeenCalledWith('🎉 Migration completed successfully!');
      
      // Check that all next steps are logged
      expect(logger.info).toHaveBeenCalledWith('Next steps:');
      expect(logger.info).toHaveBeenCalledWith('1. Update any remaining import paths in your codebase');
      expect(logger.info).toHaveBeenCalledWith('2. Update documentation to reference agents/ instead of .claude/');
      expect(logger.info).toHaveBeenCalledWith('3. Update CI/CD scripts if they reference .claude/');
      expect(logger.info).toHaveBeenCalledWith('4. Run tests to ensure everything works correctly');
      
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should exit with code 1 when migration execution fails', async () => {
      // Arrange
      const errorMessage = 'Migration execution failed';
      const error = new Error(errorMessage);
      mockMigration.execute.mockRejectedValue(error);

      // Act
      await main();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('🚀 Starting .claude/ to agents/ migration');
      expect(ClaudeToAgentsMigration).toHaveBeenCalledOnce();
      expect(mockMigration.execute).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith(`Migration failed: ${errorMessage}`);
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      // Should not proceed to validation
      expect(MigrationValidator).not.toHaveBeenCalled();
      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should exit with code 1 when validation fails', async () => {
      // Arrange
      mockMigration.execute.mockResolvedValue(undefined);
      mockValidator.validate.mockResolvedValue(false);

      // Act
      await main();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('🚀 Starting .claude/ to agents/ migration');
      expect(ClaudeToAgentsMigration).toHaveBeenCalledOnce();
      expect(mockMigration.execute).toHaveBeenCalledOnce();
      expect(MigrationValidator).toHaveBeenCalledOnce();
      expect(mockValidator.validate).toHaveBeenCalledOnce();
      expect(processExitSpy).toHaveBeenCalledWith(1);
      
      // Should not show success message
      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should handle validation error and exit with code 1', async () => {
      // Arrange
      const validationError = new Error('Validation process failed');
      mockMigration.execute.mockResolvedValue(undefined);
      mockValidator.validate.mockRejectedValue(validationError);

      // Act
      await main();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('🚀 Starting .claude/ to agents/ migration');
      expect(ClaudeToAgentsMigration).toHaveBeenCalledOnce();
      expect(mockMigration.execute).toHaveBeenCalledOnce();
      expect(MigrationValidator).toHaveBeenCalledOnce();
      expect(mockValidator.validate).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledWith('Migration failed: Validation process failed');
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should handle non-Error objects thrown during migration', async () => {
      // Arrange
      const nonErrorObject = 'String error';
      mockMigration.execute.mockRejectedValue(nonErrorObject);

      // Act
      await main();

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Migration failed: Unknown error');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle null/undefined errors', async () => {
      // Arrange
      mockMigration.execute.mockRejectedValue(null);

      // Act
      await main();

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Migration failed: Unknown error');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle empty error message', async () => {
      // Arrange
      const errorWithEmptyMessage = new Error('');
      mockMigration.execute.mockRejectedValue(errorWithEmptyMessage);

      // Act
      await main();

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Migration failed: ');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should create new instances of migration and validator classes', async () => {
      // Arrange
      mockMigration.execute.mockResolvedValue(undefined);
      mockValidator.validate.mockResolvedValue(true);

      // Act
      await main();

      // Assert
      expect(ClaudeToAgentsMigration).toHaveBeenCalledTimes(1);
      expect(ClaudeToAgentsMigration).toHaveBeenCalledWith();
      expect(MigrationValidator).toHaveBeenCalledTimes(1);
      expect(MigrationValidator).toHaveBeenCalledWith();
    });

    it('should log all required next steps in correct order', async () => {
      // Arrange
      mockMigration.execute.mockResolvedValue(undefined);
      mockValidator.validate.mockResolvedValue(true);

      // Act
      await main();

      // Assert
      const logCalls = (logger.info as any).mock.calls;
      
      // Find the index where "Next steps:" is logged
      const nextStepsIndex = logCalls.findIndex((call: any) => call[0] === 'Next steps:');
      expect(nextStepsIndex).toBeGreaterThan(-1);
      
      // Verify the next 4 calls are the steps in correct order
      expect(logCalls[nextStepsIndex + 1][0]).toBe('1. Update any remaining import paths in your codebase');
      expect(logCalls[nextStepsIndex + 2][0]).toBe('2. Update documentation to reference agents/ instead of .claude/');
      expect(logCalls[nextStepsIndex + 3][0]).toBe('3. Update CI/CD scripts if they reference .claude/');
      expect(logCalls[nextStepsIndex + 4][0]).toBe('4. Run tests to ensure everything works correctly');
    });

    it('should handle complex error objects with additional properties', async () => {
      // Arrange
      class CustomError extends Error {
        public code: string;
        public details: object;
        
        constructor(message: string, code: string, details: object) {
          super(message);
          this.code = code;
          this.details = details;
        }
      }
      
      const customError = new CustomError('Complex migration error', 'MIGRATION_001', { step: 'file-copy' });
      mockMigration.execute.mockRejectedValue(customError);

      // Act
      await main();

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Migration failed: Complex migration error');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle migration execution that resolves to a value other than undefined', async () => {
      // Arrange
      mockMigration.execute.mockResolvedValue('some unexpected return value');
      mockValidator.validate.mockResolvedValue(true);

      // Act
      await main();

      // Assert - should still work normally
      expect(logger.success).toHaveBeenCalledWith('🎉 Migration completed successfully!');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should handle validator that returns non-boolean truthy value', async () => {
      // Arrange
      mockMigration.execute.mockResolvedValue(undefined);
      mockValidator.validate.mockResolvedValue('truthy string' as any);

      // Act
      await main();

      // Assert - should treat truthy value as success
      expect(logger.success).toHaveBeenCalledWith('🎉 Migration completed successfully!');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should handle validator that returns non-boolean falsy value', async () => {
      // Arrange
      mockMigration.execute.mockResolvedValue(undefined);
      mockValidator.validate.mockResolvedValue(0 as any);

      // Act
      await main();

      // Assert - should treat falsy value as failure
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(logger.success).not.toHaveBeenCalled();
    });
  });

  describe('logging behavior', () => {
    it('should log initial message before any operations', async () => {
      // Arrange
      let executeCalled = false;
      mockMigration.execute.mockImplementation(() => {
        executeCalled = true;
        return Promise.resolve();
      });
      mockValidator.validate.mockResolvedValue(true);

      // Act
      await main();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('🚀 Starting .claude/ to agents/ migration');
      expect(executeCalled).toBe(true);
      
      // Verify the start message was logged before execute was called
      const logCalls = (logger.info as any).mock.calls;
      expect(logCalls[0][0]).toBe('🚀 Starting .claude/ to agents/ migration');
    });

    it('should not log success message when migration fails', async () => {
      // Arrange
      mockMigration.execute.mockRejectedValue(new Error('test error'));

      // Act
      await main();

      // Assert
      expect(logger.success).not.toHaveBeenCalled();
    });

    it('should not log next steps when validation fails', async () => {
      // Arrange
      mockMigration.execute.mockResolvedValue(undefined);
      mockValidator.validate.mockResolvedValue(false);

      // Act
      await main();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('🚀 Starting .claude/ to agents/ migration');
      expect(logger.info).not.toHaveBeenCalledWith('Next steps:');
    });
  });
});

// Test the direct execution condition (this would be in a separate integration test)
describe('Direct execution check', () => {
  it('should handle import.meta.url comparison', () => {
    // This is more of a documentation test since testing import.meta.url
    // and process.argv in unit tests is complex and environment-dependent
    
    // The condition `import.meta.url === \`file://\${process.argv[1]}\`` 
    // checks if the file is being run directly vs imported
    
    expect(typeof import.meta.url).toBe('string');
    expect(import.meta.url.startsWith('file://')).toBe(true);
  });
});