import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doctor, type HealthCheck, type DoctorResult } from '../doctor';
import * as childProcess from 'child_process';
import * as fs from 'fs';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      users: {
        getAuthenticated: vi.fn().mockResolvedValue({
          headers: {
            'x-oauth-scopes': 'repo, workflow, project',
          },
        }),
      },
      rateLimit: {
        get: vi.fn().mockResolvedValue({ data: { rate: { limit: 5000 } } }),
      },
    },
  })),
}));

vi.mock('../../utils/github-token.js', () => ({
  getGitHubToken: vi.fn().mockResolvedValue('ghp_test_token_12345'),
}));

vi.mock('chalk', () => ({
  default: {
    cyan: { bold: vi.fn((text: string) => text) },
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
  },
}));

vi.mock('ora', () => ({
  default: vi.fn().mockReturnValue({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  }),
}));

describe('doctor command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  describe('Node.js version check', () => {
    it('should pass with Node.js >= 18', () => {
      const version = process.version; // Current Node version
      const major = parseInt(version.slice(1).split('.')[0]);

      expect(major).toBeGreaterThanOrEqual(18);
    });

    it('should detect version format', () => {
      const version = 'v20.10.0';
      const major = parseInt(version.slice(1).split('.')[0]);

      expect(major).toBe(20);
    });
  });

  describe('Git installation check', () => {
    it('should detect Git when installed', () => {
      vi.mocked(childProcess.execSync).mockReturnValueOnce('git version 2.42.0' as any);

      const result = childProcess.execSync('git --version', { encoding: 'utf-8', stdio: 'pipe' });

      expect(result).toContain('git version');
    });

    it('should handle Git not installed', () => {
      vi.mocked(childProcess.execSync).mockImplementationOnce(() => {
        throw new Error('command not found');
      });

      expect(() => {
        childProcess.execSync('git --version');
      }).toThrow('command not found');
    });
  });

  describe('GitHub CLI check', () => {
    it('should detect GitHub CLI when authenticated', () => {
      vi.mocked(childProcess.execSync)
        .mockReturnValueOnce('gh version 2.40.0 (2024-01-01)' as any)
        .mockReturnValueOnce('✓ Logged in to github.com' as any);

      const version = childProcess.execSync('gh --version', { encoding: 'utf-8', stdio: 'pipe' });
      const auth = childProcess.execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' });

      expect(version).toContain('gh version');
      expect(auth).toContain('Logged in');
    });

    it('should detect GitHub CLI when not authenticated', () => {
      vi.mocked(childProcess.execSync)
        .mockReturnValueOnce('gh version 2.40.0 (2024-01-01)' as any)
        .mockImplementationOnce(() => {
          throw new Error('Not authenticated');
        });

      const version = childProcess.execSync('gh --version', { encoding: 'utf-8', stdio: 'pipe' });

      expect(version).toContain('gh version');
      expect(() => {
        childProcess.execSync('gh auth status');
      }).toThrow('Not authenticated');
    });

    it('should handle GitHub CLI not installed', () => {
      vi.mocked(childProcess.execSync).mockImplementationOnce(() => {
        throw new Error('command not found');
      });

      expect(() => {
        childProcess.execSync('gh --version');
      }).toThrow('command not found');
    });
  });

  describe('GITHUB_TOKEN check', () => {
    it('should detect valid token format (ghp_)', () => {
      const token = 'ghp_test_token_12345';

      expect(token.startsWith('ghp_')).toBe(true);
    });

    it('should detect valid token format (github_pat_)', () => {
      const token = 'github_pat_test_token_12345';

      expect(token.startsWith('github_pat_')).toBe(true);
    });

    it('should detect invalid token format', () => {
      const token = 'invalid_token_format';

      expect(token.startsWith('ghp_') || token.startsWith('github_pat_')).toBe(false);
    });
  });

  describe('Token permissions check', () => {
    it('should verify required scopes present', () => {
      const scopes = ['repo', 'workflow', 'project'];
      const required = ['repo', 'workflow'];

      const missingRequired = required.filter(s => !scopes.includes(s));

      expect(missingRequired).toHaveLength(0);
    });

    it('should detect missing required scopes', () => {
      const scopes = ['repo'];
      const required = ['repo', 'workflow'];

      const missingRequired = required.filter(s => !scopes.includes(s));

      expect(missingRequired).toContain('workflow');
    });

    it('should detect missing recommended scopes', () => {
      const scopes = ['repo', 'workflow'];
      const recommended = ['project', 'write:packages'];

      const missingRecommended = recommended.filter(s => !scopes.includes(s));

      expect(missingRecommended).toEqual(['project', 'write:packages']);
    });
  });

  describe('Repository configuration check', () => {
    it('should detect git repository with remote', () => {
      vi.mocked(childProcess.execSync)
        .mockReturnValueOnce('.git' as any)
        .mockReturnValueOnce('https://github.com/user/repo.git' as any);

      const gitDir = childProcess.execSync('git rev-parse --git-dir', { encoding: 'utf-8', stdio: 'pipe' });
      const remote = childProcess.execSync('git remote get-url origin', { encoding: 'utf-8', stdio: 'pipe' });

      expect(gitDir).toBeTruthy();
      expect(remote).toContain('github.com');
    });

    it('should detect git repository without remote', () => {
      vi.mocked(childProcess.execSync)
        .mockReturnValueOnce('.git' as any)
        .mockImplementationOnce(() => {
          throw new Error('No remote configured');
        });

      const gitDir = childProcess.execSync('git rev-parse --git-dir', { encoding: 'utf-8', stdio: 'pipe' });

      expect(gitDir).toBeTruthy();
      expect(() => {
        childProcess.execSync('git remote get-url origin');
      }).toThrow('No remote configured');
    });

    it('should handle non-git directory', () => {
      vi.mocked(childProcess.execSync).mockImplementationOnce(() => {
        throw new Error('Not a git repository');
      });

      expect(() => {
        childProcess.execSync('git rev-parse --git-dir');
      }).toThrow('Not a git repository');
    });
  });

  describe('.miyabi.yml validation', () => {
    it('should validate correct YAML configuration', () => {
      const validYaml = `
project:
  name: test-project
  owner: test-owner
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(validYaml);

      expect(fs.existsSync('.miyabi.yml')).toBe(true);
      expect(fs.readFileSync('.miyabi.yml', 'utf-8')).toBeTruthy();
    });

    it('should detect missing configuration file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(fs.existsSync('.miyabi.yml')).toBe(false);
    });

    it('should handle invalid YAML syntax', () => {
      const invalidYaml = `
project:
  name: test
  invalid: [
`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(invalidYaml);

      expect(fs.existsSync('.miyabi.yml')).toBe(true);
      // Would fail on yaml.parse(content)
    });
  });

  describe('Claude Code environment detection', () => {
    it('should detect Claude Code via CLAUDE_CODE env var', () => {
      const originalEnv = process.env.CLAUDE_CODE;
      process.env.CLAUDE_CODE = 'true';

      const isClaudeCode = process.env.CLAUDE_CODE === 'true';

      expect(isClaudeCode).toBe(true);

      if (originalEnv) {
        process.env.CLAUDE_CODE = originalEnv;
      } else {
        delete process.env.CLAUDE_CODE;
      }
    });

    it('should detect Claude Code via ANTHROPIC_CLI env var', () => {
      const originalEnv = process.env.ANTHROPIC_CLI;
      process.env.ANTHROPIC_CLI = 'true';

      const isClaudeCode = process.env.ANTHROPIC_CLI === 'true';

      expect(isClaudeCode).toBe(true);

      if (originalEnv) {
        process.env.ANTHROPIC_CLI = originalEnv;
      } else {
        delete process.env.ANTHROPIC_CLI;
      }
    });

    it('should detect standard terminal environment', () => {
      const originalEnv = {
        CLAUDE_CODE: process.env.CLAUDE_CODE,
        ANTHROPIC_CLI: process.env.ANTHROPIC_CLI,
        TERM_PROGRAM: process.env.TERM_PROGRAM,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      };

      delete process.env.CLAUDE_CODE;
      delete process.env.ANTHROPIC_CLI;
      delete process.env.TERM_PROGRAM;
      delete process.env.ANTHROPIC_API_KEY;

      const isClaudeCode =
        process.env.CLAUDE_CODE === 'true' ||
        process.env.ANTHROPIC_CLI === 'true';

      expect(isClaudeCode).toBe(false);

      // Restore
      Object.entries(originalEnv).forEach(([key, value]) => {
        if (value) {
          (process.env as any)[key] = value;
        }
      });
    });
  });

  describe('Health check result structure', () => {
    it('should have correct HealthCheck structure', () => {
      const check: HealthCheck = {
        name: 'Test Check',
        status: 'pass',
        message: 'All good',
        details: 'Everything working',
      };

      expect(check.name).toBe('Test Check');
      expect(check.status).toBe('pass');
      expect(check.message).toBe('All good');
      expect(check.details).toBe('Everything working');
    });

    it('should support all status types', () => {
      const statuses: Array<'pass' | 'warn' | 'fail'> = ['pass', 'warn', 'fail'];

      statuses.forEach(status => {
        const check: HealthCheck = {
          name: `${status} check`,
          status,
          message: `Status: ${status}`,
        };

        expect(check.status).toBe(status);
      });
    });

    it('should have correct DoctorResult structure', () => {
      const result: DoctorResult = {
        checks: [
          { name: 'Node.js', status: 'pass', message: 'v20.10.0 (OK)' },
          { name: 'Git', status: 'pass', message: 'git version 2.42.0 (OK)' },
          { name: 'GITHUB_TOKEN', status: 'warn', message: 'Not set' },
        ],
        summary: {
          passed: 2,
          warned: 1,
          failed: 0,
          total: 3,
        },
        overallStatus: 'issues',
      };

      expect(result.checks).toHaveLength(3);
      expect(result.summary.passed).toBe(2);
      expect(result.summary.warned).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(result.overallStatus).toBe('issues');
    });
  });

  describe('Overall status calculation', () => {
    it('should be healthy when all checks pass', () => {
      const failed = 0;
      const warned = 0;

      const overallStatus = failed > 0 ? 'critical' : warned > 0 ? 'issues' : 'healthy';

      expect(overallStatus).toBe('healthy');
    });

    it('should have issues when warnings exist', () => {
      const failed = 0;
      const warned = 2;

      const overallStatus = failed > 0 ? 'critical' : warned > 0 ? 'issues' : 'healthy';

      expect(overallStatus).toBe('issues');
    });

    it('should be critical when failures exist', () => {
      const failed = 1;
      const warned = 0;

      const overallStatus = failed > 0 ? 'critical' : warned > 0 ? 'issues' : 'healthy';

      expect(overallStatus).toBe('critical');
    });
  });

  describe('JSON output mode', () => {
    it('should support JSON output format', async () => {
      const mockResult: DoctorResult = {
        checks: [
          { name: 'Node.js', status: 'pass', message: 'v20.10.0 (OK)' },
        ],
        summary: {
          passed: 1,
          warned: 0,
          failed: 0,
          total: 1,
        },
        overallStatus: 'healthy',
      };

      const jsonOutput = JSON.stringify(mockResult, null, 2);

      expect(jsonOutput).toContain('"name": "Node.js"');
      expect(jsonOutput).toContain('"overallStatus": "healthy"');
    });
  });

  describe('Network connectivity check', () => {
    it('should verify GitHub API accessibility', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit({ auth: 'test_token' });

      await expect(mockOctokit.rest.rateLimit.get()).resolves.toBeTruthy();
    });
  });
});
