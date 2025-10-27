/**
 * AgentAnalyzer - Intelligent task analysis and agent requirement determination
 *
 * Analyzes tasks from higher-level concepts to determine:
 * - Required agent capabilities
 * - Necessary tools and templates
 * - Optimal assignment strategy
 */

import { Task } from './types/index';
import { AgentTemplate } from './types/agent-template';
import {
  AgentAnalysisResult,
  TaskComplexityAnalysis,
  AgentRequirements,
  AgentCapabilityAnalysis,
  AssignmentStrategy,
  ToolRequirement,
  HookRequirement,
  TemplateRequirement,
} from './types/agent-analysis';
import { logger } from './ui/index';

export class AgentAnalyzer {
  private static instance: AgentAnalyzer;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AgentAnalyzer {
    if (!AgentAnalyzer.instance) {
      AgentAnalyzer.instance = new AgentAnalyzer();
    }
    return AgentAnalyzer.instance;
  }

  /**
   * Analyze task and determine agent requirements
   */
  async analyzeTask(
    task: Task,
    availableTemplates: AgentTemplate[]
  ): Promise<AgentAnalysisResult> {
    logger.info(`Analyzing task ${task.id} (${task.title})`);

    // Step 1: Analyze task complexity
    const complexity = await this.analyzeComplexity(task);

    // Step 2: Determine agent requirements
    const requirements = await this.determineRequirements(task, complexity);

    // Step 3: Analyze capability gaps
    const capabilityAnalysis = await this.analyzeCapabilities(
      requirements,
      availableTemplates
    );

    // Step 4: Determine assignment strategy
    const assignmentStrategy = this.determineAssignmentStrategy(
      complexity,
      capabilityAnalysis
    );

    const result: AgentAnalysisResult = {
      complexity,
      requirements,
      capabilityAnalysis,
      assignmentStrategy,
      timestamp: new Date().toISOString(),
    };

    logger.success(
      `✓ Analysis complete: ${assignmentStrategy.type} (confidence: ${assignmentStrategy.confidence}%)`
    );

    return result;
  }

  /**
   * Analyze task complexity from higher-level concepts
   */
  private async analyzeComplexity(task: Task): Promise<TaskComplexityAnalysis> {
    const title = task.title.toLowerCase();
    const description = task.description.toLowerCase();
    const content = `${title} ${description}`;

    // Analyze complexity based on keywords and patterns
    let complexityScore = 0;
    const requiredCapabilities: string[] = [];
    const recommendedTools: string[] = [];
    const riskFactors: string[] = [];
    const systemDependencies: string[] = [];

    // Keyword-based analysis
    const complexityKeywords = {
      simple: [
        'fix typo',
        'update docs',
        'add comment',
        'rename',
        'format',
        'simple',
      ],
      moderate: [
        'implement',
        'add feature',
        'update',
        'refactor',
        'improve',
        'enhance',
      ],
      complex: [
        'architecture',
        'integration',
        'migrate',
        'redesign',
        'optimize',
        'scale',
      ],
      expert: [
        'distributed',
        'real-time',
        'machine learning',
        'ai',
        'blockchain',
        'security',
      ],
    };

    // Calculate base complexity
    let category: 'simple' | 'moderate' | 'complex' | 'expert' = 'moderate';

    if (complexityKeywords.expert.some((kw) => content.includes(kw))) {
      complexityScore = 80 + Math.random() * 20;
      category = 'expert';
    } else if (complexityKeywords.complex.some((kw) => content.includes(kw))) {
      complexityScore = 60 + Math.random() * 20;
      category = 'complex';
    } else if (complexityKeywords.moderate.some((kw) => content.includes(kw))) {
      complexityScore = 40 + Math.random() * 20;
      category = 'moderate';
    } else if (complexityKeywords.simple.some((kw) => content.includes(kw))) {
      complexityScore = 10 + Math.random() * 20;
      category = 'simple';
    }

    // Analyze required capabilities
    const capabilityPatterns = {
      typescript: ['typescript', 'ts', 'type'],
      api: ['api', 'endpoint', 'rest', 'graphql'],
      database: ['database', 'db', 'sql', 'mongodb', 'postgres'],
      frontend: ['ui', 'component', 'react', 'vue', 'frontend'],
      backend: ['backend', 'server', 'service'],
      testing: ['test', 'spec', 'e2e', 'unit test'],
      deployment: ['deploy', 'ci/cd', 'docker', 'kubernetes'],
      security: ['security', 'auth', 'authentication', 'authorization'],
      performance: ['performance', 'optimize', 'cache', 'speed'],
      documentation: ['docs', 'documentation', 'readme'],
    };

    for (const [capability, keywords] of Object.entries(capabilityPatterns)) {
      if (keywords.some((kw) => content.includes(kw))) {
        requiredCapabilities.push(capability);
      }
    }

    // Recommend tools based on capabilities
    const toolRecommendations: Record<string, string[]> = {
      typescript: ['tsc', 'eslint', 'prettier'],
      api: ['axios', 'fetch', 'postman'],
      database: ['prisma', 'typeorm', 'mongoose'],
      frontend: ['vite', 'webpack', 'babel'],
      testing: ['vitest', 'jest', 'playwright'],
      deployment: ['docker', 'github-actions', 'terraform'],
      security: ['snyk', 'npm-audit', 'owasp'],
    };

    for (const capability of requiredCapabilities) {
      if (toolRecommendations[capability]) {
        recommendedTools.push(...toolRecommendations[capability]);
      }
    }

    // Identify risk factors
    if (content.includes('breaking change')) {
      riskFactors.push('Breaking changes - requires careful migration');
    }
    if (content.includes('database migration')) {
      riskFactors.push('Database migration - data loss risk');
    }
    if (content.includes('security')) {
      riskFactors.push('Security-sensitive - requires expert review');
    }
    if (content.includes('production')) {
      riskFactors.push('Production impact - requires staging test');
    }

    // Identify system dependencies
    const dependencyPatterns = {
      'github-api': ['github', 'octokit'],
      'anthropic-api': ['claude', 'anthropic', 'ai'],
      firebase: ['firebase', 'firestore'],
      vercel: ['vercel', 'deployment'],
      aws: ['aws', 's3', 'lambda'],
    };

    for (const [system, keywords] of Object.entries(dependencyPatterns)) {
      if (keywords.some((kw) => content.includes(kw))) {
        systemDependencies.push(system);
      }
    }

    // Estimate effort (simple heuristic)
    const estimatedEffort = Math.max(
      1,
      Math.round(complexityScore / 20) * requiredCapabilities.length
    );

    return {
      complexityScore: Math.round(complexityScore),
      category,
      requiredCapabilities: Array.from(new Set(requiredCapabilities)),
      recommendedTools: Array.from(new Set(recommendedTools)),
      estimatedEffort,
      riskFactors,
      systemDependencies,
    };
  }

  /**
   * Determine agent requirements based on task and complexity
   */
  private async determineRequirements(
    task: Task,
    complexity: TaskComplexityAnalysis
  ): Promise<AgentRequirements> {
    const tools: ToolRequirement[] = [];
    const hooks: HookRequirement[] = [];
    const templates: TemplateRequirement[] = [];

    // Determine execution strategy
    const strategy: 'sequential' | 'parallel' | 'conditional' =
      complexity.complexityScore > 70 ? 'conditional' : 'sequential';

    // Add required tools
    for (const toolName of complexity.recommendedTools) {
      tools.push({
        name: toolName,
        type: this.inferToolType(toolName),
        description: `Tool for ${toolName}`,
        parameters: {},
        priority: 10,
        critical: false,
      });
    }

    // Add required hooks
    if (complexity.riskFactors.length > 0) {
      hooks.push({
        name: 'risk-validation',
        type: 'pre',
        description: 'Validate risk factors before execution',
        priority: 100,
        config: { riskFactors: complexity.riskFactors },
      });
    }

    if (complexity.systemDependencies.length > 0) {
      hooks.push({
        name: 'dependency-check',
        type: 'pre',
        description: 'Check system dependencies',
        priority: 90,
        config: { dependencies: complexity.systemDependencies },
      });
    }

    // Always add completion notification hook
    hooks.push({
      name: 'completion-notification',
      type: 'post',
      description: 'Notify on task completion',
      priority: 10,
      config: {},
    });

    // Add required templates
    if (complexity.requiredCapabilities.includes('typescript')) {
      templates.push({
        name: 'typescript-codegen',
        type: 'code-generation',
        description: 'TypeScript code generation template',
        config: { strict: true, esm: true },
      });
    }

    if (complexity.requiredCapabilities.includes('testing')) {
      templates.push({
        name: 'test-generation',
        type: 'test',
        description: 'Test generation template',
        config: { framework: 'vitest' },
      });
    }

    // Resource requirements based on complexity
    const resources = {
      memory: complexity.complexityScore > 70 ? '2GB' : '1GB',
      cpu: complexity.complexityScore > 70 ? '2' : '1',
      timeout: complexity.estimatedEffort * 600000, // 10 minutes per estimated hour
    };

    return {
      taskType: task.type,
      capabilities: complexity.requiredCapabilities,
      tools,
      hooks,
      templates,
      strategy,
      resources,
    };
  }

  /**
   * Analyze capability gaps
   */
  private async analyzeCapabilities(
    requirements: AgentRequirements,
    availableTemplates: AgentTemplate[]
  ): Promise<AgentCapabilityAnalysis> {
    const matchingTemplates: Array<{
      template: AgentTemplate;
      matchScore: number;
      missingCapabilities: string[];
    }> = [];

    // Find matching templates
    for (const template of availableTemplates) {
      if (!template.supportedTypes.includes(requirements.taskType)) {
        continue;
      }

      const templateCapabilities = template.requiredCapabilities || [];
      const missingCapabilities = requirements.capabilities.filter(
        (cap) => !templateCapabilities.includes(cap)
      );

      const matchScore = Math.round(
        ((requirements.capabilities.length - missingCapabilities.length) /
          Math.max(requirements.capabilities.length, 1)) *
          100
      );

      matchingTemplates.push({
        template,
        matchScore,
        missingCapabilities,
      });
    }

    // Sort by match score
    matchingTemplates.sort((a, b) => b.matchScore - a.matchScore);

    // Determine if existing templates can handle the task
    const bestMatch = matchingTemplates[0];
    const canHandleWithExisting = bestMatch ? bestMatch.matchScore >= 70 : false;

    // Determine recommendation
    let recommendation: 'use-existing' | 'extend-existing' | 'create-new';
    if (canHandleWithExisting) {
      recommendation = 'use-existing';
    } else if (bestMatch && bestMatch.matchScore >= 40) {
      recommendation = 'extend-existing';
    } else {
      recommendation = 'create-new';
    }

    // Required new capabilities
    const requiredNewCapabilities = bestMatch
      ? bestMatch.missingCapabilities
      : requirements.capabilities;

    return {
      canHandleWithExisting,
      matchingTemplates,
      requiredNewCapabilities,
      recommendation,
    };
  }

  /**
   * Determine assignment strategy
   */
  private determineAssignmentStrategy(
    complexity: TaskComplexityAnalysis,
    capabilityAnalysis: AgentCapabilityAnalysis
  ): AssignmentStrategy {
    let type: 'reuse-existing' | 'create-new' | 'hybrid';
    let reason: string;
    let confidence: number;

    if (capabilityAnalysis.recommendation === 'use-existing') {
      type = 'reuse-existing';
      reason = 'Existing templates have sufficient capabilities';
      confidence = 90;
    } else if (capabilityAnalysis.recommendation === 'extend-existing') {
      type = 'hybrid';
      reason = 'Extend existing template with additional capabilities';
      confidence = 70;
    } else {
      type = 'create-new';
      reason = 'No existing template matches requirements';
      confidence = 60;
    }

    // Adjust confidence based on complexity
    if (complexity.complexityScore > 80) {
      confidence = Math.max(50, confidence - 20);
    }

    // Fallback strategy
    const fallback: AssignmentStrategy | undefined =
      type === 'reuse-existing'
        ? {
            type: 'create-new',
            reason: 'Fallback if existing agent fails',
            confidence: 50,
          }
        : undefined;

    return {
      type,
      reason,
      confidence,
      fallback,
    };
  }

  /**
   * Infer tool type from name
   */
  private inferToolType(
    toolName: string
  ): 'command' | 'api' | 'library' | 'service' {
    const commandTools = ['tsc', 'eslint', 'prettier', 'docker', 'npm', 'git'];
    const apiTools = ['axios', 'fetch', 'octokit'];
    const serviceTools = ['github', 'vercel', 'firebase', 'aws'];

    if (commandTools.includes(toolName)) return 'command';
    if (apiTools.includes(toolName)) return 'api';
    if (serviceTools.includes(toolName)) return 'service';
    return 'library';
  }
}
