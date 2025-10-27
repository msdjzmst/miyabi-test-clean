/**
 * Generate Session Entity-Relation Graph
 *
 * 現在のClaude Codeセッション活動をEntity-Relationグラフとして生成
 */

import type {
  EntityRelationGraph,
  IssueNode,
  TaskNode,
  AgentNode,
  CommandNode,
  LabelNode,
  DiscordCommunityNode,
  EntityEdge,
  SessionActivity,
  ToolInvocation,
} from '@miyabi/coding-agents/types/entity-relation-graph';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * セッション情報（手動入力または環境変数から取得）
 */
interface SessionConfig {
  sessionId: string;
  issueNumber: number;
  issueTitle: string;
  branchName: string;
  deviceIdentifier: string;
  tasks: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed';
    files?: string[];
  }>;
  toolInvocations: ToolInvocation[];
  comments: string[];
}

/**
 * デフォルトセッション設定（Issue #52 Discord community setup）
 */
const DEFAULT_SESSION: SessionConfig = {
  sessionId: randomUUID(),
  issueNumber: 52,
  issueTitle: 'Create Discord server and launch community',
  branchName: 'feat/discord-community-setup-issue-52',
  deviceIdentifier: process.env.DEVICE_IDENTIFIER || 'MacBook',
  tasks: [
    {
      id: 'task-52-1',
      title: 'Create MEE6 Bot Setup Guide',
      status: 'completed',
      files: ['docs/discord/BOT_SETUP_MEE6.md'],
    },
    {
      id: 'task-52-2',
      title: 'Create GitHub Bot Setup Guide',
      status: 'completed',
      files: ['docs/discord/BOT_SETUP_GITHUB.md'],
    },
    {
      id: 'task-52-3',
      title: 'Create Custom Miyabi Bot Specification',
      status: 'completed',
      files: ['docs/discord/BOT_CUSTOM_MIYABI.md'],
    },
    {
      id: 'task-52-4',
      title: 'Create Discord Server Navigation Guide',
      status: 'completed',
      files: ['docs/discord/SERVER_GUIDE.md'],
    },
    {
      id: 'task-52-5',
      title: 'Create Welcome Message Template',
      status: 'completed',
      files: ['docs/discord/WELCOME_MESSAGE.md'],
    },
    {
      id: 'task-52-6',
      title: 'Create Launch Announcement Templates',
      status: 'completed',
      files: ['docs/discord/LAUNCH_ANNOUNCEMENT.md'],
    },
  ],
  toolInvocations: [
    {
      toolName: 'Read',
      parameters: { file_path: 'CLAUDE.md' },
      timestamp: new Date().toISOString(),
      status: 'success',
      output: 'Read project context',
    },
    {
      toolName: 'Read',
      parameters: { file_path: 'docs/DISCORD_COMMUNITY_PLAN.md' },
      timestamp: new Date().toISOString(),
      status: 'success',
      output: 'Read community plan',
    },
    {
      toolName: 'Glob',
      parameters: { pattern: '**/*dashboard*.{html,ts,js}' },
      timestamp: new Date().toISOString(),
      status: 'success',
      output: 'Found dashboard files',
    },
    {
      toolName: 'Bash',
      parameters: { command: 'git status' },
      timestamp: new Date().toISOString(),
      status: 'success',
      output: '6 new files staged',
    },
  ],
  comments: [
    'User requested: "全力モードで2時間分タスク作ってやっておいて"',
    'Assistant: Created 6 comprehensive Discord community documentation files',
    'User requested: "ターミナル上でやっているコメント、タスク、Toolのアップデートをダッシュボードのグラフに表示してほしい"',
    'Assistant: Creating Entity-Relation graph visualization',
  ],
};

/**
 * グラフデータ生成
 */
function generateGraph(config: SessionConfig): EntityRelationGraph {
  const timestamp = new Date().toISOString();

  // ===== ノード生成 =====

  // E1: Issue ノード
  const issueNode: IssueNode = {
    id: `issue-${config.issueNumber}`,
    type: 'Issue',
    label: `Issue #${config.issueNumber}`,
    issueNumber: config.issueNumber,
    title: config.issueTitle,
    url: `https://github.com/ShunsukeHayashi/Miyabi/issues/${config.issueNumber}`,
    state: 'open',
    labels: ['type:docs', 'priority:P2-High', 'state:implementing', 'phase:planning'],
    metadata: {
      branchName: config.branchName,
    },
    status: 'in_progress',
    timestamp,
  };

  // E2: Task ノード（各タスク）
  const taskNodes: TaskNode[] = config.tasks.map((task) => ({
    id: task.id,
    type: 'Task',
    label: task.title,
    taskId: task.id,
    title: task.title,
    taskType: 'docs',
    assignedAgent: 'DocsAgent',
    dependencies: [],
    metadata: {
      files: task.files || [],
    },
    status: task.status,
    timestamp,
  }));

  // E3: Agent ノード（DocsAgent）
  const agentNode: AgentNode = {
    id: 'agent-docs',
    type: 'Agent',
    label: 'DocsAgent',
    agentName: 'DocsAgent',
    agentType: 'DocsAgent',
    authority: '🔵実行権限',
    tasksExecuted: config.tasks.length,
    metadata: {
      modelUsed: 'Claude Sonnet 4.5',
      sessionId: config.sessionId,
    },
    status: 'in_progress',
    timestamp,
  };

  // E7: Command/Tool ノード
  const commandNodes: CommandNode[] = config.toolInvocations.map((tool, index) => ({
    id: `tool-${tool.toolName.toLowerCase()}-${index}`,
    type: 'Command',
    label: tool.toolName,
    commandName: tool.toolName,
    invocationType: 'tool',
    executionCount: 1,
    metadata: {
      parameters: tool.parameters,
      output: tool.output,
    },
    status: tool.status === 'success' ? 'completed' : 'failed',
    timestamp: tool.timestamp,
  }));

  // E5: Label ノード
  const labelNodes: LabelNode[] = [
    {
      id: 'label-type-docs',
      type: 'Label',
      label: '📚 type:docs',
      labelName: 'type:docs',
      category: 'TYPE',
      color: '#0366d6',
      metadata: {},
      timestamp,
    },
    {
      id: 'label-state-implementing',
      type: 'Label',
      label: '🏗️ state:implementing',
      labelName: 'state:implementing',
      category: 'STATE',
      color: '#fbca04',
      metadata: {},
      timestamp,
    },
    {
      id: 'label-priority-p2',
      type: 'Label',
      label: '🔶 priority:P2-High',
      labelName: 'priority:P2-High',
      category: 'PRIORITY',
      color: '#d73a4a',
      metadata: {},
      timestamp,
    },
  ];

  // E13: DiscordCommunity ノード
  const discordNode: DiscordCommunityNode = {
    id: 'discord-miyabi-community',
    type: 'DiscordCommunity',
    label: 'Miyabi Community',
    serverName: 'Miyabi Community',
    serverId: undefined, // 未作成
    memberCount: 0,
    metadata: {
      planDocument: 'docs/DISCORD_COMMUNITY_PLAN.md',
      setupStatus: 'documentation_phase',
    },
    status: 'pending',
    timestamp,
  };

  // すべてのノード
  const nodes = [
    issueNode,
    ...taskNodes,
    agentNode,
    ...commandNodes,
    ...labelNodes,
    discordNode,
  ];

  // ===== エッジ生成 =====

  const edges: EntityEdge[] = [];

  // R1: Issue --analyzed-by-→ Agent
  edges.push({
    id: `edge-${issueNode.id}-to-${agentNode.id}`,
    source: issueNode.id,
    target: agentNode.id,
    relationType: 'analyzed-by',
    label: 'analyzed by',
    timestamp,
  });

  // R2: Issue --decomposed-into-→ Task
  taskNodes.forEach((task) => {
    edges.push({
      id: `edge-${issueNode.id}-to-${task.id}`,
      source: issueNode.id,
      target: task.id,
      relationType: 'decomposed-into',
      label: 'decomposed into',
      timestamp,
    });
  });

  // R3: Issue --tagged-with-→ Label
  labelNodes.forEach((label) => {
    edges.push({
      id: `edge-${issueNode.id}-to-${label.id}`,
      source: issueNode.id,
      target: label.id,
      relationType: 'tagged-with',
      label: 'tagged with',
      timestamp,
    });
  });

  // R9: Agent --executes-→ Task
  taskNodes.forEach((task) => {
    edges.push({
      id: `edge-${agentNode.id}-to-${task.id}`,
      source: agentNode.id,
      target: task.id,
      relationType: 'executes',
      label: 'executes',
      timestamp,
    });
  });

  // R15: Tool --invoked-by-→ Agent
  commandNodes.forEach((tool) => {
    edges.push({
      id: `edge-${tool.id}-to-${agentNode.id}`,
      source: tool.id,
      target: agentNode.id,
      relationType: 'invoked-by',
      label: 'invoked by',
      timestamp,
    });
  });

  // R28: Issue --notifies-to-→ DiscordCommunity
  edges.push({
    id: `edge-${issueNode.id}-to-${discordNode.id}`,
    source: issueNode.id,
    target: discordNode.id,
    relationType: 'notifies-to',
    label: 'notifies to',
    metadata: {
      channels: ['#announcements', '#dev-general'],
    },
    timestamp,
  });

  // グラフ構築
  const graph: EntityRelationGraph = {
    sessionId: config.sessionId,
    timestamp,
    nodes,
    edges,
    metadata: {
      source: 'claude-code-session',
      issueNumber: config.issueNumber,
      branchName: config.branchName,
      deviceIdentifier: config.deviceIdentifier,
    },
  };

  return graph;
}

/**
 * セッション活動ログ生成
 */
function generateSessionActivity(config: SessionConfig): SessionActivity {
  const graph = generateGraph(config);

  const activity: SessionActivity = {
    sessionId: config.sessionId,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    issue: {
      number: config.issueNumber,
      title: config.issueTitle,
    },
    tasks: config.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
    })),
    toolInvocations: config.toolInvocations,
    comments: config.comments,
    graph,
  };

  return activity;
}

/**
 * メイン実行
 */
async function main() {
  console.log('📊 Generating session Entity-Relation graph...\n');

  // セッション活動生成
  const activity = generateSessionActivity(DEFAULT_SESSION);

  // 出力先ディレクトリ
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // JSON出力
  const outputPath = path.join(docsDir, 'session-graph.json');
  fs.writeFileSync(outputPath, JSON.stringify(activity, null, 2));

  console.log(`✅ Session graph generated: ${outputPath}\n`);

  // サマリ表示
  console.log('📊 Graph Summary:');
  console.log(`  Session ID: ${activity.sessionId}`);
  console.log(`  Issue: #${activity.issue?.number} - ${activity.issue?.title}`);
  console.log(`  Tasks: ${activity.tasks.length}`);
  console.log(`  Tool Invocations: ${activity.toolInvocations.length}`);
  console.log(`  Nodes: ${activity.graph.nodes.length}`);
  console.log(`  Edges: ${activity.graph.edges.length}`);
  console.log('\n📈 Node Breakdown:');
  const nodeCountByType = activity.graph.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(nodeCountByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\n🔗 Edge Breakdown:');
  const edgeCountByType = activity.graph.edges.reduce((acc, edge) => {
    acc[edge.relationType] = (acc[edge.relationType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(edgeCountByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\n✨ Graph data ready for dashboard visualization!');
}

main().catch((error) => {
  console.error('Error generating session graph:', error);
  process.exit(1);
});
