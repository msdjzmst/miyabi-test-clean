/**
 * Agent system exports
 *
 * This is a placeholder implementation. Full agent system coming soon.
 */

/**
 * Base Agent interface (placeholder)
 */
export interface IAgent {
  name: string;
  version: string;
  execute(): Promise<void>;
}

/**
 * Agent registry (placeholder)
 */
export class AgentRegistry {
  private agents: Map<string, IAgent> = new Map();

  register(name: string, agent: IAgent): void {
    this.agents.set(name, agent);
  }

  get(name: string): IAgent | undefined {
    return this.agents.get(name);
  }

  getAll(): IAgent[] {
    return Array.from(this.agents.values());
  }
}
