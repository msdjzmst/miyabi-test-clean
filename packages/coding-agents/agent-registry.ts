/**
 * AgentRegistry - Assigns agents to tasks with intelligent analysis
 *
 * Manages agent assignment and creation based on task requirements
 * Uses AI-based analysis to determine optimal agent configuration
 */

import { DynamicAgent } from './dynamic-agent';
import { AgentFactory } from './agent-factory';
import { AgentAnalyzer } from './agent-analyzer';
import { ToolFactory } from './tool-factory';
import { Task, AgentConfig } from './types/index';
import {
  AgentAssignmentCriteria,
  AgentAssignmentResult,
  AgentInstance,
} from './types/agent-template';
import { AgentAnalysisResult } from './types/agent-analysis';
import { HookManager } from './hooks/hook-manager';
import { TTLCache } from './utils/cache';
import { logger } from './ui/index';

export class AgentRegistry {
  private static instance: AgentRegistry;
  private factory: AgentFactory;
  private analyzer: AgentAnalyzer;
  private toolFactory: ToolFactory;
  private assignments: Map<string, DynamicAgent> = new Map(); // taskId -> agent
  private analysisCache: TTLCache<AgentAnalysisResult>; // taskId -> analysis with TTL
  private config: AgentConfig;
  private defaultHookManager?: HookManager;

  private constructor(config: AgentConfig) {
    this.factory = AgentFactory.getInstance();
    this.analyzer = AgentAnalyzer.getInstance();
    this.toolFactory = ToolFactory.getInstance();
    this.config = config;

    // Initialize TTL cache with 15 minute TTL and max 100 entries
    this.analysisCache = new TTLCache<AgentAnalysisResult>({
      maxSize: 100,
      ttlMs: 15 * 60 * 1000, // 15 minutes
      autoCleanup: true,
      onEvict: (taskId, _analysis) => {
        logger.info(`Analysis cache evicted for task ${taskId}`);
      },
    });
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(config?: AgentConfig): AgentRegistry {
    if (!AgentRegistry.instance) {
      if (!config) {
        throw new Error('Config required for first initialization');
      }
      AgentRegistry.instance = new AgentRegistry(config);
    }
    return AgentRegistry.instance;
  }

  /**
   * Set default hook manager (applied to all new agents)
   */
  setDefaultHookManager(hookManager: HookManager): void {
    this.defaultHookManager = hookManager;
  }

  /**
   * Assign agent to task with intelligent analysis
   *
   * 1. Analyze task requirements from higher-level concepts
   * 2. Create dynamic tools/hooks if needed
   * 3. Try to find existing idle agent that can handle the task
   * 4. If not found, create new agent with optimal configuration
   * 5. Return assignment result
   */
  async assignAgent(criteria: AgentAssignmentCriteria): Promise<AgentAssignmentResult> {
    const { task, agentType, preferExisting, maxConcurrentTasks } = criteria;

    logger.info(`🔍 Intelligent agent assignment for task ${task.id} (${task.title})`);

    try {
      // Step 1: Analyze task from higher-level concepts
      logger.info('Step 1: Analyzing task requirements...');
      const availableTemplates = this.factory.getAllTemplates();
      const analysis = await this.analyzer.analyzeTask(task, availableTemplates);

      // Cache analysis
      this.analysisCache.set(task.id, analysis);

      logger.info(
        `  Complexity: ${analysis.complexity.category} (${analysis.complexity.complexityScore}/100)`
      );
      logger.info(`  Required capabilities: ${analysis.requirements.capabilities.join(', ')}`);
      logger.info(`  Strategy: ${analysis.assignmentStrategy.type}`);

      // Step 2: Create dynamic tools/hooks if needed
      logger.info('Step 2: Creating dynamic tools and hooks...');
      const createdTools: string[] = [];
      const createdHooks: string[] = [];

      // Create required tools
      for (const toolReq of analysis.requirements.tools) {
        if (toolReq.critical || toolReq.priority > 50) {
          const result = await this.toolFactory.createTool(toolReq);
          if (result.success && result.tool) {
            createdTools.push(result.tool.name);
            logger.success(`  ✓ Created tool: ${result.tool.name}`);
          }
        }
      }

      // Create required hooks
      const hookManager = this.defaultHookManager || new HookManager();
      for (const hookReq of analysis.requirements.hooks) {
        const hook = await this.toolFactory.createHook(hookReq);
        createdHooks.push(hook.name);

        // Register hook based on type
        if (hookReq.type === 'pre') {
          hookManager.registerPreHook(hook as import('./types/hooks.js').PreHook);
        } else if (hookReq.type === 'post') {
          hookManager.registerPostHook(hook as import('./types/hooks.js').PostHook);
        } else {
          hookManager.registerErrorHook(hook as import('./types/hooks.js').ErrorHook);
        }

        logger.success(`  ✓ Created hook: ${hook.name} (${hookReq.type})`);
      }

      // Step 3: Determine assignment strategy
      logger.info('Step 3: Determining assignment strategy...');

      if (
        analysis.assignmentStrategy.type === 'reuse-existing' &&
        preferExisting !== false
      ) {
        // Try to find existing idle agent
        const existingAgent = this.findIdleAgent(task, agentType);

        if (existingAgent && existingAgent.canHandleTask(task)) {
          // Check concurrent task limit
          const runningTasks = this.getAgentRunningTaskCount(existingAgent);

          if (!maxConcurrentTasks || runningTasks < maxConcurrentTasks) {
            // Update hook manager if we created new hooks
            if (createdHooks.length > 0) {
              (existingAgent as any).hookManager = hookManager;
            }

            this.assignments.set(task.id, existingAgent);

            logger.success(`✓ Assigned existing agent: ${existingAgent.getInstanceId()}`);
            logger.info(
              `  Created ${createdTools.length} tools, ${createdHooks.length} hooks`
            );

            return {
              success: true,
              agentInstance: existingAgent.getInstanceInfo(),
              wasCreated: false,
              reason: `Found idle agent (${analysis.assignmentStrategy.reason})`,
            };
          } else {
            logger.info(
              `Agent ${existingAgent.getInstanceId()} has reached max concurrent tasks (${maxConcurrentTasks})`
            );
          }
        }
      }

      // Step 4: Create new agent with optimal configuration
      logger.info('Step 4: Creating new agent with optimal configuration...');

      // Select best template
      let templateId: string;
      if (analysis.capabilityAnalysis.recommendation === 'use-existing') {
        templateId = analysis.capabilityAnalysis.matchingTemplates[0].template.id;
        logger.info(
          `  Using existing template: ${analysis.capabilityAnalysis.matchingTemplates[0].template.name}`
        );
      } else if (analysis.capabilityAnalysis.recommendation === 'extend-existing') {
        templateId = analysis.capabilityAnalysis.matchingTemplates[0].template.id;
        logger.info(
          `  Extending template: ${analysis.capabilityAnalysis.matchingTemplates[0].template.name}`
        );
        logger.info(
          `  Adding capabilities: ${analysis.capabilityAnalysis.requiredNewCapabilities.join(', ')}`
        );
      } else {
        // Create-new: use best available template for task type
        const template = this.factory.findBestTemplate(task.type);
        if (!template) {
          throw new Error(`No template found for task type: ${task.type}`);
        }
        templateId = template.id;
        logger.info(`  Creating with template: ${template.name}`);
      }

      const newAgent = await this.factory.createAgent(templateId, this.config, {
        hookManager,
        autoInitialize: true,
      });

      // Assign to task
      this.assignments.set(task.id, newAgent);

      logger.success(`✓ Created and assigned new agent: ${newAgent.getInstanceId()}`);
      logger.info(`  Tools: ${createdTools.join(', ') || 'none'}`);
      logger.info(`  Hooks: ${createdHooks.join(', ') || 'none'}`);
      logger.info(`  Strategy: ${analysis.requirements.strategy}`);

      return {
        success: true,
        agentInstance: newAgent.getInstanceInfo(),
        wasCreated: true,
        reason: `Created new agent (${analysis.assignmentStrategy.reason})`,
      };
    } catch (error) {
      logger.error(`Failed to assign agent: ${(error as Error).message}`);

      return {
        success: false,
        wasCreated: false,
        reason: 'Assignment failed',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Find idle agent matching criteria
   */
  private findIdleAgent(task: Task, agentType?: string): DynamicAgent | undefined {
    const idleAgents = this.factory.getIdleInstances();

    // Filter by agent type if specified
    const candidates = agentType
      ? idleAgents.filter((agent) => agent.getAgentType() === agentType)
      : idleAgents;

    // Filter by task type support
    const compatibleAgents = candidates.filter((agent) => agent.canHandleTask(task));

    if (compatibleAgents.length === 0) {
      return undefined;
    }

    // Return first compatible agent
    // TODO: Implement more sophisticated selection (e.g., based on success rate, load)
    return compatibleAgents[0];
  }

  /**
   * Get number of running tasks for agent
   */
  private getAgentRunningTaskCount(agent: DynamicAgent): number {
    if (agent.getStatus() === 'running') {
      return 1;
    }
    return 0;
  }

  /**
   * Get agent assigned to task
   */
  getAgentForTask(taskId: string): DynamicAgent | undefined {
    return this.assignments.get(taskId);
  }

  /**
   * Unassign agent from task
   */
  unassignAgent(taskId: string): boolean {
    const deleted = this.assignments.delete(taskId);

    if (deleted) {
      logger.info(`Unassigned agent from task ${taskId}`);
    }

    return deleted;
  }

  /**
   * Get all current assignments
   */
  getAllAssignments(): Map<string, AgentInstance> {
    const assignments = new Map<string, AgentInstance>();

    for (const [taskId, agent] of this.assignments.entries()) {
      assignments.set(taskId, agent.getInstanceInfo());
    }

    return assignments;
  }

  /**
   * Get task analysis result
   */
  getTaskAnalysis(taskId: string): AgentAnalysisResult | undefined {
    return this.analysisCache.get(taskId);
  }

  /**
   * Get assignment statistics
   */
  getStatistics(): {
    totalAssignments: number;
    activeAgents: number;
    idleAgents: number;
    totalAgents: number;
    cachedAnalyses: number;
    toolsCreated: number;
    cacheHitRate: number;
    cacheHits: number;
    cacheMisses: number;
  } {
    const factoryStats = this.factory.getStatistics();
    const cacheStats = this.analysisCache.getStats();

    return {
      totalAssignments: this.assignments.size,
      activeAgents: factoryStats.runningInstances,
      idleAgents: factoryStats.idleInstances,
      totalAgents: factoryStats.totalInstances,
      cachedAnalyses: cacheStats.size,
      toolsCreated: this.toolFactory.getAllTools().length,
      cacheHitRate: cacheStats.hitRate,
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
    };
  }

  /**
   * Cleanup completed assignments
   */
  cleanupCompletedAssignments(): number {
    let count = 0;

    for (const [taskId, agent] of this.assignments.entries()) {
      if (agent.getStatus() === 'completed' || agent.getStatus() === 'failed') {
        this.assignments.delete(taskId);
        count++;
      }
    }

    if (count > 0) {
      logger.info(`Cleaned up ${count} completed assignments`);
    }

    return count;
  }

  /**
   * Destroy idle agents (cleanup)
   */
  async destroyIdleAgents(): Promise<number> {
    return this.factory.destroyIdleAgents();
  }

  /**
   * Export registry state
   */
  exportState(): {
    assignments: Array<{
      taskId: string;
      agentInstance: AgentInstance;
    }>;
    factoryState: ReturnType<AgentFactory['exportState']>;
  } {
    const assignments: Array<{ taskId: string; agentInstance: AgentInstance }> = [];

    for (const [taskId, agent] of this.assignments.entries()) {
      assignments.push({
        taskId,
        agentInstance: agent.getInstanceInfo(),
      });
    }

    return {
      assignments,
      factoryState: this.factory.exportState(),
    };
  }

  /**
   * Clear all assignments and agents
   */
  async clear(): Promise<void> {
    this.assignments.clear();
    await this.factory.clear();
    this.analysisCache.dispose(); // Dispose cache and stop cleanup timer
    logger.info('Registry cleared');

    // Recreate cache for continued use
    this.analysisCache = new TTLCache<AgentAnalysisResult>({
      maxSize: 100,
      ttlMs: 15 * 60 * 1000,
      autoCleanup: true,
      onEvict: (taskId, _analysis) => {
        logger.info(`Analysis cache evicted for task ${taskId}`);
      },
    });
  }
}
