/**
 * Unit tests for GitHubProjectsClient
 *
 * Issue #5 Phase A: Data Persistence Layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubProjectsClient } from './client';
import type { ProjectConfig, ProjectInfo, ProjectItem } from './types';

// Mock @octokit modules
vi.mock('@octokit/graphql', () => ({
  graphql: {
    defaults: () => vi.fn(),
  },
}));

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => ({
    rest: {
      rateLimit: {
        get: vi.fn(),
      },
    },
  })),
}));

describe('GitHubProjectsClient', () => {
  let client: GitHubProjectsClient;
  let mockConfig: ProjectConfig;

  beforeEach(() => {
    mockConfig = {
      owner: 'testowner',
      repo: 'testrepo',
      projectNumber: 1,
    };

    client = new GitHubProjectsClient({
      token: 'test-token',
      project: mockConfig,
    });
  });

  describe('constructor', () => {
    it('should create a new client instance', () => {
      expect(client).toBeInstanceOf(GitHubProjectsClient);
    });

    it('should accept configuration options', () => {
      const customClient = new GitHubProjectsClient({
        token: 'test-token',
        project: mockConfig,
        retryOnRateLimit: false,
        maxRetries: 5,
      });

      expect(customClient).toBeInstanceOf(GitHubProjectsClient);
    });
  });

  describe('getFieldValue', () => {
    it('should extract text field value', () => {
      const item: ProjectItem = {
        id: 'item-1',
        content: {
          id: 'issue-1',
          number: 1,
          title: 'Test Issue',
          url: 'https://github.com/test/test/issues/1',
          state: 'OPEN',
        },
        fieldValues: {
          nodes: [
            {
              field: { name: 'Status' },
              text: 'In Progress',
            } as any,
          ],
        },
      };

      // Access private method via any cast for testing
      const value = (client as any).getFieldValue(item, 'Status');
      expect(value).toBe('In Progress');
    });

    it('should extract number field value', () => {
      const item: ProjectItem = {
        id: 'item-1',
        content: {
          id: 'issue-1',
          number: 1,
          title: 'Test Issue',
          url: 'https://github.com/test/test/issues/1',
          state: 'OPEN',
        },
        fieldValues: {
          nodes: [
            {
              field: { name: 'Cost' },
              number: 0.05,
            } as any,
          ],
        },
      };

      const value = (client as any).getFieldValue(item, 'Cost');
      expect(value).toBe(0.05);
    });

    it('should return null for non-existent field', () => {
      const item: ProjectItem = {
        id: 'item-1',
        content: {
          id: 'issue-1',
          number: 1,
          title: 'Test Issue',
          url: 'https://github.com/test/test/issues/1',
          state: 'OPEN',
        },
        fieldValues: {
          nodes: [],
        },
      };

      const value = (client as any).getFieldValue(item, 'NonExistent');
      expect(value).toBeNull();
    });
  });

  // Note: sleep utility test removed as the method is not part of the public or private API
  // If rate limiting delay functionality is needed, it should be tested through the retry mechanism
});

describe('Type guards and validation', () => {
  it('should validate ProjectConfig structure', () => {
    const config: ProjectConfig = {
      owner: 'test',
      repo: 'test',
      projectNumber: 1,
    };

    expect(config.owner).toBe('test');
    expect(config.projectNumber).toBe(1);
  });

  it('should validate ProjectItem structure', () => {
    const item: ProjectItem = {
      id: 'item-1',
      content: {
        id: 'issue-1',
        number: 1,
        title: 'Test',
        url: 'https://github.com/test/test/issues/1',
        state: 'OPEN',
      },
      fieldValues: {
        nodes: [],
      },
    };

    expect(item.content.number).toBe(1);
    expect(item.content.state).toBe('OPEN');
  });
});
