#!/usr/bin/env tsx
/**
 * Label-based State Machine for Agentic OS
 *
 * Implements state management and transitions using GitHub Labels.
 * All automation MUST check labels before taking action.
 *
 * Constitutional Requirement:
 *   "Labels are the OS's state management mechanism"
 *
 * State Flow:
 *   pending → analyzing → implementing → reviewing → done
 *
 * Usage:
 *   npm run state:check -- --issue 123
 *   npm run state:transition -- --issue 123 --to implementing
 */

import { Octokit } from '@octokit/rest';

// ============================================================================
// Types
// ============================================================================

export type State =
  | 'pending'
  | 'analyzing'
  | 'implementing'
  | 'reviewing'
  | 'done'
  | 'blocked'
  | 'failed'
  | 'paused';

export type AgentType =
  | 'coordinator'
  | 'codegen'
  | 'review'
  | 'issue'
  | 'pr'
  | 'deployment';

export type Priority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';

export type Severity = 'Sev.1-Critical' | 'Sev.2-High' | 'Sev.3-Medium' | 'Sev.4-Low';

export interface IssueState {
  number: number;
  title: string;
  state: State | null;
  agent: AgentType | null;
  priority: Priority | null;
  severity: Severity | null;
  labels: string[];
  canTransitionTo: State[];
}

export interface StateTransition {
  from: State;
  to: State;
  trigger: string;
  action: string;
  validation?: (issue: IssueState) => boolean;
}

// ============================================================================
// State Transition Rules
// ============================================================================

const STATE_TRANSITIONS: StateTransition[] = [
  {
    from: 'pending',
    to: 'analyzing',
    trigger: 'CoordinatorAgent assigned',
    action: 'Analyze dependencies and complexity',
  },
  {
    from: 'analyzing',
    to: 'implementing',
    trigger: 'Analysis complete, specialists assigned',
    action: 'Start implementation',
    validation: (issue) => issue.agent !== null && issue.agent !== 'coordinator',
  },
  {
    from: 'implementing',
    to: 'reviewing',
    trigger: 'PR created',
    action: 'Start quality checks',
  },
  {
    from: 'reviewing',
    to: 'done',
    trigger: 'Quality score ≥ 80, PR merged',
    action: 'Close issue, update metrics',
  },
  {
    from: 'pending',
    to: 'blocked',
    trigger: 'Missing dependencies or approval',
    action: 'Escalate to Guardian',
  },
  {
    from: 'analyzing',
    to: 'blocked',
    trigger: 'Cannot resolve dependencies',
    action: 'Escalate to Guardian',
  },
  {
    from: 'implementing',
    to: 'blocked',
    trigger: 'Blocked by technical issue',
    action: 'Escalate to Guardian',
  },
  {
    from: 'reviewing',
    to: 'blocked',
    trigger: 'Quality check failed critically',
    action: 'Escalate to Guardian',
  },
  {
    from: 'blocked',
    to: 'analyzing',
    trigger: 'Guardian resolved blocker',
    action: 'Restart from analysis',
  },
  {
    from: 'failed',
    to: 'analyzing',
    trigger: 'Issue fixed, ready to retry',
    action: 'Restart from analysis',
  },
  {
    from: 'paused',
    to: 'implementing',
    trigger: 'Dependencies resolved',
    action: 'Resume implementation',
  },
];

// ============================================================================
// Label State Machine
// ============================================================================

export class LabelStateMachine {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Get current state of an issue
   */
  async getIssueState(issueNumber: number): Promise<IssueState> {
    const { data: issue } = await this.octokit.rest.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
    });

    const labels = issue.labels.map((label) =>
      typeof label === 'string' ? label : label.name || '',
    );

    const state = this.extractState(labels);
    const agent = this.extractAgent(labels);
    const priority = this.extractPriority(labels);
    const severity = this.extractSeverity(labels);
    const canTransitionTo = this.getValidTransitions(state);

    return {
      number: issue.number,
      title: issue.title,
      state,
      agent,
      priority,
      severity,
      labels,
      canTransitionTo,
    };
  }

  /**
   * Transition issue to new state
   */
  async transitionState(
    issueNumber: number,
    newState: State,
    reason?: string,
  ): Promise<void> {
    const currentState = await this.getIssueState(issueNumber);

    if (!currentState.state) {
      console.log(`⚠️ Issue #${issueNumber} has no current state, setting to ${newState}`);
    } else {
      // Validate transition
      const transition = STATE_TRANSITIONS.find(
        (t) => t.from === currentState.state && t.to === newState,
      );

      if (!transition) {
        throw new Error(
          `Invalid state transition: ${currentState.state} → ${newState}`,
        );
      }

      // Check validation function
      if (transition.validation && !transition.validation(currentState)) {
        throw new Error(
          `Transition validation failed: ${transition.trigger}`,
        );
      }

      console.log(`✅ Valid transition: ${currentState.state} → ${newState}`);
      console.log(`   Trigger: ${transition.trigger}`);
      console.log(`   Action: ${transition.action}`);
    }

    // Remove old state labels
    const stateLabels = currentState.labels.filter((label) =>
      label.startsWith('📥 state:') ||
      label.startsWith('🔍 state:') ||
      label.startsWith('🏗️ state:') ||
      label.startsWith('👀 state:') ||
      label.startsWith('✅ state:') ||
      label.startsWith('🔴 state:') ||
      label.startsWith('🛑 state:') ||
      label.startsWith('⏸️ state:'),
    );

    for (const label of stateLabels) {
      await this.octokit.rest.issues.removeLabel({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        name: label,
      });
    }

    // Add new state label
    const newLabel = this.stateToLabel(newState);
    await this.octokit.rest.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      labels: [newLabel],
    });

    // Add comment
    const comment = `🤖 **State Transition**

**From**: ${currentState.state || 'none'}
**To**: ${newState}
${reason ? `**Reason**: ${reason}` : ''}

---
*Automated by [Label State Machine](../scripts/label-state-machine.ts)*`;

    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body: comment,
    });

    console.log(`✅ State transition complete: ${currentState.state} → ${newState}`);
  }

  /**
   * Assign agent to issue
   */
  async assignAgent(issueNumber: number, agent: AgentType): Promise<void> {
    const currentState = await this.getIssueState(issueNumber);

    // Remove old agent labels
    const agentLabels = currentState.labels.filter((label) =>
      label.startsWith('🤖 agent:'),
    );

    for (const label of agentLabels) {
      await this.octokit.rest.issues.removeLabel({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        name: label,
      });
    }

    // Add new agent label
    await this.octokit.rest.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      labels: [`🤖 agent:${agent}`],
    });

    console.log(`✅ Assigned agent: ${agent}`);
  }

  /**
   * Check if issue can transition to target state
   */
  canTransition(currentState: State | null, targetState: State): boolean {
    if (!currentState) {return true;} // Allow any state if no current state

    return STATE_TRANSITIONS.some(
      (t) => t.from === currentState && t.to === targetState,
    );
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private extractState(labels: string[]): State | null {
    const stateLabel = labels.find((label) => label.includes('state:'));
    if (!stateLabel) {return null;}

    if (stateLabel.includes('pending')) {return 'pending';}
    if (stateLabel.includes('analyzing')) {return 'analyzing';}
    if (stateLabel.includes('implementing')) {return 'implementing';}
    if (stateLabel.includes('reviewing')) {return 'reviewing';}
    if (stateLabel.includes('done')) {return 'done';}
    if (stateLabel.includes('blocked')) {return 'blocked';}
    if (stateLabel.includes('failed')) {return 'failed';}
    if (stateLabel.includes('paused')) {return 'paused';}

    return null;
  }

  private extractAgent(labels: string[]): AgentType | null {
    const agentLabel = labels.find((label) => label.includes('agent:'));
    if (!agentLabel) {return null;}

    if (agentLabel.includes('coordinator')) {return 'coordinator';}
    if (agentLabel.includes('codegen')) {return 'codegen';}
    if (agentLabel.includes('review')) {return 'review';}
    if (agentLabel.includes('issue')) {return 'issue';}
    if (agentLabel.includes('pr')) {return 'pr';}
    if (agentLabel.includes('deployment')) {return 'deployment';}

    return null;
  }

  private extractPriority(labels: string[]): Priority | null {
    const priorityLabel = labels.find((label) => label.includes('priority:'));
    if (!priorityLabel) {return null;}

    if (priorityLabel.includes('P0-Critical')) {return 'P0-Critical';}
    if (priorityLabel.includes('P1-High')) {return 'P1-High';}
    if (priorityLabel.includes('P2-Medium')) {return 'P2-Medium';}
    if (priorityLabel.includes('P3-Low')) {return 'P3-Low';}

    return null;
  }

  private extractSeverity(labels: string[]): Severity | null {
    const severityLabel = labels.find((label) => label.includes('severity:'));
    if (!severityLabel) {return null;}

    if (severityLabel.includes('Sev.1-Critical')) {return 'Sev.1-Critical';}
    if (severityLabel.includes('Sev.2-High')) {return 'Sev.2-High';}
    if (severityLabel.includes('Sev.3-Medium')) {return 'Sev.3-Medium';}
    if (severityLabel.includes('Sev.4-Low')) {return 'Sev.4-Low';}

    return null;
  }

  private stateToLabel(state: State): string {
    const stateMap: Record<State, string> = {
      pending: '📥 state:pending',
      analyzing: '🔍 state:analyzing',
      implementing: '🏗️ state:implementing',
      reviewing: '👀 state:reviewing',
      done: '✅ state:done',
      blocked: '🔴 state:blocked',
      failed: '🛑 state:failed',
      paused: '⏸️ state:paused',
    };

    return stateMap[state];
  }

  private getValidTransitions(currentState: State | null): State[] {
    if (!currentState) {
      return ['pending', 'analyzing']; // Can start with pending or analyzing
    }

    return STATE_TRANSITIONS
      .filter((t) => t.from === currentState)
      .map((t) => t.to);
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const owner = process.env.GITHUB_OWNER || 'ShunsukeHayashi';
  const repo = process.env.GITHUB_REPO || 'Autonomous-Operations';

  const stateMachine = new LabelStateMachine(token, owner, repo);

  const command = process.argv[2];
  const issueArg = process.argv.find((arg) => arg.startsWith('--issue='));
  const toArg = process.argv.find((arg) => arg.startsWith('--to='));
  const agentArg = process.argv.find((arg) => arg.startsWith('--agent='));
  const reasonArg = process.argv.find((arg) => arg.startsWith('--reason='));

  const issueNumber = issueArg ? parseInt(issueArg.split('=')[1], 10) : null;
  const targetState = toArg ? (toArg.split('=')[1] as State) : null;
  const agent = agentArg ? (agentArg.split('=')[1] as AgentType) : null;
  const reason = reasonArg ? reasonArg.split('=')[1] : undefined;

  try {
    switch (command) {
      case 'check':
        if (!issueNumber) {
          console.error('❌ --issue=<number> is required');
          process.exit(1);
        }
        console.log(`📊 Checking state for Issue #${issueNumber}...`);
        const state = await stateMachine.getIssueState(issueNumber);
        console.log(JSON.stringify(state, null, 2));
        break;

      case 'transition':
        if (!issueNumber || !targetState) {
          console.error('❌ --issue=<number> and --to=<state> are required');
          process.exit(1);
        }
        console.log(`🔄 Transitioning Issue #${issueNumber} to ${targetState}...`);
        await stateMachine.transitionState(issueNumber, targetState, reason);
        break;

      case 'assign-agent':
        if (!issueNumber || !agent) {
          console.error('❌ --issue=<number> and --agent=<type> are required');
          process.exit(1);
        }
        console.log(`🤖 Assigning ${agent} to Issue #${issueNumber}...`);
        await stateMachine.assignAgent(issueNumber, agent);
        break;

      default:
        console.log(`
Label State Machine CLI

Usage:
  npm run state:check -- --issue=<number>
  npm run state:transition -- --issue=<number> --to=<state> [--reason=<text>]
  npm run state:assign-agent -- --issue=<number> --agent=<type>

Commands:
  check            - Check current state of an issue
  transition       - Transition issue to new state
  assign-agent     - Assign agent to issue

States:
  pending, analyzing, implementing, reviewing, done, blocked, failed, paused

Agents:
  coordinator, codegen, review, issue, pr, deployment

Examples:
  npm run state:check -- --issue=123
  npm run state:transition -- --issue=123 --to=implementing
  npm run state:assign-agent -- --issue=123 --agent=codegen
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default LabelStateMachine;
