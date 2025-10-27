/**
 * Custom Hook Example
 *
 * Demonstrates creating a custom hook for specific use cases
 */

import { PreHook, PostHook, HookContext } from '../../types/hooks';
import { AgentResult } from '../../types/index';
import { logger } from '../../ui/index';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GitWorkingTreeCheckHook - Ensures git working tree is clean
 */
export class GitWorkingTreeCheckHook implements PreHook {
  name = 'git-working-tree-check';
  description = 'Ensures git working tree is clean before execution';
  priority = 15;

  async execute(_context: HookContext): Promise<void> {
    logger.info('Checking git working tree status...');

    const { spawn } = await import('child_process');

    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('git', ['status', '--porcelain'], {
        cwd: process.cwd(),
      });

      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Git command failed with code ${code}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });

    if (result.trim() !== '') {
      const files = result.trim().split('\n');
      throw new Error(
        `Git working tree is not clean. ${files.length} uncommitted changes:\n${files.slice(0, 5).join('\n')}${files.length > 5 ? '\n...' : ''}`
      );
    }

    logger.success('✓ Git working tree is clean');
  }
}

/**
 * PerformanceTrackingHook - Tracks and logs performance metrics
 */
export class PerformanceTrackingHook implements PreHook, PostHook {
  name = 'performance-tracking';
  description = 'Tracks execution performance and resource usage';
  priority = 5; // Run early for prehook, early for posthook

  private startMemory: number = 0;
  private startCpu: NodeJS.CpuUsage = { user: 0, system: 0 };

  async execute(_context: HookContext): Promise<void> {
    // PreHook: Record start metrics
    this.startMemory = process.memoryUsage().heapUsed;
    this.startCpu = process.cpuUsage();

    logger.info('Performance tracking started');
  }

  async executePost(context: HookContext, _result: AgentResult): Promise<void> {
    // PostHook: Calculate metrics
    const endMemory = process.memoryUsage().heapUsed;
    const endCpu = process.cpuUsage(this.startCpu);

    const memoryDelta = endMemory - this.startMemory;
    const cpuTime = (endCpu.user + endCpu.system) / 1000; // microseconds to milliseconds

    const metrics = {
      taskId: context.task.id,
      agentType: context.agentType,
      durationMs: Date.now() - context.startTime,
      memoryUsedMB: (memoryDelta / 1024 / 1024).toFixed(2),
      cpuTimeMs: cpuTime.toFixed(2),
      timestamp: new Date().toISOString(),
    };

    // Log metrics
    logger.info(`Performance metrics: ${JSON.stringify(metrics, null, 2)}`);

    // Save to file
    const perfDir = path.join(context.config.reportDirectory, 'performance');
    await fs.promises.mkdir(perfDir, { recursive: true });

    const perfFile = path.join(
      perfDir,
      `${context.agentType}-${context.task.id}.json`
    );

    await fs.promises.writeFile(perfFile, JSON.stringify(metrics, null, 2));

    logger.success('✓ Performance metrics recorded');
  }
}

/**
 * TaskValidationHook - Validates task structure and requirements
 */
export class TaskValidationHook implements PreHook {
  name = 'task-validation';
  description = 'Validates task structure and required fields';
  priority = 10;

  private requiredFields: string[];

  constructor(requiredFields: string[] = ['id', 'title', 'type', 'priority']) {
    this.requiredFields = requiredFields;
  }

  async execute(context: HookContext): Promise<void> {
    logger.info('Validating task structure...');

    const missing: string[] = [];

    for (const field of this.requiredFields) {
      if (!(field in context.task) || !context.task[field as keyof typeof context.task]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Task validation failed. Missing required fields: ${missing.join(', ')}`
      );
    }

    // Validate task type
    const validTypes = ['feature', 'bug', 'refactor', 'docs', 'test', 'deployment'];
    if (!validTypes.includes(context.task.type)) {
      throw new Error(
        `Invalid task type: ${context.task.type}. Must be one of: ${validTypes.join(', ')}`
      );
    }

    // Validate priority
    const validPriorities = [0, 1, 2, 3];
    if (!validPriorities.includes(context.task.priority)) {
      throw new Error(
        `Invalid priority: ${context.task.priority}. Must be one of: ${validPriorities.join(', ')}`
      );
    }

    logger.success('✓ Task validation passed');
  }
}

/**
 * ArtifactArchiveHook - Archives generated artifacts after execution
 */
export class ArtifactArchiveHook implements PostHook {
  name = 'artifact-archive';
  description = 'Archives generated artifacts to a central location';
  priority = 80;

  private archiveDir: string;

  constructor(archiveDir: string = '.ai/archives') {
    this.archiveDir = archiveDir;
  }

  async execute(context: HookContext, result: AgentResult): Promise<void> {
    logger.info('Archiving artifacts...');

    const taskArchiveDir = path.join(
      this.archiveDir,
      context.agentType,
      context.task.id
    );

    await fs.promises.mkdir(taskArchiveDir, { recursive: true });

    // Archive result
    const resultFile = path.join(taskArchiveDir, 'result.json');
    await fs.promises.writeFile(resultFile, JSON.stringify(result, null, 2));

    // Archive any generated files
    if (result.data?.files) {
      const filesArchive = path.join(taskArchiveDir, 'files.json');
      await fs.promises.writeFile(
        filesArchive,
        JSON.stringify(result.data.files, null, 2)
      );
    }

    // Create metadata
    const metadata = {
      taskId: context.task.id,
      agentType: context.agentType,
      timestamp: new Date().toISOString(),
      status: result.status,
    };

    const metadataFile = path.join(taskArchiveDir, 'metadata.json');
    await fs.promises.writeFile(metadataFile, JSON.stringify(metadata, null, 2));

    logger.success(`✓ Artifacts archived to ${taskArchiveDir}`);
  }
}

// Usage Example
import { HookManager } from '../hook-manager';

const hookManager = new HookManager();

// Register custom prehooks
hookManager.registerPreHook(new GitWorkingTreeCheckHook());
hookManager.registerPreHook(new TaskValidationHook());
hookManager.registerPreHook(new PerformanceTrackingHook());

// Register custom posthooks
hookManager.registerPostHook(new PerformanceTrackingHook());
hookManager.registerPostHook(new ArtifactArchiveHook('.ai/archives'));
