/**
 * Entity-Relation Graph Types
 *
 * ダッシュボード可視化用のEntity-Relationグラフデータ構造
 */

// ===== ノード型定義 =====

/**
 * 基底ノードインターフェース
 */
export interface BaseNode {
  id: string;                    // ユニークID
  type: EntityType;              // Entity種別
  label: string;                 // 表示名
  metadata: Record<string, any>; // 追加メタデータ
  status?: NodeStatus;           // ノードステータス
  timestamp: string;             // 作成/更新日時
}

/**
 * Entity種別（E1-E13）
 */
export type EntityType =
  | 'Issue'               // E1: GitHub Issue
  | 'Task'                // E2: 分解されたタスク
  | 'Agent'               // E3: 自律実行Agent
  | 'PR'                  // E4: Pull Request
  | 'Label'               // E5: GitHub Label
  | 'QualityReport'       // E6: 品質レポート
  | 'Command'             // E7: Claude Codeコマンド/Tool
  | 'Escalation'          // E8: エスカレーション
  | 'Deployment'          // E9: デプロイ情報
  | 'LDDLog'              // E10: LDDログ
  | 'DAG'                 // E11: タスク依存グラフ
  | 'Worktree'            // E12: Git Worktree
  | 'DiscordCommunity';   // E13: Discordコミュニティ

/**
 * ノードステータス
 */
export type NodeStatus =
  | 'pending'       // 待機中
  | 'in_progress'   // 実行中
  | 'completed'     // 完了
  | 'failed'        // 失敗
  | 'blocked';      // ブロック中

/**
 * Issue ノード
 */
export interface IssueNode extends BaseNode {
  type: 'Issue';
  issueNumber: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  labels: string[];
}

/**
 * Task ノード
 */
export interface TaskNode extends BaseNode {
  type: 'Task';
  taskId: string;
  title: string;
  taskType: 'feature' | 'bug' | 'refactor' | 'docs' | 'test' | 'deployment';
  assignedAgent?: string; // Agent名
  dependencies: string[]; // 依存TaskID
  estimatedDuration?: number; // 推定時間（分）
}

/**
 * Agent ノード
 */
export interface AgentNode extends BaseNode {
  type: 'Agent';
  agentName: string;
  agentType: 'CoordinatorAgent' | 'CodeGenAgent' | 'ReviewAgent' | 'IssueAgent' | 'PRAgent' | 'DeploymentAgent' | 'DocsAgent';
  authority: '🔴統括権限' | '🔵実行権限' | '🟢分析権限';
  tasksExecuted: number;
}

/**
 * Command/Tool ノード
 */
export interface CommandNode extends BaseNode {
  type: 'Command';
  commandName: string;
  invocationType: 'slash-command' | 'tool' | 'manual';
  executionCount: number;
}

/**
 * Label ノード
 */
export interface LabelNode extends BaseNode {
  type: 'Label';
  labelName: string;
  category: 'STATE' | 'AGENT' | 'PRIORITY' | 'TYPE' | 'SEVERITY' | 'PHASE' | 'SPECIAL' | 'TRIGGER' | 'QUALITY' | 'COMMUNITY';
  color: string;
}

/**
 * DiscordCommunity ノード
 */
export interface DiscordCommunityNode extends BaseNode {
  type: 'DiscordCommunity';
  serverId?: string;
  serverName: string;
  memberCount?: number;
}

/**
 * すべてのノード型のユニオン
 */
export type EntityNode =
  | IssueNode
  | TaskNode
  | AgentNode
  | CommandNode
  | LabelNode
  | DiscordCommunityNode;

// ===== エッジ型定義 =====

/**
 * エッジ（関係性）
 */
export interface EntityEdge {
  id: string;                    // エッジID
  source: string;                // 始点ノードID
  target: string;                // 終点ノードID
  relationType: RelationType;    // 関係性種別（R1-R35）
  label: string;                 // 関係性ラベル（表示用）
  metadata?: Record<string, any>; // 追加メタデータ
  timestamp: string;             // 作成日時
}

/**
 * 関係性種別（R1-R35）
 */
export type RelationType =
  // Issue関連 (R1-R4)
  | 'analyzed-by'            // R1: Issue --analyzed-by-→ Agent
  | 'decomposed-into'        // R2: Issue --decomposed-into-→ Task
  | 'tagged-with'            // R3: Issue --tagged-with-→ Label
  | 'creates'                // R4: Issue --creates-→ PR

  // Task関連 (R5-R8)
  | 'assigned-to'            // R5: Task --assigned-to-→ Agent
  | 'depends-on'             // R6: Task --depends-on-→ Task
  | 'part-of'                // R7: Task --part-of-→ DAG
  | 'runs-in'                // R8: Task --runs-in-→ Worktree

  // Agent関連 (R9-R15)
  | 'executes'               // R9: Agent --executes-→ Task
  | 'generates'              // R10: Agent --generates-→ PR
  | 'creates-report'         // R11: Agent --creates-→ QualityReport
  | 'triggers-escalation'    // R12: Agent --triggers-→ Escalation
  | 'performs'               // R13: Agent --performs-→ Deployment
  | 'logs-to'                // R14: Agent --logs-to-→ LDDLog
  | 'invoked-by'             // R15: Command --invoked-by-→ Agent

  // Label関連 (R16-R18)
  | 'triggers'               // R16: Label --triggers-→ Agent
  | 'defines-state'          // R17: Label --defines-state-→ Issue
  | 'categorizes'            // R18: Label --categorizes-→ Task

  // PR関連 (R19-R21)
  | 'reviewed-by'            // R19: PR --reviewed-by-→ Agent
  | 'has'                    // R20: PR --has-→ QualityReport
  | 'attached-to'            // R21: PR --attached-to-→ Issue

  // その他 (R22-R35)
  | 'evaluated-by'           // R22: QualityReport --evaluated-by-→ Agent
  | 'notifies-to'            // R28-R34: X --notifies-to-→ DiscordCommunity
  | 'integrated-with';       // R35: Command --integrated-with-→ DiscordCommunity

// ===== グラフ全体構造 =====

/**
 * Entity-Relationグラフ
 */
export interface EntityRelationGraph {
  sessionId: string;             // セッションID
  timestamp: string;             // グラフ生成日時
  nodes: EntityNode[];           // すべてのノード
  edges: EntityEdge[];           // すべてのエッジ
  metadata: {
    source: string;              // データソース（例: "claude-code-session"）
    issueNumber?: number;        // 関連Issue番号
    branchName?: string;         // ブランチ名
    deviceIdentifier?: string;   // デバイス識別子
  };
}

// ===== セッション活動ログ =====

/**
 * Tool呼び出しログ
 */
export interface ToolInvocation {
  toolName: string;              // Tool名（Read, Glob, Bash, etc.）
  parameters: Record<string, any>; // パラメータ
  timestamp: string;             // 実行日時
  status: 'success' | 'failure'; // ステータス
  output?: string;               // 出力（サマリ）
}

/**
 * セッション活動ログ
 */
export interface SessionActivity {
  sessionId: string;
  startTime: string;
  endTime?: string;
  issue?: {
    number: number;
    title: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    status: NodeStatus;
  }>;
  toolInvocations: ToolInvocation[];
  comments: string[];            // ユーザー/Assistantコメント
  graph: EntityRelationGraph;    // グラフデータ
}

// ===== ユーティリティ型 =====

/**
 * ノードフィルタ条件
 */
export interface NodeFilter {
  types?: EntityType[];
  statuses?: NodeStatus[];
  labels?: string[];
}

/**
 * エッジフィルタ条件
 */
export interface EdgeFilter {
  relationTypes?: RelationType[];
  sourceTypes?: EntityType[];
  targetTypes?: EntityType[];
}

/**
 * グラフクエリ結果
 */
export interface GraphQueryResult {
  nodes: EntityNode[];
  edges: EntityEdge[];
  count: {
    nodes: number;
    edges: number;
  };
}
