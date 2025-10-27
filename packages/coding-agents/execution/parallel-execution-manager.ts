/**
 * ParallelExecutionManager - Parallel Issue Execution Coordinator
 *
 * Orchestrates parallel execution of multiple issues using:
 * - WorktreeManager: Worktree lifecycle management
 * - WaterSpiderAgent: Session monitoring
 * - InfiniteLoopOrchestrator: Feedback loop control
 * - MetricsCollector: Real-time metrics
 */

import { WorktreeManager, type WorktreeInfo } from '../worktree/worktree-manager';
import { InfiniteLoopOrchestrator } from '../feedback-loop/infinite-loop-orchestrator';
import { GoalManager } from '../feedback-loop/goal-manager';
import { ConsumptionValidator } from '../feedback-loop/consumption-validator';
import { MetricsCollector } from '../feedback-loop/metrics-collector';
import type { Issue, GoalDefinition, FeedbackLoop } from '../types/index';

/**
 * Execution task for an issue
 */
export interface ExecutionTask {
  issue: Issue;
  worktree: WorktreeInfo;
  goal: GoalDefinition;
  loop: FeedbackLoop;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  startTime?: string;
  endTime?: string;
  error?: string;
}

/**
 * Execution progress
 */
export interface ExecutionProgress {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  timeout: number;
  percentage: number;
  estimatedTimeRemaining?: number; // milliseconds
}

/**
 * Execution report
 */
export interface ExecutionReport {
  sessionId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  tasks: ExecutionTask[];
  progress: ExecutionProgress;
  summary: {
    successRate: number;
    averageIterations: number;
    totalIterations: number;
    convergedLoops: number;
    divergedLoops: number;
    escalatedLoops: number;
  };
}

/**
 * ParallelExecutionManager configuration
 */
export interface ParallelExecutionManagerConfig {
  maxConcurrency: number; // Max parallel executions
  worktreeConfig: {
    basePath: string;
    repoRoot: string;
  };
  feedbackLoopConfig: {
    maxIterations: number;
    convergenceThreshold: number;
    autoRefinementEnabled: boolean;
  };
  metricsConfig: {
    workingDirectory: string;
    skipTests?: boolean;
    skipCoverage?: boolean;
  };
  timeout?: number; // Task timeout in milliseconds
  enableLogging?: boolean;
}

/**
 * ParallelExecutionManager - Orchestrates parallel issue execution
 */
export class ParallelExecutionManager {
  private config: ParallelExecutionManagerConfig;
  private worktreeManager: WorktreeManager;
  private goalManager: GoalManager;
  private validator: ConsumptionValidator;
  private metricsCollector: MetricsCollector;

  private activeTasks: Map<number, ExecutionTask>;
  private completedTasks: ExecutionTask[];
  private sessionId: string;

  constructor(config: ParallelExecutionManagerConfig) {
    this.config = {
      timeout: 3600000, // 1 hour default
      enableLogging: true,
      ...config,
    };

    this.sessionId = `parallel-${Date.now()}`;

    // Initialize WorktreeManager
    this.worktreeManager = new WorktreeManager({
      basePath: this.config.worktreeConfig.basePath,
      repoRoot: this.config.worktreeConfig.repoRoot,
      enableLogging: this.config.enableLogging,
    });

    // Initialize GoalManager
    this.goalManager = new GoalManager({
      goalsDirectory: './goals',
      autoSave: true,
    });

    // Initialize ConsumptionValidator
    this.validator = new ConsumptionValidator({
      reportsDirectory: './reports',
      autoSave: true,
      strictMode: false,
    });

    // Initialize MetricsCollector
    this.metricsCollector = new MetricsCollector({
      workingDirectory: this.config.metricsConfig.workingDirectory,
      skipTests: this.config.metricsConfig.skipTests,
      skipCoverage: this.config.metricsConfig.skipCoverage,
      verbose: false,
    });

    this.activeTasks = new Map();
    this.completedTasks = [];

    this.log('✅ ParallelExecutionManager initialized');
  }

  /**
   * Execute multiple issues in parallel
   */
  async executeIssues(issues: Issue[]): Promise<ExecutionReport> {
    this.log(`🚀 Starting parallel execution for ${issues.length} issues`);

    const startTime = new Date().toISOString();

    // Create execution tasks
    const tasks: ExecutionTask[] = [];

    for (const issue of issues) {
      try {
        // Create worktree
        const worktree = await this.worktreeManager.createWorktree(issue);

        // Create goal
        const goal = this.goalManager.createGoal({
          title: issue.title,
          description: issue.body,
          successCriteria: {
            minQualityScore: 80,
            maxEslintErrors: 0,
            maxTypeScriptErrors: 0,
            maxSecurityIssues: 0,
            minTestCoverage: 80,
            minTestsPassed: 10,
          },
          testSpecs: [],
          acceptanceCriteria: ['Issue requirements met', 'Quality score >= 80'],
          priority: 1,
        });

        // Create orchestrator for this task
        const orchestrator = new InfiniteLoopOrchestrator(
          {
            maxIterations: this.config.feedbackLoopConfig.maxIterations,
            convergenceThreshold: this.config.feedbackLoopConfig.convergenceThreshold,
            minIterationsBeforeConvergence: 3,
            autoRefinementEnabled: this.config.feedbackLoopConfig.autoRefinementEnabled,
            logsDirectory: './loops',
            autoSave: true,
            timeout: this.config.timeout,
            enableEscalation: false, // Disable for parallel execution
          },
          this.goalManager,
          this.validator
        );

        // Start feedback loop
        const loop = await orchestrator.startLoop(goal.id);

        const task: ExecutionTask = {
          issue,
          worktree,
          goal,
          loop,
          status: 'pending',
        };

        tasks.push(task);
        this.activeTasks.set(issue.number, task);
      } catch (error: any) {
        this.log(`❌ Failed to create task for issue #${issue.number}: ${error.message}`);
      }
    }

    // Execute tasks with concurrency control
    await this.executeTasks(tasks);

    const endTime = new Date().toISOString();
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();

    // Generate report
    const report = this.generateReport(startTime, endTime, durationMs);

    this.log(`✅ Parallel execution completed in ${(durationMs / 1000).toFixed(2)}s`);

    return report;
  }

  /**
   * Execute tasks with concurrency control
   */
  private async executeTasks(tasks: ExecutionTask[]): Promise<void> {
    const queue = [...tasks];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
      // Start new tasks up to maxConcurrency
      while (running.length < this.config.maxConcurrency && queue.length > 0) {
        const task = queue.shift()!;
        const promise = this.executeTask(task);
        running.push(promise);
      }

      // Wait for at least one task to complete
      if (running.length > 0) {
        await Promise.race(running);

        // Remove completed promises
        for (let i = running.length - 1; i >= 0; i--) {
          const promise = running[i];
          const isSettled = await Promise.race([
            promise.then(() => true),
            Promise.resolve(false),
          ]);

          if (isSettled) {
            running.splice(i, 1);
          }
        }
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: ExecutionTask): Promise<void> {
    task.status = 'running';
    task.startTime = new Date().toISOString();

    this.log(`▶️  Executing issue #${task.issue.number}: ${task.issue.title}`);

    try {
      // Create orchestrator for this task
      const orchestrator = new InfiniteLoopOrchestrator(
        {
          maxIterations: this.config.feedbackLoopConfig.maxIterations,
          convergenceThreshold: this.config.feedbackLoopConfig.convergenceThreshold,
          minIterationsBeforeConvergence: 3,
          autoRefinementEnabled: this.config.feedbackLoopConfig.autoRefinementEnabled,
          logsDirectory: task.worktree.path + '/loops',
          autoSave: true,
          timeout: this.config.timeout,
          enableEscalation: false,
        },
        this.goalManager,
        this.validator
      );

      // Execute iterations
      let iteration = 0;
      const maxIterations = this.config.feedbackLoopConfig.maxIterations;

      while (iteration < maxIterations) {
        const loop = orchestrator.getLoop(task.loop.loopId);

        if (!loop || loop.status !== 'running') {
          break;
        }

        // Collect metrics from worktree
        const metrics = await this.metricsCollector.collect();

        // Execute iteration
        await orchestrator.executeIteration(
          task.loop.loopId,
          `${task.worktree.sessionId}-${iteration}`,
          metrics
        );

        iteration++;

        // Update progress
        this.logProgress();
      }

      task.status = 'completed';
      task.endTime = new Date().toISOString();

      this.log(`✅ Completed issue #${task.issue.number}`);

      // Update worktree status
      this.worktreeManager.updateWorktreeStatus(task.issue.number, 'completed');

      // Move to completed tasks
      this.activeTasks.delete(task.issue.number);
      this.completedTasks.push(task);
    } catch (error: any) {
      task.status = 'failed';
      task.endTime = new Date().toISOString();
      task.error = error.message;

      this.log(`❌ Failed issue #${task.issue.number}: ${error.message}`);

      // Update worktree status
      this.worktreeManager.updateWorktreeStatus(task.issue.number, 'failed');

      // Move to completed tasks
      this.activeTasks.delete(task.issue.number);
      this.completedTasks.push(task);
    }
  }

  /**
   * Get current execution progress
   */
  getProgress(): ExecutionProgress {
    const allTasks = [...this.activeTasks.values(), ...this.completedTasks];

    const total = allTasks.length;
    const pending = allTasks.filter((t) => t.status === 'pending').length;
    const running = allTasks.filter((t) => t.status === 'running').length;
    const completed = allTasks.filter((t) => t.status === 'completed').length;
    const failed = allTasks.filter((t) => t.status === 'failed').length;
    const timeout = allTasks.filter((t) => t.status === 'timeout').length;

    const percentage = total > 0 ? ((completed + failed) / total) * 100 : 0;

    return {
      total,
      pending,
      running,
      completed,
      failed,
      timeout,
      percentage,
    };
  }

  /**
   * Log progress
   */
  private logProgress(): void {
    const progress = this.getProgress();
    this.log(
      `📊 Progress: ${progress.completed}/${progress.total} completed (${progress.percentage.toFixed(1)}%), ${progress.running} running, ${progress.pending} pending`
    );
  }

  /**
   * Generate execution report
   */
  private generateReport(
    startTime: string,
    endTime: string,
    durationMs: number
  ): ExecutionReport {
    const allTasks = this.completedTasks;
    const progress = this.getProgress();

    const successRate =
      progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

    // Calculate average iterations
    let totalIterations = 0;
    let convergedLoops = 0;
    let divergedLoops = 0;
    let escalatedLoops = 0;

    for (const task of allTasks) {
      totalIterations += task.loop.iterations?.length || 0;

      if (task.loop.status === 'converged') convergedLoops++;
      if (task.loop.status === 'diverged') divergedLoops++;
      if (task.loop.status === 'escalated') escalatedLoops++;
    }

    const averageIterations =
      allTasks.length > 0 ? totalIterations / allTasks.length : 0;

    return {
      sessionId: this.sessionId,
      startTime,
      endTime,
      durationMs,
      tasks: allTasks,
      progress,
      summary: {
        successRate,
        averageIterations,
        totalIterations,
        convergedLoops,
        divergedLoops,
        escalatedLoops,
      },
    };
  }

  /**
   * Cleanup all worktrees
   */
  async cleanup(): Promise<void> {
    this.log('🧹 Cleaning up worktrees...');
    await this.worktreeManager.cleanupAll();
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ParallelExecutionManager] ${message}`);
    }
  }
}
