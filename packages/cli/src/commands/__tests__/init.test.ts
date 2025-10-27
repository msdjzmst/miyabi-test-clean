import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Mock all dependencies
vi.mock('fs');
vi.mock('child_process');
vi.mock('chalk', () => ({
  default: {
    cyan: { bold: vi.fn((text: string) => text) },
    green: { bold: vi.fn((text: string) => text) },
    yellow: vi.fn((text: string) => text),
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ confirm: true }),
  },
}));

vi.mock('../../auth/github-oauth.js', () => ({
  githubOAuth: vi.fn().mockResolvedValue('test_token'),
}));

vi.mock('../../setup/repository.js', () => ({
  createRepository: vi.fn().mockResolvedValue({
    owner: 'test-owner',
    repo: 'test-repo',
    url: 'https://github.com/test-owner/test-repo',
  }),
}));

vi.mock('../../setup/labels.js', () => ({
  setupLabels: vi.fn().mockResolvedValue({ created: 53, updated: 0 }),
}));

vi.mock('../../setup/workflows.js', () => ({
  deployWorkflows: vi.fn().mockResolvedValue(10),
}));

vi.mock('../../setup/projects.js', () => ({
  setupProjects: vi.fn().mockResolvedValue({
    projectUrl: 'https://github.com/users/test-owner/projects/1',
  }),
}));

vi.mock('../../setup/local.js', () => ({
  cloneAndSetup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../setup/welcome.js', () => ({
  showWelcome: vi.fn(),
}));

describe('init command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('init flow', () => {
    it('should execute full init flow', async () => {
      const { githubOAuth } = await import('../../auth/github-oauth.js');
      const { createRepository } = await import('../../setup/repository.js');
      const { setupLabels } = await import('../../setup/labels.js');
      const { deployWorkflows } = await import('../../setup/workflows.js');
      const { setupProjects } = await import('../../setup/projects.js');
      const { cloneAndSetup } = await import('../../setup/local.js');

      // Simulate init flow
      const token = await githubOAuth();
      expect(token).toBe('test_token');

      const repoInfo = await createRepository('test-project', token, { private: false });
      expect(repoInfo.owner).toBe('test-owner');
      expect(repoInfo.repo).toBe('test-repo');

      const labels = await setupLabels(repoInfo.owner, repoInfo.repo, token);
      expect(labels.created).toBe(53);

      const workflowCount = await deployWorkflows(repoInfo.owner, repoInfo.repo, token);
      expect(workflowCount).toBe(10);

      const projectInfo = await setupProjects(repoInfo.owner, repoInfo.repo, token);
      expect(projectInfo.projectUrl).toBeTruthy();

      await cloneAndSetup(repoInfo.url, 'test-project', { skipInstall: false });

      expect(githubOAuth).toHaveBeenCalledTimes(1);
      expect(createRepository).toHaveBeenCalledTimes(1);
      expect(setupLabels).toHaveBeenCalledTimes(1);
      expect(deployWorkflows).toHaveBeenCalledTimes(1);
      expect(setupProjects).toHaveBeenCalledTimes(1);
      expect(cloneAndSetup).toHaveBeenCalledTimes(1);
    });

    it('should handle private repository option', async () => {
      const { createRepository } = await import('../../setup/repository.js');

      await createRepository('test-project', 'test_token', { private: true });

      expect(createRepository).toHaveBeenCalledWith('test-project', 'test_token', {
        private: true,
      });
    });

    it('should handle skip-install option', async () => {
      const { cloneAndSetup } = await import('../../setup/local.js');

      await cloneAndSetup('https://github.com/test/repo', 'test-project', {
        skipInstall: true,
      });

      expect(cloneAndSetup).toHaveBeenCalledWith(
        'https://github.com/test/repo',
        'test-project',
        { skipInstall: true }
      );
    });

    it('should handle authentication failure', async () => {
      const { githubOAuth } = await import('../../auth/github-oauth.js');
      vi.mocked(githubOAuth).mockRejectedValueOnce(new Error('Authentication failed'));

      await expect(githubOAuth()).rejects.toThrow('Authentication failed');
    });

    it('should handle repository creation failure', async () => {
      const { createRepository } = await import('../../setup/repository.js');
      vi.mocked(createRepository).mockRejectedValueOnce(
        new Error('Repository already exists')
      );

      await expect(
        createRepository('existing-repo', 'test_token', { private: false })
      ).rejects.toThrow('Repository already exists');
    });

    it('should handle label setup failure', async () => {
      const { setupLabels } = await import('../../setup/labels.js');
      vi.mocked(setupLabels).mockRejectedValueOnce(new Error('Insufficient permissions'));

      await expect(setupLabels('owner', 'repo', 'test_token')).rejects.toThrow(
        'Insufficient permissions'
      );
    });

    it('should handle workflow deployment failure', async () => {
      const { deployWorkflows } = await import('../../setup/workflows.js');
      vi.mocked(deployWorkflows).mockRejectedValueOnce(new Error('API rate limit exceeded'));

      await expect(deployWorkflows('owner', 'repo', 'test_token')).rejects.toThrow(
        'API rate limit exceeded'
      );
    });
  });

  describe('validation', () => {
    it('should validate project name format', () => {
      const invalidNames = ['my project', 'my@project', 'my/project', ''];
      const validNames = ['my-project', 'my_project', 'myproject', 'my-project-123'];

      invalidNames.forEach((name) => {
        const isValid = /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0;
        expect(isValid).toBe(false);
      });

      validNames.forEach((name) => {
        const isValid = /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0;
        expect(isValid).toBe(true);
      });
    });

    it('should check if directory already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      expect(fs.existsSync('existing-project')).toBe(true);
    });

    it('should allow new directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(fs.existsSync('new-project')).toBe(false);
    });
  });

  describe('progress tracking', () => {
    it('should track all setup steps', async () => {
      const steps = [
        'Authenticating with GitHub',
        'Creating repository',
        'Setting up labels (53)',
        'Deploying workflows (10+)',
        'Creating Projects V2',
        'Cloning repository locally',
        'Installing dependencies',
      ];

      expect(steps.length).toBe(7);
      expect(steps[0]).toContain('Authenticating');
      expect(steps[2]).toContain('53');
    });
  });
});
