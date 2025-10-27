/**
 * agents/ui/progress.ts
 *
 * Progress indicators for long-running operations
 * Provides progress bars, spinners, and multi-step tracking
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { theme } from './theme';

export interface ProgressBarOptions {
  total: number;
  current: number;
  width?: number;
  showPercentage?: boolean;
  showCount?: boolean;
  label?: string;
  color?: string;
}

/**
 * Create a progress bar
 */
export function createProgressBar(options: ProgressBarOptions): string {
  const {
    total,
    current,
    width = 30,
    showPercentage = true,
    showCount = true,
    label,
    color = theme.colors.primary,
  } = options;

  const percentage = total > 0 ? (current / total) * 100 : 0;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;

  const bar =
    chalk.hex(color)(theme.progressBar.complete.repeat(filled)) +
    chalk.gray(theme.progressBar.incomplete.repeat(empty));

  const parts: string[] = [];

  if (label) {
    parts.push(chalk.bold(label));
  }

  parts.push(bar);

  if (showPercentage) {
    parts.push(chalk.cyan(`${Math.round(percentage)}%`));
  }

  if (showCount) {
    parts.push(chalk.gray(`(${current}/${total})`));
  }

  return parts.join(' ');
}

/**
 * Multi-step progress tracker
 */
export interface Step {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  duration?: number;
}

export class MultiStepProgress {
  private steps: Step[];

  constructor(steps: Omit<Step, 'status'>[]) {
    this.steps = steps.map(step => ({ ...step, status: 'pending' as const }));
  }

  /**
   * Start a specific step
   */
  startStep(stepId: string): void {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'running';
  }

  /**
   * Complete current step with success
   */
  completeStep(stepId: string, duration?: number): void {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'success';
    if (duration !== undefined) {
      step.duration = duration;
    }
  }

  /**
   * Fail current step
   */
  failStep(stepId: string): void {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'error';
  }

  /**
   * Skip a step
   */
  skipStep(stepId: string): void {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'skipped';
  }

  /**
   * Render the progress
   */
  render(): string {
    const lines: string[] = [];

    this.steps.forEach((step, index) => {
      const icon = this.getStepIcon(step.status);
      const connector = index < this.steps.length - 1 ? '│' : '';

      const label =
        step.status === 'running'
          ? chalk.bold(step.label)
          : step.status === 'success'
          ? chalk.hex(theme.colors.success)(step.label)
          : step.status === 'error'
          ? chalk.hex(theme.colors.error)(step.label)
          : step.status === 'skipped'
          ? chalk.gray(step.label)
          : chalk.gray(step.label);

      let line = `${icon} ${label}`;

      if (step.duration !== undefined) {
        line += ` ${chalk.gray(`(${formatDuration(step.duration)})`)}`;
      }

      lines.push(line);

      if (connector) {
        lines.push(chalk.gray(connector));
      }
    });

    return lines.join('\n');
  }

  /**
   * Get step icon based on status
   */
  private getStepIcon(status: Step['status']): string {
    switch (status) {
      case 'pending':
        return chalk.gray('○');
      case 'running':
        return chalk.hex(theme.colors.info)('◉');
      case 'success':
        return chalk.hex(theme.colors.success)('✓');
      case 'error':
        return chalk.hex(theme.colors.error)('✗');
      case 'skipped':
        return chalk.gray('⊝');
    }
  }

  /**
   * Get overall summary
   */
  getSummary(): {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    pending: number;
  } {
    return {
      total: this.steps.length,
      completed: this.steps.filter(s => s.status === 'success').length,
      failed: this.steps.filter(s => s.status === 'error').length,
      skipped: this.steps.filter(s => s.status === 'skipped').length,
      pending: this.steps.filter(s => s.status === 'pending').length,
    };
  }
}

/**
 * Spinner manager
 */
export class SpinnerManager {
  private spinner: Ora | null = null;
  private stack: string[] = [];

  /**
   * Start a spinner with text
   */
  start(text: string, spinnerType: string = 'dots'): Ora {
    if (this.spinner) {
      this.stack.push(this.spinner.text);
    }

    this.spinner = ora({
      text: chalk.hex(theme.colors.info)(text),
      spinner: spinnerType as any,
      color: 'cyan',
    }).start();

    return this.spinner;
  }

  /**
   * Update spinner text
   */
  update(text: string): void {
    if (this.spinner) {
      this.spinner.text = chalk.hex(theme.colors.info)(text);
    }
  }

  /**
   * Complete spinner with success
   */
  succeed(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(
        text ? chalk.hex(theme.colors.success)(text) : undefined
      );
      this.spinner = null;
    }

    this.popStack();
  }

  /**
   * Complete spinner with failure
   */
  fail(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(
        text ? chalk.hex(theme.colors.error)(text) : undefined
      );
      this.spinner = null;
    }

    this.popStack();
  }

  /**
   * Complete spinner with warning
   */
  warn(text?: string): void {
    if (this.spinner) {
      this.spinner.warn(
        text ? chalk.hex(theme.colors.warning)(text) : undefined
      );
      this.spinner = null;
    }

    this.popStack();
  }

  /**
   * Complete spinner with info
   */
  info(text?: string): void {
    if (this.spinner) {
      this.spinner.info(
        text ? chalk.hex(theme.colors.info)(text) : undefined
      );
      this.spinner = null;
    }

    this.popStack();
  }

  /**
   * Stop spinner without status
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    this.popStack();
  }

  /**
   * Pop previous spinner from stack
   */
  private popStack(): void {
    if (this.stack.length > 0) {
      const text = this.stack.pop()!;
      this.spinner = ora({
        text: chalk.hex(theme.colors.info)(text),
        spinner: 'dots',
        color: 'cyan',
      }).start();
    }
  }
}

/**
 * Task progress tracker for parallel execution
 */
export interface TaskProgress {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  progress?: number; // 0-100
  startTime?: number;
  endTime?: number;
}

export class ParallelTaskProgress {
  private tasks: Map<string, TaskProgress> = new Map();

  /**
   * Add a task
   */
  addTask(task: Omit<TaskProgress, 'status'>): void {
    this.tasks.set(task.id, { ...task, status: 'pending' });
  }

  /**
   * Start a task
   */
  startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    task.startTime = Date.now();
  }

  /**
   * Update task progress
   */
  updateProgress(taskId: string, progress: number): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = Math.min(100, Math.max(0, progress));
  }

  /**
   * Complete task with success
   */
  completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'success';
    task.progress = 100;
    task.endTime = Date.now();
  }

  /**
   * Fail task
   */
  failTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'error';
    task.endTime = Date.now();
  }

  /**
   * Render all tasks
   */
  render(): string {
    const lines: string[] = [];

    this.tasks.forEach(task => {
      const icon = this.getTaskIcon(task.status);
      const nameColor =
        task.status === 'success' ? theme.colors.success :
        task.status === 'error' ? theme.colors.error :
        task.status === 'running' ? theme.colors.info :
        theme.colors.muted;

      let line = `${icon} ${chalk.hex(nameColor)(task.name)}`;

      // Progress bar for running tasks
      if (task.status === 'running' && task.progress !== undefined) {
        const bar = createProgressBar({
          total: 100,
          current: task.progress,
          width: 20,
          showPercentage: true,
          showCount: false,
        });
        line += ` ${bar}`;
      }

      // Duration for completed tasks
      if (task.endTime && task.startTime) {
        const duration = task.endTime - task.startTime;
        line += ` ${chalk.gray(`(${formatDuration(duration)})`)}`;
      }

      lines.push(line);
    });

    return lines.join('\n');
  }

  /**
   * Get task icon
   */
  private getTaskIcon(status: TaskProgress['status']): string {
    switch (status) {
      case 'pending':
        return chalk.gray('○');
      case 'running':
        return chalk.hex(theme.colors.info)('◉');
      case 'success':
        return chalk.hex(theme.colors.success)('✓');
      case 'error':
        return chalk.hex(theme.colors.error)('✗');
    }
  }

  /**
   * Get summary
   */
  getSummary(): {
    total: number;
    pending: number;
    running: number;
    success: number;
    error: number;
  } {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      success: tasks.filter(t => t.status === 'success').length,
      error: tasks.filter(t => t.status === 'error').length,
    };
  }
}

/**
 * Helper: Format duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
