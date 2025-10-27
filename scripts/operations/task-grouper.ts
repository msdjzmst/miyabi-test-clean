/**
 * Task Grouper - Intelligent task grouping for parallel execution
 *
 * Groups tasks based on:
 * - Dependencies (DAG analysis)
 * - Agent type
 * - Priority
 * - Estimated duration
 *
 * Optimal group size: 5-10 tasks per group for balanced parallelism
 */

import type {
  Task,
  DAG,
  AgentType,
  TaskGroup,
  GroupingConfig,
} from '@miyabi/coding-agents/types/index';

const DEFAULT_CONFIG: GroupingConfig = {
  minGroupSize: 3,
  maxGroupSize: 10,
  maxConcurrentGroups: 5,
  priorityWeight: 0.3,
  durationWeight: 0.4,
  agentWeight: 0.3,
};

export class TaskGrouper {
  private config: GroupingConfig;

  constructor(config?: Partial<GroupingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Group tasks for parallel execution
   *
   * Algorithm:
   * 1. Separate by DAG level (respect dependencies)
   * 2. Within each level, group by agent type
   * 3. Balance group sizes
   * 4. Prioritize high-priority tasks
   */
  public groupTasks(tasks: Task[], dag: DAG, worktreeBasePath: string): TaskGroup[] {
    const groups: TaskGroup[] = [];
    let groupCounter = 0;

    // Process each DAG level
    for (let level = 0; level < dag.levels.length; level++) {
      const levelTaskIds = dag.levels[level];
      const levelTasks = tasks.filter(t => levelTaskIds.includes(t.id));

      // Group by agent type within this level
      const agentGroups = this.groupByAgent(levelTasks);

      // Create balanced groups for each agent type
      for (const [agentType, agentTasks] of agentGroups.entries()) {
        const balancedGroups = this.balanceGroups(agentTasks);

        for (const groupTasks of balancedGroups) {
          const groupId = `group-${groupCounter++}`;
          const estimatedDurationMs = groupTasks.reduce(
            (sum, t) => sum + (t.estimatedDuration || 0) * 60000,
            0,
          );
          const avgPriority = groupTasks.reduce((sum, t) => sum + t.priority, 0) / groupTasks.length;

          groups.push({
            groupId,
            tasks: groupTasks,
            agent: agentType,
            priority: avgPriority,
            estimatedDurationMs,
            worktreePath: `${worktreeBasePath}/${groupId}`,
            level,
          });
        }
      }
    }

    // Sort groups by priority and level
    return this.sortGroups(groups);
  }

  /**
   * Group tasks by agent type
   */
  private groupByAgent(tasks: Task[]): Map<AgentType, Task[]> {
    const agentMap = new Map<AgentType, Task[]>();

    for (const task of tasks) {
      const agentType = task.assignedAgent || 'CodeGenAgent';
      const existing = agentMap.get(agentType) || [];
      existing.push(task);
      agentMap.set(agentType, existing);
    }

    return agentMap;
  }

  /**
   * Balance group sizes
   *
   * Strategy:
   * - If tasks <= maxGroupSize, create single group
   * - Otherwise, split into multiple groups of similar size
   * - Prefer balanced distribution over strict size limits
   */
  private balanceGroups(tasks: Task[]): Task[][] {
    if (tasks.length === 0) {
      return [];
    }

    if (tasks.length <= this.config.maxGroupSize) {
      return [tasks];
    }

    // Calculate optimal number of groups
    const numGroups = Math.ceil(tasks.length / this.config.maxGroupSize);
    const targetGroupSize = Math.ceil(tasks.length / numGroups);

    // Sort tasks by priority (high priority first)
    const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority);

    // Distribute tasks across groups
    const groups: Task[][] = [];
    for (let i = 0; i < numGroups; i++) {
      const start = i * targetGroupSize;
      const end = Math.min(start + targetGroupSize, sortedTasks.length);
      groups.push(sortedTasks.slice(start, end));
    }

    return groups;
  }

  /**
   * Sort groups by priority and level
   *
   * Sorting criteria:
   * 1. DAG level (lower level = higher priority)
   * 2. Group priority (higher priority first)
   * 3. Estimated duration (shorter first for quick wins)
   */
  private sortGroups(groups: TaskGroup[]): TaskGroup[] {
    return groups.sort((a, b) => {
      // Level first (dependencies)
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
  }

  /**
   * Calculate optimal concurrency
   *
   * Based on:
   * - System CPU cores
   * - Available memory
   * - Current system load
   */
  public calculateOptimalConcurrency(groups: TaskGroup[]): number {
    // Get system info
    const cpuCores = this.getCPUCores();
    const availableMemory = this.getAvailableMemoryGB();

    // Conservative estimate: 1 group per 2 CPU cores
    const cpuBasedConcurrency = Math.max(1, Math.floor(cpuCores / 2));

    // Memory-based estimate: 1 group per 2GB RAM
    const memoryBasedConcurrency = Math.max(1, Math.floor(availableMemory / 2));

    // Take minimum of CPU, memory, and max config
    const optimalConcurrency = Math.min(
      cpuBasedConcurrency,
      memoryBasedConcurrency,
      this.config.maxConcurrentGroups,
      groups.length,
    );

    return Math.max(1, optimalConcurrency);
  }

  /**
   * Get CPU core count
   */
  private getCPUCores(): number {
    try {
      const os = require('os');
      return os.cpus().length;
    } catch {
      return 4; // Default fallback
    }
  }

  /**
   * Get available memory in GB
   */
  private getAvailableMemoryGB(): number {
    try {
      const os = require('os');
      const freeMemoryBytes = os.freemem();
      return freeMemoryBytes / (1024 * 1024 * 1024);
    } catch {
      return 8; // Default fallback
    }
  }

  /**
   * Validate group configuration
   */
  public validateGroups(groups: TaskGroup[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty groups
    const emptyGroups = groups.filter(g => g.tasks.length === 0);
    if (emptyGroups.length > 0) {
      errors.push(`Found ${emptyGroups.length} empty groups`);
    }

    // Check for oversized groups
    const oversizedGroups = groups.filter(g => g.tasks.length > this.config.maxGroupSize);
    if (oversizedGroups.length > 0) {
      warnings.push(
        `Found ${oversizedGroups.length} groups exceeding max size (${this.config.maxGroupSize})`,
      );
    }

    // Check for undersized groups
    const undersizedGroups = groups.filter(
      g => g.tasks.length < this.config.minGroupSize && g.tasks.length > 0,
    );
    if (undersizedGroups.length > 0) {
      warnings.push(
        `Found ${undersizedGroups.length} groups below min size (${this.config.minGroupSize})`,
      );
    }

    // Check for duplicate tasks
    const allTaskIds = groups.flatMap(g => g.tasks.map(t => t.id));
    const uniqueTaskIds = new Set(allTaskIds);
    if (allTaskIds.length !== uniqueTaskIds.size) {
      errors.push('Found duplicate tasks across groups');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate execution summary
   */
  public generateSummary(groups: TaskGroup[]): string {
    const totalTasks = groups.reduce((sum, g) => sum + g.tasks.length, 0);
    const totalDurationMs = groups.reduce((sum, g) => sum + g.estimatedDurationMs, 0);
    const optimalConcurrency = this.calculateOptimalConcurrency(groups);

    const agentCounts = new Map<AgentType, number>();
    groups.forEach(g => {
      agentCounts.set(g.agent, (agentCounts.get(g.agent) || 0) + g.tasks.length);
    });

    const levelCounts = new Map<number, number>();
    groups.forEach(g => {
      levelCounts.set(g.level, (levelCounts.get(g.level) || 0) + g.tasks.length);
    });

    return `
Task Grouping Summary
=====================

Total Tasks: ${totalTasks}
Total Groups: ${groups.length}
Optimal Concurrency: ${optimalConcurrency}

Estimated Duration:
- Sequential: ${this.formatDuration(totalDurationMs)}
- Parallel (${optimalConcurrency} concurrent): ${this.formatDuration(totalDurationMs / optimalConcurrency)}

Groups by Agent:
${Array.from(agentCounts.entries())
    .map(([agent, count]) => `  ${agent}: ${count} tasks`)
    .join('\n')}

Groups by DAG Level:
${Array.from(levelCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => `  Level ${level}: ${count} tasks`)
    .join('\n')}

Group Details:
${groups
    .map(
      g =>
        `  ${g.groupId}: ${g.tasks.length} tasks, ${g.agent}, Level ${g.level}, ${this.formatDuration(g.estimatedDurationMs)}`,
    )
    .join('\n')}
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
}
