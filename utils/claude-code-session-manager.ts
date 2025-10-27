/**
 * Claude Code Session Manager
 *
 * Manages Claude Code Task tool sessions for parallel agent execution.
 * Each session runs in an isolated Git worktree with its own context.
 *
 * Integration with Claude Code's Task tool:
 * - subagent_type: 'general-purpose'
 * - prompt: Generated from task group context
 * - description: Short summary of task group
 */

import type { TaskGroup, AgentResult } from '../packages/coding-agents/types/index';
import * as fs from 'fs';
import * as path from 'path';

export interface SessionConfig {
  worktreeBasePath: string;
  sessionTimeoutMs: number;  // Default: 3600000 (1 hour)
  maxConcurrentSessions: number;  // Default: 5
  enableHealthCheck: boolean;  // Default: true
  healthCheckIntervalMs: number;  // Default: 30000 (30 seconds)
}

export interface ClaudeCodeSession {
  sessionId: string;
  groupId: string;
  worktreePath: string;
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'timeout';
  startTime: number;
  endTime?: number;
  result?: AgentResult;
  error?: string;
  taskResults: Map<string, AgentResult>;
}

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  worktreeBasePath: '.worktrees',
  sessionTimeoutMs: 3600000,  // 1 hour
  maxConcurrentSessions: 5,
  enableHealthCheck: true,
  healthCheckIntervalMs: 30000,  // 30 seconds
};

export class ClaudeCodeSessionManager {
  private config: SessionConfig;
  private activeSessions: Map<string, ClaudeCodeSession>;
  private sessionCounter: number;

  constructor(config?: Partial<SessionConfig>) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    this.activeSessions = new Map();
    this.sessionCounter = 0;

    // Ensure worktree base path exists
    this.ensureWorktreeBasePath();
  }

  /**
   * Create new session for task group
   */
  public async createSession(group: TaskGroup): Promise<ClaudeCodeSession> {
    // Check concurrent session limit
    if (this.activeSessions.size >= this.config.maxConcurrentSessions) {
      throw new Error(
        `Max concurrent sessions (${this.config.maxConcurrentSessions}) reached`,
      );
    }

    const sessionId = this.generateSessionId();
    const worktreePath = path.resolve(this.config.worktreeBasePath, group.groupId);

    const session: ClaudeCodeSession = {
      sessionId,
      groupId: group.groupId,
      worktreePath,
      status: 'initializing',
      startTime: Date.now(),
      taskResults: new Map(),
    };

    this.activeSessions.set(sessionId, session);

    // Create worktree for this session
    await this.createWorktree(worktreePath, group.groupId);

    // Generate execution prompt
    await this.generatePromptFile(worktreePath, group);

    // Generate plans.md for trajectory maintenance
    await this.generatePlansFile(worktreePath, group);

    session.status = 'running';

    return session;
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): ClaudeCodeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Complete session
   */
  public completeSession(
    sessionId: string,
    result: AgentResult,
    taskResults: Map<string, AgentResult>,
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'completed';
    session.endTime = Date.now();
    session.result = result;
    session.taskResults = taskResults;

    // Clean up worktree (optional - keep for debugging)
    // await this.cleanupWorktree(session.worktreePath);
  }

  /**
   * Fail session
   */
  public failSession(sessionId: string, error: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'failed';
    session.endTime = Date.now();
    session.error = error;
  }

  /**
   * Check for session timeouts
   */
  public checkTimeouts(): string[] {
    const timedOutSessions: string[] = [];
    const now = Date.now();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (
        session.status === 'running' &&
        now - session.startTime > this.config.sessionTimeoutMs
      ) {
        session.status = 'timeout';
        session.endTime = now;
        session.error = `Session timeout after ${this.config.sessionTimeoutMs}ms`;
        timedOutSessions.push(sessionId);
      }
    }

    return timedOutSessions;
  }

  /**
   * Generate Claude Code Task tool prompt
   */
  public generateTaskToolPrompt(group: TaskGroup): string {
    const taskList = group.tasks
      .map((t, i) => `${i + 1}. [${t.type}] ${t.title} (${t.estimatedDuration || 'N/A'}min)`)
      .join('\n');

    return `
You are a ${group.agent} executing tasks in worktree: ${group.worktreePath}

## Task Group: ${group.groupId}

### Tasks to Complete (${group.tasks.length} tasks):
${taskList}

### Execution Instructions:

1. **Read the plans.md file** in the worktree root for detailed execution plan
2. **Execute each task sequentially** following the plan
3. **Use Issue Trace Logger** to track progress (if available)
4. **Follow coding standards**:
   - TypeScript strict mode
   - ESLint compliance
   - Write tests for new code
   - Update documentation
5. **Commit changes** after each task with descriptive messages
6. **Handle errors gracefully** and log failures

### Success Criteria:
- All tasks completed successfully
- TypeScript compilation passes (npx tsc --noEmit)
- Tests pass (npm test)
- Code quality score ≥ 80/100

### Output Format:
Return JSON with task results:
\`\`\`json
{
  "groupId": "${group.groupId}",
  "completedTasks": ["task-id-1", "task-id-2"],
  "failedTasks": [],
  "qualityScore": 85,
  "summary": "All tasks completed successfully"
}
\`\`\`

### Agent Type: ${group.agent}
### Priority: ${group.priority}
### Estimated Duration: ${Math.ceil(group.estimatedDurationMs / 60000)} minutes

Start execution now.
    `.trim();
  }

  /**
   * Create Git worktree
   */
  private async createWorktree(worktreePath: string, branchName: string): Promise<void> {
    // Check if worktree already exists
    if (fs.existsSync(worktreePath)) {
      // Clean up existing worktree
      await this.cleanupWorktree(worktreePath);
    }

    // Create worktree
    const { spawn } = await import('child_process');

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('git', ['worktree', 'add', worktreePath, '-b', branchName], {
        cwd: process.cwd(),
      });

      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to create worktree: ${stderr || 'Unknown error'}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Clean up Git worktree
   */
  private async cleanupWorktree(worktreePath: string): Promise<void> {
    const { spawn } = await import('child_process');

    await new Promise<void>((resolve) => {
      const proc = spawn('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: process.cwd(),
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Ignore errors - worktree might not exist
          resolve();
        }
      });

      proc.on('error', () => {
        // Ignore errors
        resolve();
      });
    });
  }

  /**
   * Generate prompt file for Claude Code
   */
  private async generatePromptFile(worktreePath: string, group: TaskGroup): Promise<void> {
    const promptContent = this.generateTaskToolPrompt(group);
    const promptPath = path.join(worktreePath, 'TASK_PROMPT.md');

    await fs.promises.writeFile(promptPath, promptContent, 'utf-8');
  }

  /**
   * Generate plans.md file (Feler's pattern)
   */
  private async generatePlansFile(worktreePath: string, group: TaskGroup): Promise<void> {
    const plansContent = `
# Execution Plan - ${group.groupId}

## Group Information
- **Group ID**: ${group.groupId}
- **Agent**: ${group.agent}
- **Priority**: ${group.priority}
- **Tasks**: ${group.tasks.length}
- **Estimated Duration**: ${Math.ceil(group.estimatedDurationMs / 60000)} minutes

## Tasks

${group.tasks
    .map(
      (task, i) => `
### Task ${i + 1}: ${task.title}

- **ID**: ${task.id}
- **Type**: ${task.type}
- **Priority**: ${task.priority}
- **Estimated Duration**: ${task.estimatedDuration || 'N/A'} minutes
- **Description**: ${task.description}
${task.dependencies.length > 0 ? `- **Dependencies**: ${task.dependencies.join(', ')}` : ''}

**Steps**:
1. Analyze requirements
2. Implement solution
3. Write tests
4. Update documentation
5. Commit changes
`,
    )
    .join('\n')}

## Execution Checklist

- [ ] Read all task descriptions
- [ ] Set up development environment
- [ ] Execute tasks in order
- [ ] Run tests after each task
- [ ] Verify TypeScript compilation
- [ ] Update this file with progress
- [ ] Commit all changes

## Progress Tracking

Update this section as you complete tasks:

| Task | Status | Duration | Notes |
|------|--------|----------|-------|
${group.tasks.map((task) => `| ${task.title} | ⏳ Pending | - | - |`).join('\n')}

## Notes

Add any notes, issues, or observations here during execution.
    `.trim();

    const plansPath = path.join(worktreePath, 'plans.md');
    await fs.promises.writeFile(plansPath, plansContent, 'utf-8');
  }

  /**
   * Ensure worktree base path exists
   */
  private ensureWorktreeBasePath(): void {
    const basePath = path.resolve(this.config.worktreeBasePath);
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${this.sessionCounter++}`;
  }

  /**
   * Get session statistics
   */
  public getStatistics(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    timeout: number;
  } {
    const sessions = Array.from(this.activeSessions.values());

    return {
      total: sessions.length,
      running: sessions.filter((s) => s.status === 'running').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      failed: sessions.filter((s) => s.status === 'failed').length,
      timeout: sessions.filter((s) => s.status === 'timeout').length,
    };
  }

  /**
   * Clean up all sessions
   */
  public async cleanupAll(): Promise<void> {
    const sessions = Array.from(this.activeSessions.values());

    for (const session of sessions) {
      if (fs.existsSync(session.worktreePath)) {
        await this.cleanupWorktree(session.worktreePath);
      }
    }

    this.activeSessions.clear();
  }
}
