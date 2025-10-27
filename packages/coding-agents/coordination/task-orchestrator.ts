/**
 * Task Orchestrator - Central Coordinator for Parallel Work
 *
 * Responsibilities:
 * - Task queue management
 * - Worker assignment
 * - Conflict detection
 * - Progress tracking
 */

export interface Task {
  id: string;
  type: 'issue' | 'pr' | 'refactor' | 'test' | 'doc';
  priority: 1 | 2 | 3 | 4 | 5;
  dependencies: string[];
  estimatedDuration: number; // minutes
  requiredSkills: string[];
  assignedTo?: string; // workerId
  status: 'pending' | 'claimed' | 'in_progress' | 'completed' | 'failed';
  metadata: {
    issueNumber?: number;
    branchName?: string;
    files: string[]; // Files to be modified
    description: string;
  };
  createdAt: Date;
  claimedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ClaimResult {
  success: boolean;
  task?: Task;
  error?: string;
  conflictingTasks?: Task[];
}

export interface TaskFilter {
  status?: Task['status'];
  type?: Task['type'];
  priority?: Task['priority'];
  workerId?: string;
}

export class TaskOrchestrator {
  private tasks: Map<string, Task> = new Map();
  private taskQueue: Task[] = [];

  /**
   * Load tasks from GitHub Issues
   */
  async loadTasksFromIssues(): Promise<Task[]> {
    // TODO: Integrate with GitHub Issues API
    // For now, return empty array
    console.log('[TaskOrchestrator] Loading tasks from GitHub Issues...');
    return [];
  }

  /**
   * Add a task to the queue
   */
  addTask(task: Task): void {
    this.tasks.set(task.id, task);
    this.taskQueue.push(task);
    this.sortTaskQueue();
    console.log(`[TaskOrchestrator] Task ${task.id} added (priority: ${task.priority})`);
  }

  /**
   * Get available tasks for a worker
   */
  getAvailableTasks(_workerId: string, workerSkills: string[]): Task[] {
    return this.taskQueue.filter(task => {
      // Must be pending
      if (task.status !== 'pending') return false;

      // Check dependencies
      if (!this.areDependenciesMet(task)) return false;

      // Check skill match
      if (!this.hasRequiredSkills(workerSkills, task.requiredSkills)) return false;

      return true;
    });
  }

  /**
   * Claim a task for a worker
   */
  async claimTask(workerId: string, taskId: string): Promise<ClaimResult> {
    const task = this.tasks.get(taskId);

    if (!task) {
      return {
        success: false,
        error: `Task ${taskId} not found`,
      };
    }

    if (task.status !== 'pending') {
      return {
        success: false,
        error: `Task ${taskId} is not available (status: ${task.status})`,
      };
    }

    // Check for file conflicts
    const conflicts = this.detectFileConflicts(task);
    if (conflicts.length > 0) {
      return {
        success: false,
        error: `File conflicts detected`,
        conflictingTasks: conflicts,
      };
    }

    // Claim the task
    task.status = 'claimed';
    task.assignedTo = workerId;
    task.claimedAt = new Date();

    console.log(`[TaskOrchestrator] Task ${taskId} claimed by worker ${workerId}`);

    return {
      success: true,
      task,
    };
  }

  /**
   * Start task execution
   */
  async startTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);

    if (!task) {
      console.error(`[TaskOrchestrator] Task ${taskId} not found`);
      return false;
    }

    if (task.status !== 'claimed') {
      console.error(`[TaskOrchestrator] Task ${taskId} cannot be started (status: ${task.status})`);
      return false;
    }

    task.status = 'in_progress';
    task.startedAt = new Date();

    console.log(`[TaskOrchestrator] Task ${taskId} started`);
    return true;
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, success: boolean): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      console.error(`[TaskOrchestrator] Task ${taskId} not found`);
      return;
    }

    task.status = success ? 'completed' : 'failed';
    task.completedAt = new Date();

    // Remove from queue
    this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);

    const duration = task.startedAt && task.completedAt
      ? (task.completedAt.getTime() - task.startedAt.getTime()) / 1000 / 60
      : 0;

    console.log(`[TaskOrchestrator] Task ${taskId} ${success ? 'completed' : 'failed'} (${duration.toFixed(1)} min)`);
  }

  /**
   * Release a task (unclaim)
   */
  async releaseTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      console.error(`[TaskOrchestrator] Task ${taskId} not found`);
      return;
    }

    task.status = 'pending';
    task.assignedTo = undefined;
    task.claimedAt = undefined;

    console.log(`[TaskOrchestrator] Task ${taskId} released`);
  }

  /**
   * Get tasks by filter
   */
  getTasks(filter?: TaskFilter): Task[] {
    let filtered = Array.from(this.tasks.values());

    if (filter?.status) {
      filtered = filtered.filter(t => t.status === filter.status);
    }

    if (filter?.type) {
      filtered = filtered.filter(t => t.type === filter.type);
    }

    if (filter?.priority) {
      filtered = filtered.filter(t => t.priority === filter.priority);
    }

    if (filter?.workerId) {
      filtered = filtered.filter(t => t.assignedTo === filter.workerId);
    }

    return filtered;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get worker's current tasks
   */
  getWorkerTasks(workerId: string): Task[] {
    return Array.from(this.tasks.values()).filter(
      task => task.assignedTo === workerId && task.status !== 'completed' && task.status !== 'failed'
    );
  }

  /**
   * Check if task dependencies are met
   */
  private areDependenciesMet(task: Task): boolean {
    return task.dependencies.every(depId => {
      const dep = this.tasks.get(depId);
      return dep?.status === 'completed';
    });
  }

  /**
   * Check if worker has required skills
   */
  private hasRequiredSkills(workerSkills: string[], requiredSkills: string[]): boolean {
    return requiredSkills.every(skill => workerSkills.includes(skill));
  }

  /**
   * Detect file conflicts with other tasks
   */
  private detectFileConflicts(task: Task): Task[] {
    const conflicts: Task[] = [];

    // Check all active tasks
    for (const otherTask of this.tasks.values()) {
      // Skip self
      if (otherTask.id === task.id) continue;

      // Only check claimed or in-progress tasks
      if (otherTask.status !== 'claimed' && otherTask.status !== 'in_progress') continue;

      // Check for overlapping files
      const overlap = task.metadata.files.some(file =>
        otherTask.metadata.files.includes(file)
      );

      if (overlap) {
        conflicts.push(otherTask);
      }
    }

    return conflicts;
  }

  /**
   * Sort task queue by priority (1 = highest)
   */
  private sortTaskQueue(): void {
    this.taskQueue.sort((a, b) => {
      // Priority first
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by creation time (older first)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Get queue statistics
   */
  getStatistics() {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      claimed: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
    };

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'claimed':
          stats.claimed++;
          break;
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    }

    return stats;
  }
}
