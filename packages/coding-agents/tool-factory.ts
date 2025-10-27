/**
 * ToolFactory - Dynamic tool generation
 *
 * Creates tools, templates, hooks dynamically based on requirements
 */

import {
  ToolRequirement,
  HookRequirement,
  DynamicToolSpec,
  ToolCreationResult,
} from './types/agent-analysis';
import { PreHook, PostHook, ErrorHook, HookContext } from './types/hooks';
import { AgentResult } from './types/index';
import { logger } from './ui/index';

export class ToolFactory {
  private static instance: ToolFactory;
  private createdTools: Map<string, DynamicToolSpec> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ToolFactory {
    if (!ToolFactory.instance) {
      ToolFactory.instance = new ToolFactory();
    }
    return ToolFactory.instance;
  }

  /**
   * Create dynamic tool from requirement
   */
  async createTool(requirement: ToolRequirement): Promise<ToolCreationResult> {
    const startTime = Date.now();

    logger.info(`Creating dynamic tool: ${requirement.name} (${requirement.type})`);

    try {
      let implementation: string | Record<string, any>;

      switch (requirement.type) {
        case 'command':
          implementation = this.generateCommandTool(requirement);
          break;
        case 'api':
          implementation = this.generateApiTool(requirement);
          break;
        case 'library':
          implementation = this.generateLibraryTool(requirement);
          break;
        case 'service':
          implementation = this.generateServiceTool(requirement);
          break;
        default:
          throw new Error(`Unknown tool type: ${requirement.type}`);
      }

      const toolSpec: DynamicToolSpec = {
        id: `dyn-tool-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: requirement.name,
        description: requirement.description,
        implementationType: this.getImplementationType(requirement.type),
        implementation,
        inputSchema: requirement.parameters,
        outputSchema: { result: 'any' },
        dependencies: this.inferDependencies(requirement),
      };

      // Store tool
      this.createdTools.set(toolSpec.id, toolSpec);

      const durationMs = Date.now() - startTime;

      logger.success(`✓ Tool created: ${toolSpec.id} (${durationMs}ms)`);

      return {
        success: true,
        tool: toolSpec,
        durationMs,
        metadata: {
          requirement,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error(`Failed to create tool: ${(error as Error).message}`);

      return {
        success: false,
        error: (error as Error).message,
        durationMs,
      };
    }
  }

  /**
   * Create dynamic hook from requirement
   */
  async createHook(
    requirement: HookRequirement
  ): Promise<PreHook | PostHook | ErrorHook> {
    logger.info(`Creating dynamic hook: ${requirement.name} (${requirement.type})`);

    switch (requirement.type) {
      case 'pre':
        return this.createPreHook(requirement);
      case 'post':
        return this.createPostHook(requirement);
      case 'error':
        return this.createErrorHook(requirement);
      default:
        throw new Error(`Unknown hook type: ${requirement.type}`);
    }
  }

  /**
   * Generate command tool implementation
   */
  private generateCommandTool(requirement: ToolRequirement): string {
    const { name } = requirement;

    return `
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function ${this.sanitizeName(name)}(params: any): Promise<any> {
  const command = '${name}';
  const args = Object.entries(params)
    .map(([key, value]) => \`--\${key}=\${value}\`)
    .join(' ');

  try {
    const { stdout, stderr } = await execAsync(\`\${command} \${args}\`);

    if (stderr) {
      console.warn('Command stderr:', stderr);
    }

    return {
      success: true,
      output: stdout.trim(),
      command: \`\${command} \${args}\`,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      command: \`\${command} \${args}\`,
    };
  }
}
`.trim();
  }

  /**
   * Generate API tool implementation
   */
  private generateApiTool(requirement: ToolRequirement): string {
    const { name, parameters } = requirement;

    return `
export async function ${this.sanitizeName(name)}(params: any): Promise<any> {
  const url = params.url || '${parameters.url || 'http://localhost'}';
  const method = params.method || '${parameters.method || 'GET'}';
  const headers = params.headers || ${JSON.stringify(parameters.headers || {})};

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: method !== 'GET' ? JSON.stringify(params.body) : undefined,
    });

    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
`.trim();
  }

  /**
   * Generate library tool implementation
   */
  private generateLibraryTool(requirement: ToolRequirement): string {
    const { name } = requirement;

    return `
export async function ${this.sanitizeName(name)}(params: any): Promise<any> {
  // Library tool: ${name}
  // This is a placeholder implementation
  // In a real system, this would dynamically import and wrap the library

  console.log('Executing library tool: ${name}', params);

  try {
    // Dynamic import (example)
    // const lib = await import('${name}');
    // return lib.default(params);

    return {
      success: true,
      message: 'Library tool executed',
      params,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
`.trim();
  }

  /**
   * Generate service tool implementation
   */
  private generateServiceTool(requirement: ToolRequirement): string {
    const { name, parameters } = requirement;

    return `
export class ${this.capitalize(this.sanitizeName(name))}Service {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async execute(params: any): Promise<any> {
    // Service tool: ${name}
    console.log('Executing service:', '${name}', params);

    try {
      // Service-specific logic would go here
      return {
        success: true,
        service: '${name}',
        result: params,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async health(): Promise<boolean> {
    // Health check
    return true;
  }
}

export async function ${this.sanitizeName(name)}(params: any): Promise<any> {
  const service = new ${this.capitalize(this.sanitizeName(name))}Service(${JSON.stringify(parameters)});
  return service.execute(params);
}
`.trim();
  }

  /**
   * Create pre-hook from requirement
   */
  private createPreHook(requirement: HookRequirement): PreHook {
    const { name, description, priority, config } = requirement;

    return {
      name,
      description,
      priority,
      async execute(_context: HookContext): Promise<void> {
        logger.info(`[PreHook: ${name}] Executing...`);

        // Dynamic hook logic based on config
        if (config.riskFactors) {
          logger.warning(`Risk factors detected: ${config.riskFactors.join(', ')}`);
        }

        if (config.dependencies) {
          logger.info(`Checking dependencies: ${config.dependencies.join(', ')}`);
        }

        // Validation logic
        if (config.validate) {
          // Perform validation
          logger.info('Validation passed');
        }

        logger.success(`[PreHook: ${name}] Complete`);
      },
    };
  }

  /**
   * Create post-hook from requirement
   */
  private createPostHook(requirement: HookRequirement): PostHook {
    const { name, description, priority, config } = requirement;

    return {
      name,
      description,
      priority,
      async execute(context: HookContext, result: AgentResult): Promise<void> {
        logger.info(`[PostHook: ${name}] Executing...`);

        // Post-execution logic
        if (config.notify) {
          logger.info(`Notification: Task ${context.task.id} completed`);
        }

        if (config.report) {
          logger.info(`Result: ${JSON.stringify(result.data)}`);
        }

        if (config.cleanup) {
          logger.info('Performing cleanup...');
        }

        logger.success(`[PostHook: ${name}] Complete`);
      },
    };
  }

  /**
   * Create error-hook from requirement
   */
  private createErrorHook(requirement: HookRequirement): ErrorHook {
    const { name, description, priority, config } = requirement;

    return {
      name,
      description,
      priority,
      async execute(_context: HookContext, error: Error): Promise<void> {
        logger.error(`[ErrorHook: ${name}] Handling error...`);

        // Error handling logic
        if (config.notify) {
          logger.error(`Error notification: ${error.message}`);
        }

        if (config.rollback) {
          logger.warning('Initiating rollback...');
        }

        if (config.escalate) {
          logger.warning('Escalating to higher authority...');
        }

        logger.info(`[ErrorHook: ${name}] Error handled`);
      },
    };
  }

  /**
   * Get implementation type
   */
  private getImplementationType(
    toolType: string
  ): 'function' | 'class' | 'api-wrapper' | 'command-wrapper' {
    switch (toolType) {
      case 'command':
        return 'command-wrapper';
      case 'api':
        return 'api-wrapper';
      case 'service':
        return 'class';
      default:
        return 'function';
    }
  }

  /**
   * Infer dependencies
   */
  private inferDependencies(requirement: ToolRequirement): string[] {
    const dependencies: string[] = [];

    switch (requirement.type) {
      case 'command':
        dependencies.push('child_process', 'util');
        break;
      case 'api':
        // Built-in fetch, no dependencies
        break;
      case 'library':
        dependencies.push(requirement.name);
        break;
      case 'service':
        // Service-specific dependencies
        break;
    }

    return dependencies;
  }

  /**
   * Sanitize name for function/class names
   */
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get created tool
   */
  getTool(toolId: string): DynamicToolSpec | undefined {
    return this.createdTools.get(toolId);
  }

  /**
   * Get all created tools
   */
  getAllTools(): DynamicToolSpec[] {
    return Array.from(this.createdTools.values());
  }

  /**
   * Clear all created tools
   */
  clear(): void {
    this.createdTools.clear();
    logger.info('Tool factory cleared');
  }

  /**
   * Export tool as executable file
   */
  async exportTool(toolId: string, outputPath: string): Promise<boolean> {
    const tool = this.createdTools.get(toolId);

    if (!tool) {
      logger.error(`Tool not found: ${toolId}`);
      return false;
    }

    if (typeof tool.implementation !== 'string') {
      logger.error('Can only export tools with string implementation');
      return false;
    }

    try {
      const fs = await import('fs/promises');
      await fs.writeFile(outputPath, tool.implementation, 'utf-8');
      logger.success(`✓ Tool exported to: ${outputPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to export tool: ${(error as Error).message}`);
      return false;
    }
  }
}
