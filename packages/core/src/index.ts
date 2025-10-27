/**
 * @agentic-os/core - Core agent system
 *
 * This is a placeholder implementation. Full implementation coming soon.
 */

// Re-export coding agents
export type { BaseAgent } from '@miyabi/coding-agents';
export { AgentFactory, AgentRegistry } from '@miyabi/coding-agents';

// Re-export core types
export * from './types/index';

/**
 * Core package version
 */
export const VERSION = '0.1.0';

/**
 * Package metadata
 */
export const metadata = {
  name: '@agentic-os/core',
  version: VERSION,
  description: 'Core agent system for Agentic OS - Autonomous development framework',
} as const;
