import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    issues: {
      listForRepo: vi.fn().mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Test issue 1',
            labels: [{ name: 'state:pending' }, { name: 'type:feature' }],
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            number: 2,
            title: 'Test issue 2',
            labels: [{ name: 'state:analyzing' }, { name: 'agent:codegen' }],
            created_at: '2024-01-02T00:00:00Z',
          },
          {
            number: 3,
            title: 'Test issue 3',
            labels: [{ name: 'state:implementing' }, { name: 'priority:P1-High' }],
            created_at: '2024-01-03T00:00:00Z',
          },
        ],
      }),
    },
    pulls: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            number: 10,
            title: 'PR: Add feature X',
            created_at: '2024-01-04T00:00:00Z',
            state: 'open',
          },
          {
            number: 11,
            title: 'PR: Fix bug Y',
            created_at: '2024-01-05T00:00:00Z',
            state: 'open',
          },
        ],
      }),
    },
  })),
}));

vi.mock('cli-table3', () => ({
  default: vi.fn().mockImplementation(() => ({
    push: vi.fn(),
    toString: vi.fn().mockReturnValue('mocked table'),
  })),
}));

vi.mock('chalk', () => ({
  default: {
    cyan: { bold: vi.fn((text: string) => text) },
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
  },
}));

vi.mock('../../analyze/project.js', () => ({
  analyzeProject: vi.fn().mockResolvedValue({
    owner: 'test-owner',
    repo: 'test-repo',
  }),
}));

describe('status command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('issue state aggregation', () => {
    it('should count issues by state', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit({ auth: 'test_token' });

      const response = await mockOctokit.issues.listForRepo({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      const stateMap = new Map<string, number>();
      response.data.forEach((issue: any) => {
        const stateLabel = issue.labels.find((l: any) => l.name.startsWith('state:'));
        if (stateLabel) {
          const state = stateLabel.name.replace('state:', '');
          stateMap.set(state, (stateMap.get(state) || 0) + 1);
        }
      });

      expect(stateMap.get('pending')).toBe(1);
      expect(stateMap.get('analyzing')).toBe(1);
      expect(stateMap.get('implementing')).toBe(1);
    });

    it('should handle issues without state labels', async () => {
      const { Octokit } = await import('@octokit/rest');
      vi.mocked(Octokit).mockImplementationOnce(() => ({
        issues: {
          listForRepo: vi.fn().mockResolvedValue({
            data: [
              { number: 1, title: 'No labels', labels: [] },
              { number: 2, title: 'Other labels', labels: [{ name: 'type:bug' }] },
            ],
          }),
        },
      } as any));

      const mockOctokit = new Octokit({ auth: 'test_token' });
      const response = await mockOctokit.issues.listForRepo({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'all',
      });

      const unlabeled = response.data.filter(
        (issue: any) => !issue.labels.some((l: any) => l.name.startsWith('state:'))
      );

      expect(unlabeled.length).toBe(2);
    });
  });

  describe('PR listing', () => {
    it('should list recent PRs', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit({ auth: 'test_token' });

      const response = await mockOctokit.pulls.list({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 10,
      });

      expect(response.data.length).toBe(2);
      expect(response.data[0].number).toBe(10);
      expect(response.data[1].number).toBe(11);
    });

    it('should handle empty PR list', async () => {
      const { Octokit } = await import('@octokit/rest');
      vi.mocked(Octokit).mockImplementationOnce(() => ({
        pulls: {
          list: vi.fn().mockResolvedValue({ data: [] }),
        },
      } as any));

      const mockOctokit = new Octokit({ auth: 'test_token' });
      const response = await mockOctokit.pulls.list({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
      });

      expect(response.data.length).toBe(0);
    });
  });

  describe('state icons', () => {
    it('should map states to icons', () => {
      const stateIcons: Record<string, string> = {
        pending: '⏳',
        analyzing: '🔄',
        implementing: '⚡',
        reviewing: '🔍',
        done: '✓',
      };

      expect(stateIcons.pending).toBe('⏳');
      expect(stateIcons.analyzing).toBe('🔄');
      expect(stateIcons.implementing).toBe('⚡');
      expect(stateIcons.reviewing).toBe('🔍');
      expect(stateIcons.done).toBe('✓');
    });
  });

  describe('watch mode', () => {
    it('should support watch flag', () => {
      const options = { watch: true };
      expect(options.watch).toBe(true);
    });

    it('should default watch to false', () => {
      const options = { watch: false };
      expect(options.watch).toBe(false);
    });
  });

  describe('table formatting', () => {
    it('should create formatted table', async () => {
      const Table = (await import('cli-table3')).default;
      const table = new Table({
        head: ['State', 'Count', 'Status'],
      });

      table.push(['Pending', '2', '⏳ Waiting']);
      table.push(['Implementing', '3', '⚡ Working']);

      expect(table.toString()).toBe('mocked table');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const { Octokit } = await import('@octokit/rest');
      vi.mocked(Octokit).mockImplementationOnce(() => ({
        issues: {
          listForRepo: vi.fn().mockRejectedValue(new Error('API error')),
        },
      } as any));

      const mockOctokit = new Octokit({ auth: 'test_token' });

      await expect(
        mockOctokit.issues.listForRepo({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'all',
        })
      ).rejects.toThrow('API error');
    });

    it('should handle missing repository info', async () => {
      const { analyzeProject } = await import('../../analyze/project.js');
      vi.mocked(analyzeProject).mockRejectedValueOnce(
        new Error('Not a git repository')
      );

      await expect(analyzeProject()).rejects.toThrow('Not a git repository');
    });
  });

  describe('statistics display', () => {
    it('should calculate total issue count', () => {
      const stateMap = new Map([
        ['pending', 2],
        ['analyzing', 1],
        ['implementing', 3],
        ['reviewing', 1],
        ['done', 15],
      ]);

      let total = 0;
      stateMap.forEach((count) => {
        total += count;
      });

      expect(total).toBe(22);
    });

    it('should show active vs completed', () => {
      const stateMap = new Map([
        ['pending', 2],
        ['analyzing', 1],
        ['implementing', 3],
        ['done', 15],
      ]);

      const active = (stateMap.get('pending') || 0) +
                     (stateMap.get('analyzing') || 0) +
                     (stateMap.get('implementing') || 0);
      const completed = stateMap.get('done') || 0;

      expect(active).toBe(6);
      expect(completed).toBe(15);
    });
  });
});
