/**
 * Task Scheduler - Priority-based scheduling for parallel execution
 *
 * Manages execution order of task groups based on:
 * - DAG level (dependencies)
 * - Priority
 * - System resources
 * - Running vs waiting groups
 */

import type { TaskGroup } from '../types/index';

export type SchedulerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface SchedulerState {
  status: SchedulerStatus;
  totalGroups: number;
  completedGroups: number;
  runningGroups: number;
  waitingGroups: number;
  failedGroups: number;
  startTime?: number;
  endTime?: number;
  currentConcurrency: number;
  maxConcurrency: number;
}

export interface ScheduledGroup extends TaskGroup {
  status: 'waiting' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  error?: string;
  retryCount: number;
}

export interface SchedulerConfig {
  maxConcurrency: number;
  maxRetries: number;  // Default: 2
  retryDelayMs: number;  // Default: 5000 (5 seconds)
  enableAdaptiveScheduling: boolean;  // Default: true
}

const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrency: 5,
  maxRetries: 2,
  retryDelayMs: 5000,
  enableAdaptiveScheduling: true,
};

export class TaskScheduler {
  private config: SchedulerConfig;
  private groups: ScheduledGroup[];
  private state: SchedulerState;
  private runningGroupIds: Set<string>;
  private completedGroupIds: Set<string>;
  private failedGroupIds: Set<string>;

  constructor(groups: TaskGroup[], config?: Partial<SchedulerConfig>) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.groups = groups.map(g => ({
      ...g,
      status: 'waiting' as const,
      retryCount: 0,
    }));
    this.runningGroupIds = new Set();
    this.completedGroupIds = new Set();
    this.failedGroupIds = new Set();
    this.state = this.initializeState();
  }

  /**
   * Initialize scheduler state
   */
  private initializeState(): SchedulerState {
    return {
      status: 'idle',
      totalGroups: this.groups.length,
      completedGroups: 0,
      runningGroups: 0,
      waitingGroups: this.groups.length,
      failedGroups: 0,
      currentConcurrency: 0,
      maxConcurrency: this.config.maxConcurrency,
    };
  }

  /**
   * Get current scheduler state
   */
  public getState(): SchedulerState {
    return { ...this.state };
  }

  /**
   * Get all scheduled groups
   */
  public getGroups(): ScheduledGroup[] {
    return [...this.groups];
  }

  /**
   * Get next group to execute
   *
   * Selection criteria:
   * 1. DAG level (lower first - respect dependencies)
   * 2. Not blocked by running dependencies
   * 3. Priority (higher first)
   * 4. Estimated duration (shorter first for quick wins)
   */
  public getNextGroup(): ScheduledGroup | null {
    // Check if we're at max concurrency
    if (this.runningGroupIds.size >= this.config.maxConcurrency) {
      return null;
    }

    // Get waiting groups
    const waitingGroups = this.groups.filter(g => g.status === 'waiting');

    if (waitingGroups.length === 0) {
      return null;
    }

    // Find groups whose dependencies are completed
    const executableGroups = waitingGroups.filter(g => {
      // Check if all tasks in previous levels are completed
      const currentLevel = g.level;
      const previousLevelGroups = this.groups.filter(
        pg => pg.level < currentLevel
      );

      // All previous level groups must be completed or running
      return previousLevelGroups.every(
        pg => pg.status === 'completed' || pg.status === 'running'
      );
    });

    if (executableGroups.length === 0) {
      return null;
    }

    // Sort by priority and duration
    const sortedGroups = executableGroups.sort((a, b) => {
      // Level first
      if (a.level !== b.level) {
        return a.level - b.level;
      }

      // Priority second
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Duration third (shorter first)
      return a.estimatedDurationMs - b.estimatedDurationMs;
    });

    return sortedGroups[0];
  }

  /**
   * Mark group as started
   */
  public startGroup(groupId: string): void {
    const group = this.groups.find(g => g.groupId === groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    if (group.status !== 'waiting') {
      throw new Error(`Group ${groupId} is not in waiting state: ${group.status}`);
    }

    group.status = 'running';
    group.startTime = Date.now();

    this.runningGroupIds.add(groupId);

    this.updateState({
      runningGroups: this.runningGroupIds.size,
      waitingGroups: this.groups.filter(g => g.status === 'waiting').length,
    });

    if (this.state.status === 'idle') {
      this.state.status = 'running';
      this.state.startTime = Date.now();
    }
  }

  /**
   * Mark group as completed
   */
  public completeGroup(groupId: string): void {
    const group = this.groups.find(g => g.groupId === groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    if (group.status !== 'running') {
      throw new Error(`Group ${groupId} is not running: ${group.status}`);
    }

    group.status = 'completed';
    group.endTime = Date.now();
    group.durationMs = group.endTime - (group.startTime || group.endTime);

    this.runningGroupIds.delete(groupId);
    this.completedGroupIds.add(groupId);

    this.updateState({
      completedGroups: this.completedGroupIds.size,
      runningGroups: this.runningGroupIds.size,
      waitingGroups: this.groups.filter(g => g.status === 'waiting').length,
    });

    // Check if all groups are completed
    if (this.completedGroupIds.size + this.failedGroupIds.size === this.groups.length) {
      this.state.status = 'completed';
      this.state.endTime = Date.now();
    }
  }

  /**
   * Mark group as failed
   */
  public failGroup(groupId: string, error: string): void {
    const group = this.groups.find(g => g.groupId === groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    group.error = error;
    group.retryCount++;

    // Retry if under max retries
    if (group.retryCount <= this.config.maxRetries) {
      group.status = 'waiting';
      this.runningGroupIds.delete(groupId);

      this.updateState({
        runningGroups: this.runningGroupIds.size,
        waitingGroups: this.groups.filter(g => g.status === 'waiting').length,
      });

      return;
    }

    // Max retries exceeded - mark as failed
    group.status = 'failed';
    group.endTime = Date.now();

    this.runningGroupIds.delete(groupId);
    this.failedGroupIds.add(groupId);

    this.updateState({
      failedGroups: this.failedGroupIds.size,
      runningGroups: this.runningGroupIds.size,
      waitingGroups: this.groups.filter(g => g.status === 'waiting').length,
    });

    // Check if all groups are done
    if (this.completedGroupIds.size + this.failedGroupIds.size === this.groups.length) {
      this.state.status = this.failedGroupIds.size > 0 ? 'failed' : 'completed';
      this.state.endTime = Date.now();
    }
  }

  /**
   * Pause scheduler
   */
  public pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
    }
  }

  /**
   * Resume scheduler
   */
  public resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
    }
  }

  /**
   * Update scheduler state
   */
  private updateState(updates: Partial<SchedulerState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Calculate progress percentage
   */
  public getProgress(): number {
    if (this.state.totalGroups === 0) {
      return 100;
    }

    return (this.state.completedGroups / this.state.totalGroups) * 100;
  }

  /**
   * Get estimated time remaining
   */
  public getEstimatedTimeRemaining(): number | null {
    if (!this.state.startTime || this.state.completedGroups === 0) {
      return null;
    }

    const elapsedMs = Date.now() - this.state.startTime;
    const avgTimePerGroup = elapsedMs / this.state.completedGroups;
    const remainingGroups = this.state.totalGroups - this.state.completedGroups;

    return avgTimePerGroup * remainingGroups;
  }

  /**
   * Generate progress summary
   */
  public generateProgressSummary(): string {
    const progress = this.getProgress();
    const estimatedRemaining = this.getEstimatedTimeRemaining();
    const elapsedMs = this.state.startTime ? Date.now() - this.state.startTime : 0;

    return `
Scheduler Progress
==================

Status: ${this.state.status.toUpperCase()}
Progress: ${progress.toFixed(1)}% (${this.state.completedGroups}/${this.state.totalGroups})

Groups:
  Completed: ${this.state.completedGroups}
  Running: ${this.state.runningGroups}
  Waiting: ${this.state.waitingGroups}
  Failed: ${this.state.failedGroups}

Timing:
  Elapsed: ${this.formatDuration(elapsedMs)}
  ${estimatedRemaining ? `Estimated Remaining: ${this.formatDuration(estimatedRemaining)}` : 'Estimated Remaining: Calculating...'}

Concurrency:
  Current: ${this.state.runningGroups}
  Max: ${this.state.maxConcurrency}
    `.trim();
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get failed groups
   */
  public getFailedGroups(): ScheduledGroup[] {
    return this.groups.filter(g => g.status === 'failed');
  }

  /**
   * Get running groups
   */
  public getRunningGroups(): ScheduledGroup[] {
    return this.groups.filter(g => g.status === 'running');
  }

  /**
   * Get waiting groups
   */
  public getWaitingGroups(): ScheduledGroup[] {
    return this.groups.filter(g => g.status === 'waiting');
  }

  /**
   * Check if scheduler has work remaining
   */
  public hasWorkRemaining(): boolean {
    return (
      this.state.runningGroups > 0 ||
      this.state.waitingGroups > 0
    );
  }

  /**
   * Check if scheduler can accept more work
   */
  public canAcceptWork(): boolean {
    return (
      this.state.status === 'running' &&
      this.runningGroupIds.size < this.config.maxConcurrency &&
      this.state.waitingGroups > 0
    );
  }
}
