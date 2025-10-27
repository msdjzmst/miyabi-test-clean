#!/usr/bin/env tsx
/**
 * Check Agent Status
 *
 * Displays current status of all agents and recent execution history
 *
 * Features:
 * - Agent execution statistics
 * - Current running agents
 * - Recent errors and warnings
 * - Performance metrics
 */

import GitHubProjectAPI from '../github/github-project-api';
import chalk from 'chalk';
import Table from 'cli-table3';

interface AgentStatus {
  name: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  lastExecution?: Date;
  executionCount: number;
  avgDuration: number;
  successRate: number;
  lastError?: string;
}

class AgentStatusChecker {
  private api: GitHubProjectAPI;

  constructor(token: string, owner: string, repo: string, projectNumber: number) {
    this.api = new GitHubProjectAPI(token, { owner, repo, projectNumber });
  }

  /**
   * Get status of all agents
   */
  async getAgentStatuses(): Promise<AgentStatus[]> {
    const metrics = await this.api.calculateAgentMetrics();
    const items = await this.api.getProjectItems();

    const statuses: AgentStatus[] = metrics.map(metric => {
      // Calculate success rate based on completed items
      const agentItems = items.filter(item =>
        this.getFieldValue(item, 'Agent') === metric.agent,
      );
      const completedItems = agentItems.filter(item =>
        item.content.state === 'CLOSED' || item.content.state === 'MERGED',
      );

      const successRate = agentItems.length > 0
        ? (completedItems.length / agentItems.length) * 100
        : 0;

      // Determine current status
      const runningItems = agentItems.filter(item =>
        item.content.state === 'OPEN' &&
        this.getFieldValue(item, 'Status') === 'in-progress',
      );

      const status: AgentStatus['status'] =
        runningItems.length > 0 ? 'running' :
          successRate >= 80 ? 'completed' :
            successRate < 50 ? 'error' : 'idle';

      return {
        name: metric.agent,
        status,
        executionCount: metric.executionCount,
        avgDuration: metric.avgDuration,
        successRate,
      };
    });

    return statuses;
  }

  /**
   * Display agent statuses in a formatted table
   */
  async displayStatus(): Promise<void> {
    console.log(chalk.bold.cyan('\n🤖 Agent Status Dashboard\n'));

    const statuses = await this.getAgentStatuses();

    if (statuses.length === 0) {
      console.log(chalk.yellow('No agents found. Have you run any agents yet?'));
      return;
    }

    // Create table
    const table = new Table({
      head: [
        chalk.bold('Agent'),
        chalk.bold('Status'),
        chalk.bold('Executions'),
        chalk.bold('Avg Duration'),
        chalk.bold('Success Rate'),
      ],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
    });

    // Add rows
    for (const agent of statuses) {
      const statusIcon = this.getStatusIcon(agent.status);
      const statusText = chalk[this.getStatusColor(agent.status)](
        `${statusIcon} ${agent.status.toUpperCase()}`,
      );

      const durationText = this.formatDuration(agent.avgDuration);
      const successRateText = this.formatSuccessRate(agent.successRate);

      table.push([
        chalk.bold(agent.name),
        statusText,
        agent.executionCount.toString(),
        durationText,
        successRateText,
      ]);
    }

    console.log(table.toString());

    // Summary statistics
    const totalExecutions = statuses.reduce((sum, s) => sum + s.executionCount, 0);
    const avgSuccessRate = statuses.reduce((sum, s) => sum + s.successRate, 0) / statuses.length;
    const runningAgents = statuses.filter(s => s.status === 'running').length;

    console.log(chalk.bold.cyan('\n📊 Summary:'));
    console.log(`  Total Executions: ${chalk.bold(totalExecutions)}`);
    console.log(`  Average Success Rate: ${this.formatSuccessRate(avgSuccessRate)}`);
    console.log(`  Currently Running: ${chalk.bold(runningAgents)} agents`);

    // Health check
    const healthStatus = this.getHealthStatus(avgSuccessRate);
    console.log(`  System Health: ${healthStatus}\n`);
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: AgentStatus['status']): string {
    switch (status) {
      case 'idle': return '⏸️';
      case 'running': return '🔄';
      case 'error': return '❌';
      case 'completed': return '✅';
      default: return '❓';
    }
  }

  /**
   * Get status color
   */
  private getStatusColor(status: AgentStatus['status']): 'green' | 'yellow' | 'red' | 'gray' {
    switch (status) {
      case 'running': return 'yellow';
      case 'error': return 'red';
      case 'completed': return 'green';
      default: return 'gray';
    }
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {return `${ms.toFixed(0)}ms`;}
    if (ms < 60000) {return chalk.green(`${(ms / 1000).toFixed(1)}s`);}
    if (ms < 3600000) {return chalk.yellow(`${(ms / 60000).toFixed(1)}m`);}
    return chalk.red(`${(ms / 3600000).toFixed(1)}h`);
  }

  /**
   * Format success rate
   */
  private formatSuccessRate(rate: number): string {
    const rateText = `${rate.toFixed(1)}%`;
    if (rate >= 80) {return chalk.green(rateText);}
    if (rate >= 60) {return chalk.yellow(rateText);}
    return chalk.red(rateText);
  }

  /**
   * Get overall health status
   */
  private getHealthStatus(avgSuccessRate: number): string {
    if (avgSuccessRate >= 90) {return chalk.green('✅ Excellent');}
    if (avgSuccessRate >= 80) {return chalk.green('✅ Good');}
    if (avgSuccessRate >= 70) {return chalk.yellow('⚠️ Fair');}
    if (avgSuccessRate >= 60) {return chalk.yellow('⚠️ Poor');}
    return chalk.red('❌ Critical');
  }

  /**
   * Get field value from project item
   */
  private getFieldValue(item: any, fieldName: string): string | number | null {
    const fieldValue = item.fieldValues.nodes.find(
      (node: any) => node.field?.name === fieldName,
    );

    if (!fieldValue) {return null;}

    return fieldValue.name || fieldValue.number || fieldValue.date || null;
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error(chalk.red('❌ GITHUB_TOKEN environment variable is required'));
    console.error(chalk.gray('   Set it with: export GITHUB_TOKEN=your_token_here'));
    process.exit(1);
  }

  const owner = process.env.GITHUB_OWNER || 'ShunsukeHayashi';
  const repo = process.env.GITHUB_REPO || 'Autonomous-Operations';
  const projectNumber = parseInt(process.env.PROJECT_NUMBER || '1', 10);

  try {
    const checker = new AgentStatusChecker(token, owner, repo, projectNumber);
    await checker.displayStatus();
  } catch (error) {
    console.error(chalk.red('❌ Error checking agent status:'), error);
    process.exit(1);
  }
}

// ESM module check
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export default AgentStatusChecker;
