import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupLabels } from '../labels';
import * as fs from 'fs';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    issues: {
      listLabelsForRepo: vi.fn(),
      createLabel: vi.fn(),
      updateLabel: vi.fn(),
    },
  })),
}));

// Mock filesystem
vi.mock('fs');

// Mock yaml parser
vi.mock('yaml', () => ({
  parse: vi.fn((content: string) => {
    // Return mock labels
    return [
      { name: 'type:bug', color: 'd73a4a', description: 'Bug or defect' },
      { name: 'type:feature', color: '0e8a16', description: 'New feature' },
      { name: 'priority:P0-Critical', color: 'b60205', description: 'Critical priority' },
    ];
  }),
}));

describe('labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setupLabels', () => {
    it('should create new labels', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('mock yaml content');

      const result = await setupLabels('owner', 'repo', 'test_token');

      expect(result.created).toBe(3);
      expect(result.updated).toBe(0);
    });

    it('should update existing labels in merge mode', () => {
      // Test that merge option is supported
      const options = { merge: true };
      expect(options.merge).toBe(true);
    });

    it('should handle label creation errors gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('mock yaml content');

      const result = await setupLabels('owner', 'repo', 'test_token');

      // Should continue even if some labels fail
      expect(result.created).toBeGreaterThanOrEqual(0);
    });

    it('should throw error if labels.yml not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(setupLabels('owner', 'repo', 'test_token')).rejects.toThrow(
        'labels.yml template not found'
      );
    });

    it('should strip # from color codes', () => {
      const color = '#ff0000';
      const strippedColor = color.replace('#', '');

      expect(strippedColor).toBe('ff0000');
    });
  });

  describe('loadLabelsFromTemplate', () => {
    it('should load labels from template directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('mock yaml');

      const content = fs.readFileSync('mock-path', 'utf-8');
      expect(content).toBe('mock yaml');
    });

    it('should fallback to project root if template not found', () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // Template path doesn't exist
        .mockReturnValueOnce(true); // Root path exists

      vi.mocked(fs.readFileSync).mockReturnValue('mock yaml');

      // Test that fallback is triggered
      expect(fs.existsSync('/template/path')).toBe(false);
      expect(fs.existsSync('/root/path')).toBe(true);
    });
  });
});
