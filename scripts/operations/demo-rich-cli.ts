#!/usr/bin/env tsx
/**
 * Rich CLI Output Demo
 *
 * Demonstrates the capabilities of the Agentic OS UI system
 * Addresses Issue #4 - Rich CLI Output Styling
 *
 * Usage:
 *   npx tsx scripts/demo-rich-cli.ts
 */

import {
  logger,
  theme,
  // Phase 2 imports
  createAgentStatusTable,
  createKPITable,
  successBox,
  warningBox,
  agentBox,
  resultSummaryBox,
  MultiStepProgress,
  renderTaskTree,
  type AgentStatus,
  type KPIMetric,
  type TaskNode,
} from '@miyabi/coding-agents/ui/index';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Clear screen
  logger.clear();

  // ===== HEADER DEMO =====
  logger.header('🌍 Agentic OS — UI System Demo', true);

  logger.muted('Demonstrating rich CLI output capabilities...');
  logger.newline();

  // ===== STATUS MESSAGES =====
  logger.section('✨', 'Status Messages');
  logger.success('Operation completed successfully');
  logger.error('Something went wrong', new Error('Example error'));
  logger.warning('This is a warning message');
  logger.info('Informational message');
  logger.newline();

  // ===== AGENT MESSAGES =====
  logger.section('🤖', 'Agent Messages');
  logger.agent('CoordinatorAgent', 'Analyzing Issue #123...');
  logger.agent('CodeGenAgent', 'Generating code for login component');
  logger.agent('ReviewAgent', 'Running quality checks...');
  logger.agent('IssueAgent', 'Auto-labeling Issue #456');
  logger.agent('PRAgent', 'Creating Draft PR #789');
  logger.agent('DeploymentAgent', 'Deploying to production...');
  logger.newline();

  // ===== HUMAN MESSAGES =====
  logger.section('👤', 'Human/Guardian Messages');
  logger.human('Guardian approval required');
  logger.human('PR #3 approved for merge');
  logger.newline();

  // ===== BOXES =====
  logger.section('📦', 'Boxes & Containers');

  logger.box(
    `🤖 CoordinatorAgent v1.0.0\nTask: Analyze Issue #123\nStatus: In Progress`,
    {
      title: 'Agent Status',
      borderStyle: 'round',
      padding: 1,
    },
  );

  logger.newline();

  logger.box(
    `Total Cost: $245.50 / $500.00\nConsumption Rate: 49.1%\nStatus: ✅ Healthy`,
    {
      title: '💰 Economic Circuit Breaker',
      borderStyle: 'double',
      borderColor: theme.colors.success,
      padding: 1,
    },
  );

  logger.newline();

  // ===== SPINNERS =====
  logger.section('⏳', 'Spinners & Progress');

  const spinner1 = logger.startSpinner('Analyzing issue structure...');
  await sleep(2000);
  logger.stopSpinnerSuccess(spinner1, 'Issue analysis complete (2.3s)');

  const spinner2 = logger.startSpinner('Generating code...');
  await sleep(1500);
  logger.stopSpinnerSuccess(spinner2, 'Code generation complete (1.5s)');

  const spinner3 = logger.startSpinner('Running tests...');
  await sleep(1000);
  logger.stopSpinnerWarn(spinner3, '2 warnings found');

  logger.newline();

  // ===== PROGRESS BARS =====
  logger.section('📊', 'Progress Bars');

  logger.log(`Overall Progress: ${  logger.progressBar(75, 100, 40)}`);
  logger.log(`CodeGenAgent:     ${  logger.progressBar(100, 100, 40)}`);
  logger.log(`ReviewAgent:      ${  logger.progressBar(60, 100, 40)}`);
  logger.log(`TestAgent:        ${  logger.progressBar(30, 100, 40)}`);

  logger.newline();

  // ===== KEY-VALUE PAIRS =====
  logger.section('🔑', 'Key-Value Pairs');

  logger.keyValue('Issue Number', '#123', theme.colors.primary);
  logger.keyValue('Agent', 'CoordinatorAgent', theme.colors.agent);
  logger.keyValue('Status', 'Completed', theme.colors.success);
  logger.keyValue('Duration', '5m 32s', theme.colors.info);
  logger.keyValue('Quality Score', '87/100', theme.colors.warning);

  logger.newline();

  // ===== STATUS INDICATORS =====
  logger.section('🚦', 'Status Indicators');

  logger.status('ESLint passed', 'success');
  logger.status('TypeScript passed', 'success');
  logger.status('Security scan passed', 'success');
  logger.status('Test coverage: 87.5%', 'warning');
  logger.status('Deployment pending', 'pending');

  logger.newline();

  // ===== LISTS & BULLETS =====
  logger.section('📝', 'Lists & Bullets');

  logger.bullet('Task 1: Generate login component');
  logger.bullet('Task 2: Implement JWT auth');
  logger.bullet('Task 3: Write tests');
  logger.indent();
  logger.bullet('Subtask 3.1: Unit tests');
  logger.bullet('Subtask 3.2: Integration tests');
  logger.outdent();

  logger.newline();

  // ===== DIVIDERS =====
  logger.section('➖', 'Dividers');

  logger.divider('light');
  logger.muted('Light divider');
  logger.divider('heavy');
  logger.muted('Heavy divider');
  logger.divider('double');
  logger.muted('Double divider');

  logger.newline();

  // ===== GRADIENT TEXT =====
  logger.section('🌈', 'Gradient Text');

  logger.gradient('Agentic OS — The Future of Development');

  logger.newline();

  // ===== FINAL BOX =====
  // ===== PHASE 2: TABLES =====
  logger.section('📊', 'Phase 2: Tables');

  const agentStatuses: AgentStatus[] = [
    { name: 'CoordinatorAgent', status: 'success', task: 'Analyzed Issue #123', duration: 1500 },
    { name: 'CodeGenAgent', status: 'running', task: 'Generating login component', duration: 3200 },
    { name: 'ReviewAgent', status: 'idle' },
    { name: 'IssueAgent', status: 'success', task: 'Auto-labeled Issue #456', duration: 800 },
    { name: 'PRAgent', status: 'error', task: 'Failed to create PR', duration: 2100 },
    { name: 'DeploymentAgent', status: 'idle' },
  ];
  console.log(createAgentStatusTable(agentStatuses));
  logger.newline();

  const kpiMetrics: KPIMetric[] = [
    { name: 'AI Task Success Rate', current: '97%', target: '95%', status: 'good' },
    { name: 'Average Execution Time', current: '3.2min', target: '5min', status: 'good' },
    { name: 'Human Intervention Rate', current: '8%', target: '5%', status: 'warning' },
    { name: 'Quality Score Average', current: '92/100', target: '85/100', status: 'good' },
    { name: 'Circuit Breaker Triggers', current: '2', target: '0', status: 'bad' },
  ];
  console.log(createKPITable(kpiMetrics));
  logger.newline();

  // ===== PHASE 2: BOXES =====
  logger.section('📦', 'Phase 2: Advanced Boxes');

  console.log(successBox('Task completed successfully!\nAll tests passing.', '✅ Build Success'));
  logger.newline();

  console.log(warningBox('Budget threshold reached: 85%\nConsider reducing API usage.', '⚠️ Budget Alert'));
  logger.newline();

  console.log(agentBox('CoordinatorAgent', 'Analyzing dependencies...\n- Task 1: Parse Issue\n- Task 2: Build DAG\n- Task 3: Assign Agents', { status: 'running' }));
  logger.newline();

  console.log(resultSummaryBox({
    success: 23,
    warning: 2,
    error: 1,
    total: 26,
    duration: 145000,
  }));
  logger.newline();

  // ===== PHASE 2: PROGRESS =====
  logger.section('📈', 'Phase 2: Progress Tracking');

  const progress = new MultiStepProgress([
    { id: '1', label: 'Parse Issue' },
    { id: '2', label: 'Build Dependency Graph' },
    { id: '3', label: 'Assign Tasks to Agents' },
    { id: '4', label: 'Execute Tasks in Parallel' },
    { id: '5', label: 'Create Draft PR' },
  ]);

  progress.startStep('1');
  progress.completeStep('1', 500);
  progress.startStep('2');
  progress.completeStep('2', 1200);
  progress.startStep('3');
  progress.completeStep('3', 800);
  progress.startStep('4');
  progress.completeStep('4', 5200);
  progress.startStep('5');

  console.log(progress.render());
  logger.newline();

  // ===== PHASE 2: TREES =====
  logger.section('🌳', 'Phase 2: Tree Structures');

  const taskTree: TaskNode[] = [
    {
      id: '1',
      title: 'Add user authentication',
      status: 'success',
      agent: 'CoordinatorAgent',
      duration: 8500,
      dependencies: [
        {
          id: '1.1',
          title: 'Create login component',
          status: 'success',
          agent: 'CodeGenAgent',
          duration: 3200,
        },
        {
          id: '1.2',
          title: 'Add JWT middleware',
          status: 'success',
          agent: 'CodeGenAgent',
          duration: 2800,
        },
        {
          id: '1.3',
          title: 'Write tests',
          status: 'running',
          agent: 'CodeGenAgent',
          duration: 1500,
        },
      ],
    },
  ];

  console.log(renderTaskTree(taskTree));
  logger.newline();

  logger.box(
    `✅ Demo Complete!\n\nAll UI components demonstrated successfully.\n\nPhase 1: Core (logger, theme)\nPhase 2: Formatters (table, box, progress, tree)\n\nReady for Phase 3 integration!`,
    {
      title: '🎉 Success',
      borderStyle: 'bold',
      borderColor: theme.colors.success,
      padding: 1,
      align: 'center',
    },
  );

  logger.newline();
  logger.muted('Run with: npm run demo');
  logger.newline();
}

main().catch((error) => {
  logger.error('Demo failed', error);
  process.exit(1);
});
