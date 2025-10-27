#!/usr/bin/env tsx
/**
 * Workflow Orchestrator - Phase D
 *
 * Coordinates multiple agents for complex multi-step tasks
 * Implements parallel execution and dependency management
 */

import { Octokit } from '@octokit/rest';
import { LabelStateMachine } from './label-state-machine';

// ============================================================================
// Types
// ============================================================================

interface Task {
  id: string;
  type: 'issue' | 'pr' | 'review' | 'deploy';
  issueNumber: number;
  agent: string;
  priority: number;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: any;
}

interface WorkflowStep {
  name: string;
  agent: string;
  action: string;
  dependsOn?: string[];
  parallel?: boolean;
  timeout?: number; // minutes
}

interface Workflow {
  id: string;
  name: string;
  issueNumber: number;
  steps: WorkflowStep[];
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
}

// ============================================================================
// Workflow Orchestrator
// ============================================================================

export class WorkflowOrchestrator {
  private octokit: Octokit;
  private stateMachine: LabelStateMachine;
  private owner: string;
  private repo: string;
  private runningTasks: Map<string, Task> = new Map();
  private workflows: Map<string, Workflow> = new Map();

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.stateMachine = new LabelStateMachine(token, owner, repo);
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Create a new workflow for an issue
   */
  async createWorkflow(issueNumber: number, workflowType: string): Promise<Workflow> {
    console.log(`🎯 Creating workflow for issue #${issueNumber}: ${workflowType}`);

    const issueState = await this.stateMachine.getIssueState(issueNumber);

    let steps: WorkflowStep[];

    switch (workflowType) {
      case 'feature':
        steps = this.getFeatureWorkflow(issueState);
        break;
      case 'bugfix':
        steps = this.getBugfixWorkflow(issueState);
        break;
      case 'refactor':
        steps = this.getRefactorWorkflow(issueState);
        break;
      default:
        steps = this.getDefaultWorkflow(issueState);
    }

    const workflow: Workflow = {
      id: `workflow-${issueNumber}-${Date.now()}`,
      name: workflowType,
      issueNumber,
      steps,
      currentStep: 0,
      status: 'pending',
    };

    this.workflows.set(workflow.id, workflow);

    await this.commentWorkflowPlan(issueNumber, workflow);

    return workflow;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    console.log(`🚀 Executing workflow: ${workflow.name} for #${workflow.issueNumber}`);

    workflow.status = 'running';
    workflow.startTime = new Date();

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        workflow.currentStep = i;

        console.log(`\n📍 Step ${i + 1}/${workflow.steps.length}: ${step.name}`);

        // Check dependencies
        if (step.dependsOn && step.dependsOn.length > 0) {
          await this.waitForDependencies(workflow, step.dependsOn);
        }

        // Execute step
        await this.executeStep(workflow, step);

        // Update issue state
        await this.updateIssueProgress(workflow);
      }

      workflow.status = 'completed';
      workflow.endTime = new Date();

      console.log(`\n✅ Workflow completed: ${workflow.name}`);

      await this.commentWorkflowCompletion(workflow);
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = new Date();

      console.error(`\n❌ Workflow failed: ${error}`);

      await this.commentWorkflowFailure(workflow, error);
      throw error;
    }
  }

  /**
   * Execute parallel workflows for multiple issues
   */
  async executeParallel(issueNumbers: number[], workflowType: string): Promise<void> {
    console.log(`🔄 Executing parallel workflows for ${issueNumbers.length} issues`);

    const workflows = await Promise.all(
      issueNumbers.map((num) => this.createWorkflow(num, workflowType))
    );

    await Promise.all(workflows.map((workflow) => this.executeWorkflow(workflow.id)));

    console.log(`\n✅ All parallel workflows completed`);
  }

  // ============================================================================
  // Workflow Templates
  // ============================================================================

  private getFeatureWorkflow(_issueState: any): WorkflowStep[] {
    return [
      {
        name: 'Analyze Requirements',
        agent: 'CoordinatorAgent',
        action: 'Analyze issue and break down into tasks',
      },
      {
        name: 'Design Solution',
        agent: 'CodeGenAgent',
        action: 'Design architecture and API',
        dependsOn: ['Analyze Requirements'],
      },
      {
        name: 'Implement Feature',
        agent: 'CodeGenAgent',
        action: 'Write code and tests',
        dependsOn: ['Design Solution'],
        timeout: 30,
      },
      {
        name: 'Code Review',
        agent: 'ReviewAgent',
        action: 'Review code quality and test coverage',
        dependsOn: ['Implement Feature'],
      },
      {
        name: 'Integration Tests',
        agent: 'ReviewAgent',
        action: 'Run integration tests',
        dependsOn: ['Code Review'],
      },
      {
        name: 'Deploy to Staging',
        agent: 'DeploymentAgent',
        action: 'Deploy to staging environment',
        dependsOn: ['Integration Tests'],
      },
      {
        name: 'Verify Deployment',
        agent: 'DeploymentAgent',
        action: 'Run smoke tests',
        dependsOn: ['Deploy to Staging'],
      },
    ];
  }

  private getBugfixWorkflow(_issueState: any): WorkflowStep[] {
    return [
      {
        name: 'Reproduce Bug',
        agent: 'CodeGenAgent',
        action: 'Write failing test case',
      },
      {
        name: 'Root Cause Analysis',
        agent: 'CoordinatorAgent',
        action: 'Identify bug source',
        dependsOn: ['Reproduce Bug'],
      },
      {
        name: 'Fix Bug',
        agent: 'CodeGenAgent',
        action: 'Implement fix',
        dependsOn: ['Root Cause Analysis'],
        timeout: 15,
      },
      {
        name: 'Verify Fix',
        agent: 'ReviewAgent',
        action: 'Run regression tests',
        dependsOn: ['Fix Bug'],
      },
      {
        name: 'Deploy Hotfix',
        agent: 'DeploymentAgent',
        action: 'Deploy to production',
        dependsOn: ['Verify Fix'],
      },
    ];
  }

  private getRefactorWorkflow(_issueState: any): WorkflowStep[] {
    return [
      {
        name: 'Identify Code Smells',
        agent: 'ReviewAgent',
        action: 'Analyze code quality',
      },
      {
        name: 'Plan Refactoring',
        agent: 'CoordinatorAgent',
        action: 'Design refactoring strategy',
        dependsOn: ['Identify Code Smells'],
      },
      {
        name: 'Refactor Code',
        agent: 'CodeGenAgent',
        action: 'Apply refactoring',
        dependsOn: ['Plan Refactoring'],
        timeout: 20,
      },
      {
        name: 'Verify No Regressions',
        agent: 'ReviewAgent',
        action: 'Run full test suite',
        dependsOn: ['Refactor Code'],
      },
    ];
  }

  private getDefaultWorkflow(issueState: any): WorkflowStep[] {
    return [
      {
        name: 'Analyze Task',
        agent: 'CoordinatorAgent',
        action: 'Understand requirements',
      },
      {
        name: 'Execute Task',
        agent: issueState.agent || 'CodeGenAgent',
        action: 'Complete task',
        dependsOn: ['Analyze Task'],
      },
      {
        name: 'Review Results',
        agent: 'ReviewAgent',
        action: 'Quality check',
        dependsOn: ['Execute Task'],
      },
    ];
  }

  // ============================================================================
  // Step Execution
  // ============================================================================

  private async executeStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    console.log(`   Agent: ${step.agent}`);
    console.log(`   Action: ${step.action}`);

    // Create task
    const task: Task = {
      id: `task-${workflow.issueNumber}-${workflow.currentStep}`,
      type: 'issue',
      issueNumber: workflow.issueNumber,
      agent: step.agent,
      priority: this.calculatePriority(step),
      dependencies: step.dependsOn || [],
      status: 'running',
      startTime: new Date(),
    };

    this.runningTasks.set(task.id, task);

    try {
      // Simulate agent execution
      // In real implementation, this would trigger actual agent workflows
      await this.triggerAgent(step.agent, workflow.issueNumber, step.action);

      // Update state machine
      await this.updateStateMachine(workflow, step);

      task.status = 'completed';
      task.endTime = new Date();

      console.log(`   ✅ Completed in ${this.getTaskDuration(task)} min`);
    } catch (error) {
      task.status = 'failed';
      task.endTime = new Date();
      throw error;
    }
  }

  private async triggerAgent(agent: string, issueNumber: number, action: string): Promise<void> {
    // TODO: Actual agent triggering logic
    // For now, just add a comment
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body: `🤖 **${agent}** executing: ${action}`,
    });

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private async updateStateMachine(workflow: Workflow, step: WorkflowStep): Promise<void> {
    // Update issue state based on workflow progress
    const stateMap: Record<string, any> = {
      'Analyze Requirements': 'analyzing',
      'Design Solution': 'analyzing',
      'Implement Feature': 'implementing',
      'Fix Bug': 'implementing',
      'Code Review': 'reviewing',
      'Integration Tests': 'reviewing',
    };

    const newState = stateMap[step.name];
    if (newState) {
      await this.stateMachine.transitionState(
        workflow.issueNumber,
        newState,
        `Workflow step: ${step.name}`
      );
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private async waitForDependencies(_workflow: Workflow, dependencies: string[]): Promise<void> {
    console.log(`   ⏳ Waiting for dependencies: ${dependencies.join(', ')}`);
    // In real implementation, check if dependent steps are completed
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private calculatePriority(step: WorkflowStep): number {
    // Higher priority for steps with no dependencies (can run first)
    const basePriority = step.dependsOn ? step.dependsOn.length : 10;
    return 10 - basePriority;
  }

  private getTaskDuration(task: Task): number {
    if (!task.startTime || !task.endTime) return 0;
    return Math.round((task.endTime.getTime() - task.startTime.getTime()) / 1000 / 60);
  }

  private async updateIssueProgress(workflow: Workflow): Promise<void> {
    const progress = ((workflow.currentStep + 1) / workflow.steps.length) * 100;
    console.log(`   📊 Progress: ${progress.toFixed(0)}%`);
  }

  // ============================================================================
  // Comments
  // ============================================================================

  private async commentWorkflowPlan(issueNumber: number, workflow: Workflow): Promise<void> {
    let body = `## 🎯 Workflow Plan: ${workflow.name}\n\n`;
    body += `**Steps** (${workflow.steps.length}):\n\n`;

    workflow.steps.forEach((step, i) => {
      body += `${i + 1}. **${step.name}** - ${step.agent}\n`;
      body += `   - Action: ${step.action}\n`;
      if (step.dependsOn) {
        body += `   - Depends on: ${step.dependsOn.join(', ')}\n`;
      }
      body += '\n';
    });

    body += `---\n*Phase D: Workflow Orchestration*`;

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body,
    });
  }

  private async commentWorkflowCompletion(workflow: Workflow): Promise<void> {
    const duration = workflow.endTime && workflow.startTime
      ? Math.round((workflow.endTime.getTime() - workflow.startTime.getTime()) / 1000 / 60)
      : 0;

    const body = `## ✅ Workflow Completed: ${workflow.name}\n\n` +
      `**Duration**: ${duration} minutes\n` +
      `**Steps Completed**: ${workflow.steps.length}/${workflow.steps.length}\n\n` +
      `---\n*Automated by Workflow Orchestrator*`;

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: workflow.issueNumber,
      body,
    });
  }

  private async commentWorkflowFailure(workflow: Workflow, error: any): Promise<void> {
    const body = `## ❌ Workflow Failed: ${workflow.name}\n\n` +
      `**Failed at Step**: ${workflow.currentStep + 1}/${workflow.steps.length}\n` +
      `**Step Name**: ${workflow.steps[workflow.currentStep].name}\n` +
      `**Error**: ${error.message || error}\n\n` +
      `---\n*Automated by Workflow Orchestrator*`;

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: workflow.issueNumber,
      body,
    });
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || 'ShunsukeHayashi/Autonomous-Operations';
  const [owner, repo] = repository.split('/');

  if (!token) {
    console.error('❌ GITHUB_TOKEN is required');
    process.exit(1);
  }

  const orchestrator = new WorkflowOrchestrator(token, owner, repo);

  const command = process.argv[2];
  const issueNumber = parseInt(process.argv[3]);
  const workflowType = process.argv[4] || 'default';

  switch (command) {
    case 'create':
      await orchestrator.createWorkflow(issueNumber, workflowType);
      break;

    case 'execute':
      const workflow = await orchestrator.createWorkflow(issueNumber, workflowType);
      await orchestrator.executeWorkflow(workflow.id);
      break;

    case 'parallel':
      const issues = process.argv.slice(3).map((n) => parseInt(n));
      await orchestrator.executeParallel(issues, workflowType);
      break;

    default:
      console.log('Usage:');
      console.log('  workflow-orchestrator.ts create <issue> [workflow-type]');
      console.log('  workflow-orchestrator.ts execute <issue> [workflow-type]');
      console.log('  workflow-orchestrator.ts parallel <issue1> <issue2> ... [workflow-type]');
      console.log('');
      console.log('Workflow types: feature, bugfix, refactor, default');
      break;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}
