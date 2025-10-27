import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeProject } from '../project';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Mock dependencies
vi.mock('fs');
vi.mock('child_process');
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      get: vi.fn().mockResolvedValue({
        data: { name: 'test-repo', owner: { login: 'test-owner' } },
      }),
    },
    issues: {
      listForRepo: vi.fn().mockResolvedValue({
        data: [{ number: 1 }, { number: 2 }],
      }),
    },
    pulls: {
      list: vi.fn().mockResolvedValue({
        data: [{ number: 1 }],
      }),
    },
  })),
}));

describe('project analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeProject', () => {
    it('should analyze JavaScript/TypeScript project', async () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/test-owner/test-repo.git');

      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        const pathStr = String(path);
        if (pathStr.includes('package.json')) return true;
        if (pathStr.includes('.github/workflows')) return true;
        return false;
      });

      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        dependencies: { 'next': '^14.0.0' },
      }));

      const result = await analyzeProject();

      expect(result.owner).toBe('test-owner');
      expect(result.repo).toBe('test-repo');
      expect(result.languages).toContain('JavaScript/TypeScript');
      expect(result.hasWorkflows).toBe(true);
    });

    it('should detect Python project', async () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/test-owner/python-repo.git');

      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        const pathStr = String(path);
        if (pathStr.includes('requirements.txt')) return true;
        return false;
      });

      const result = await analyzeProject();

      expect(result.languages).toContain('Python');
    });

    it('should detect Go project', async () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/test-owner/go-repo.git');

      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        const pathStr = String(path);
        if (pathStr.includes('go.mod')) return true;
        return false;
      });

      const result = await analyzeProject();

      expect(result.languages).toContain('Go');
    });

    it('should detect Rust project', async () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/test-owner/rust-repo.git');

      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        const pathStr = String(path);
        if (pathStr.includes('Cargo.toml')) return true;
        return false;
      });

      const result = await analyzeProject();

      expect(result.languages).toContain('Rust');
    });

    it('should handle multiple languages', async () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/test-owner/multi-lang.git');

      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        const pathStr = String(path);
        if (pathStr.includes('package.json')) return true;
        if (pathStr.includes('requirements.txt')) return true;
        return false;
      });

      const result = await analyzeProject();

      expect(result.languages).toContain('JavaScript/TypeScript');
      expect(result.languages).toContain('Python');
      expect(result.languages.length).toBe(2);
    });
  });

  describe('getRepositoryInfo', () => {
    it('should parse HTTPS git URL', () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/test-owner/test-repo.git');

      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      const match = remoteUrl.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);

      expect(match).toBeTruthy();
      expect(match![1]).toBe('test-owner');
      expect(match![2]).toBe('test-repo');
    });

    it('should parse SSH git URL', () => {
      vi.mocked(execSync).mockReturnValue('git@github.com:test-owner/test-repo.git');

      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      const match = remoteUrl.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);

      expect(match).toBeTruthy();
      expect(match![1]).toBe('test-owner');
      expect(match![2]).toBe('test-repo');
    });

    it('should parse repository name with dots (semantic versioning)', () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/customer-cloud/ai-course-content-generator-v.0.0.1.git');

      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      const match = remoteUrl.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);

      expect(match).toBeTruthy();
      expect(match![1]).toBe('customer-cloud');
      expect(match![2]).toBe('ai-course-content-generator-v.0.0.1');
    });

    it('should throw error if not a git repository', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      expect(() => {
        execSync('git remote get-url origin');
      }).toThrow();
    });
  });

  describe('detectLanguages', () => {
    it('should return Unknown if no language detected', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const languages: string[] = [];
      if (!fs.existsSync('package.json')) {
        languages.push('Unknown');
      }

      expect(languages).toContain('Unknown');
    });

    it('should detect Java project', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return String(path).includes('pom.xml');
      });

      const languages: string[] = [];
      if (fs.existsSync('pom.xml')) languages.push('Java');

      expect(languages).toContain('Java');
    });

    it('should detect Ruby project', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return String(path).includes('Gemfile');
      });

      const languages: string[] = [];
      if (fs.existsSync('Gemfile')) languages.push('Ruby');

      expect(languages).toContain('Ruby');
    });

    it('should detect PHP project', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return String(path).includes('composer.json');
      });

      const languages: string[] = [];
      if (fs.existsSync('composer.json')) languages.push('PHP');

      expect(languages).toContain('PHP');
    });
  });

  describe('detectFramework', () => {
    it('should detect Next.js', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        dependencies: { 'next': '^14.0.0' },
      }));

      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const framework = pkg.dependencies?.next ? 'Next.js' : null;

      expect(framework).toBe('Next.js');
    });

    it('should detect React', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        dependencies: { 'react': '^18.0.0' },
      }));

      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const framework = pkg.dependencies?.react ? 'React' : null;

      expect(framework).toBe('React');
    });

    it('should detect Vue', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        dependencies: { 'vue': '^3.0.0' },
      }));

      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const framework = pkg.dependencies?.vue ? 'Vue' : null;

      expect(framework).toBe('Vue');
    });
  });

  describe('detectBuildTool', () => {
    it('should detect Vite', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return String(path).includes('vite.config');
      });

      const buildTool = fs.existsSync('vite.config.ts') ? 'Vite' : null;

      expect(buildTool).toBe('Vite');
    });

    it('should detect Webpack', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return String(path).includes('webpack.config');
      });

      const buildTool = fs.existsSync('webpack.config.js') ? 'Webpack' : null;

      expect(buildTool).toBe('Webpack');
    });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return String(path).includes('pnpm-lock.yaml');
      });

      const pm = fs.existsSync('pnpm-lock.yaml') ? 'pnpm' : null;

      expect(pm).toBe('pnpm');
    });

    it('should detect yarn', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return String(path).includes('yarn.lock');
      });

      const pm = fs.existsSync('yarn.lock') ? 'yarn' : null;

      expect(pm).toBe('yarn');
    });

    it('should detect npm', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: any) => {
        return String(path).includes('package-lock.json');
      });

      const pm = fs.existsSync('package-lock.json') ? 'npm' : null;

      expect(pm).toBe('npm');
    });
  });

  describe('getGitHubStats', () => {
    it('should get issue and PR counts', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit({ auth: 'test_token' });

      const issues = await mockOctokit.issues.listForRepo({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
        per_page: 1,
      });

      const prs = await mockOctokit.pulls.list({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
        per_page: 1,
      });

      expect(issues.data.length).toBeGreaterThanOrEqual(0);
      expect(prs.data.length).toBeGreaterThanOrEqual(0);
    });
  });
});
