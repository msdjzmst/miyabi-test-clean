#!/usr/bin/env tsx
/**
 * Claude Code Headless Execution
 *
 * ヘッドレスモードでClaude Codeを実行するスクリプト
 *
 * 特徴:
 * - Anthropic APIを直接使用
 * - MCPツールの統合サポート
 * - オーストークン認証
 * - プログラマティックな実行
 *
 * 使用例:
 * ```bash
 * # 環境変数を設定
 * export ANTHROPIC_API_KEY="your-api-key"
 *
 * # 直接実行
 * npm run claude-headless -- "プロジェクトの概要を教えて"
 *
 * # またはTypeScriptから
 * tsx scripts/tools/claude-headless.ts "プロジェクトの概要を教えて"
 * ```
 */

import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { config as dotenvConfig } from 'dotenv';

// .envファイルを読み込む
dotenvConfig();

// 型定義
interface MCPServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  description?: string;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServer>;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ClaudeHeadlessOptions {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  enableMCP?: boolean;
  mcpServers?: string[];
  systemPrompt?: string;
  verbose?: boolean;
}

/**
 * MCPクライアントマネージャー
 */
class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  /**
   * MCP設定を読み込む
   */
  loadMCPConfig(): MCPConfig | null {
    const configPath = join(process.cwd(), '.claude', 'mcp.json');
    if (!existsSync(configPath)) {
      console.warn(chalk.yellow('⚠️  MCP設定ファイルが見つかりません: .claude/mcp.json'));
      return null;
    }

    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return config;
    } catch (error) {
      console.error(chalk.red('❌ MCP設定の読み込みに失敗:', error));
      return null;
    }
  }

  /**
   * MCPサーバーに接続
   */
  async connectToServer(serverName: string, serverConfig: MCPServer): Promise<void> {
    if (serverConfig.disabled) {
      console.log(chalk.gray(`⏭️  スキップ: ${serverName} (無効化されています)`));
      return;
    }

    const spinner = ora(`接続中: ${serverName}`).start();

    try {
      // 環境変数を展開
      const env = { ...process.env };
      if (serverConfig.env) {
        for (const [key, value] of Object.entries(serverConfig.env)) {
          // ${VAR}形式の環境変数を展開
          env[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] || '');
        }
      }

      // StdioClientTransportを作成
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: env as Record<string, string>,
      });

      // Clientを作成
      const client = new Client(
        {
          name: `claude-headless-${serverName}`,
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      // 接続
      await client.connect(transport);

      // ツールリストを取得
      const toolsResponse = await client.listTools();

      if (toolsResponse.tools && toolsResponse.tools.length > 0) {
        toolsResponse.tools.forEach((tool: any) => {
          const prefixedName = `${serverName}__${tool.name}`;
          this.tools.set(prefixedName, {
            name: prefixedName,
            description: tool.description || '',
            inputSchema: tool.inputSchema || { type: 'object', properties: {} },
          });
        });
      }

      this.clients.set(serverName, client);
      this.transports.set(serverName, transport);

      spinner.succeed(
        chalk.green(`✅ 接続成功: ${serverName} (${toolsResponse.tools?.length || 0}ツール)`),
      );
    } catch (error) {
      spinner.fail(chalk.red(`❌ 接続失敗: ${serverName}`));
      console.error(chalk.red(`  エラー: ${error}`));
    }
  }

  /**
   * すべてのMCPサーバーに接続
   */
  async connectAll(serverNames?: string[]): Promise<void> {
    const config = this.loadMCPConfig();
    if (!config) {
      return;
    }

    console.log(chalk.blue('\n📡 MCPサーバーに接続中...\n'));

    const serversToConnect = serverNames
      ? Object.entries(config.mcpServers).filter(([name]) => serverNames.includes(name))
      : Object.entries(config.mcpServers);

    for (const [name, serverConfig] of serversToConnect) {
      await this.connectToServer(name, serverConfig);
    }

    console.log(chalk.blue(`\n📊 合計 ${this.tools.size} ツールが利用可能\n`));
  }

  /**
   * 利用可能なツールを取得
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * ツールを実行
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const [serverName] = toolName.split('__');
    const client = this.clients.get(serverName);

    if (!client) {
      throw new Error(`MCPサーバー "${serverName}" が見つかりません`);
    }

    const originalToolName = toolName.replace(`${serverName}__`, '');
    const result = await client.callTool({
      name: originalToolName,
      arguments: args,
    });

    return result;
  }

  /**
   * すべての接続を閉じる
   */
  async closeAll(): Promise<void> {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
        console.log(chalk.gray(`🔌 切断: ${name}`));
      } catch (error) {
        console.error(chalk.red(`切断エラー (${name}):`, error));
      }
    }
    this.clients.clear();
    this.transports.clear();
    this.tools.clear();
  }
}

/**
 * Claude Code ヘッドレス実行
 */
class ClaudeHeadless {
  private anthropic: Anthropic;
  private mcpManager: MCPClientManager;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        'ANTHROPIC_API_KEY環境変数が設定されていません。' +
        '\n\n以下のいずれかの方法で設定してください:' +
        '\n1. export ANTHROPIC_API_KEY="your-key"' +
        '\n2. new ClaudeHeadless("your-key")',
      );
    }

    this.anthropic = new Anthropic({ apiKey: key });
    this.mcpManager = new MCPClientManager();
  }

  /**
   * MCPサーバーに接続
   */
  async connectMCP(serverNames?: string[]): Promise<void> {
    await this.mcpManager.connectAll(serverNames);
  }

  /**
   * Claude APIを呼び出し
   */
  async execute(options: ClaudeHeadlessOptions): Promise<string> {
    const {
      prompt,
      model = 'claude-sonnet-4-20250514',
      maxTokens = 4096,
      temperature = 1.0,
      enableMCP = true,
      mcpServers,
      systemPrompt,
      verbose = false,
    } = options;

    // MCPツールを有効化
    let tools: Anthropic.Tool[] | undefined;
    if (enableMCP) {
      if (this.mcpManager.getTools().length === 0) {
        await this.connectMCP(mcpServers);
      }

      const mcpTools = this.mcpManager.getTools();
      if (mcpTools.length > 0) {
        tools = mcpTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
        }));

        if (verbose && tools) {
          console.log(chalk.blue(`\n🛠️  利用可能なツール (${tools.length}個):`));
          tools.forEach((tool) => {
            console.log(chalk.gray(`  - ${tool.name}: ${tool.description}`));
          });
          console.log('');
        }
      }
    }

    // システムプロンプトを構築
    const systemMessages: Anthropic.TextBlockParam[] = [];
    if (systemPrompt) {
      systemMessages.push({
        type: 'text',
        text: systemPrompt,
      });
    }

    // CLAUDE.mdを読み込む
    const claudeMdPath = join(process.cwd(), 'CLAUDE.md');
    if (existsSync(claudeMdPath)) {
      const claudeMd = readFileSync(claudeMdPath, 'utf-8');
      systemMessages.push({
        type: 'text',
        text: `以下はプロジェクトの設定ファイルです:\n\n${claudeMd}`,
      });
    }

    if (verbose) {
      console.log(chalk.blue('🤖 Claude APIを呼び出し中...\n'));
      console.log(chalk.gray(`Model: ${model}`));
      console.log(chalk.gray(`Max Tokens: ${maxTokens}`));
      console.log(chalk.gray(`Temperature: ${temperature}`));
      console.log(chalk.gray(`Tools: ${tools ? tools.length : 0}`));
      console.log('');
    }

    const spinner = ora('Claude実行中...').start();

    try {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMessages.length > 0 ? systemMessages : undefined,
        tools,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      spinner.succeed(chalk.green('✅ 実行完了'));

      // レスポンスを処理
      let resultText = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          resultText += block.text;
        } else if (block.type === 'tool_use') {
          if (verbose) {
            console.log(chalk.yellow(`\n🔧 ツール呼び出し: ${block.name}`));
            console.log(chalk.gray(JSON.stringify(block.input, null, 2)));
          }

          try {
            const toolResult = await this.mcpManager.callTool(block.name, block.input as Record<string, unknown>);
            if (verbose) {
              console.log(chalk.green('✅ ツール実行成功'));
              console.log(chalk.gray(JSON.stringify(toolResult, null, 2)));
            }
          } catch (error) {
            console.error(chalk.red(`❌ ツール実行失敗: ${error}`));
          }
        }
      }

      return resultText;
    } catch (error) {
      spinner.fail(chalk.red('❌ 実行失敗'));
      throw error;
    }
  }

  /**
   * MCPサーバーとの接続を閉じる
   */
  async close(): Promise<void> {
    await this.mcpManager.closeAll();
  }
}

/**
 * メイン実行
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(chalk.blue('\n📖 Claude Code Headless Mode\n'));
    console.log('使用方法:');
    console.log('  tsx scripts/tools/claude-headless.ts <prompt> [options]\n');
    console.log('オプション:');
    console.log('  --model <model>          モデル名 (デフォルト: claude-sonnet-4-20250514)');
    console.log('  --max-tokens <number>    最大トークン数 (デフォルト: 4096)');
    console.log('  --temperature <number>   温度パラメータ (デフォルト: 1.0)');
    console.log('  --no-mcp                 MCPツールを無効化');
    console.log('  --mcp-servers <names>    使用するMCPサーバー (カンマ区切り)');
    console.log('  --system <prompt>        システムプロンプト');
    console.log('  --verbose, -v            詳細ログを表示');
    console.log('  --help, -h               このヘルプを表示\n');
    console.log('例:');
    console.log('  tsx scripts/tools/claude-headless.ts "プロジェクトの概要を教えて"');
    console.log('  tsx scripts/tools/claude-headless.ts "GitHub Issueを作成" --mcp-servers github-enhanced');
    console.log('  tsx scripts/tools/claude-headless.ts "コードをレビュー" --verbose\n');
    process.exit(0);
  }

  // 引数をパース
  const prompt = args[0];
  const options: ClaudeHeadlessOptions = {
    prompt,
    verbose: args.includes('--verbose') || args.includes('-v'),
    enableMCP: !args.includes('--no-mcp'),
  };

  // モデル
  const modelIndex = args.indexOf('--model');
  if (modelIndex !== -1 && args[modelIndex + 1]) {
    options.model = args[modelIndex + 1];
  }

  // 最大トークン数
  const maxTokensIndex = args.indexOf('--max-tokens');
  if (maxTokensIndex !== -1 && args[maxTokensIndex + 1]) {
    options.maxTokens = parseInt(args[maxTokensIndex + 1], 10);
  }

  // 温度
  const temperatureIndex = args.indexOf('--temperature');
  if (temperatureIndex !== -1 && args[temperatureIndex + 1]) {
    options.temperature = parseFloat(args[temperatureIndex + 1]);
  }

  // MCPサーバー
  const mcpServersIndex = args.indexOf('--mcp-servers');
  if (mcpServersIndex !== -1 && args[mcpServersIndex + 1]) {
    options.mcpServers = args[mcpServersIndex + 1].split(',');
  }

  // システムプロンプト
  const systemIndex = args.indexOf('--system');
  if (systemIndex !== -1 && args[systemIndex + 1]) {
    options.systemPrompt = args[systemIndex + 1];
  }

  console.log(chalk.bold.blue('\n🚀 Claude Code Headless Mode\n'));

  const client = new ClaudeHeadless();

  try {
    const result = await client.execute(options);

    console.log(chalk.bold.green('\n📝 結果:\n'));
    console.log(result);
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n❌ エラーが発生しました:\n'));
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// スクリプトとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// エクスポート
export { ClaudeHeadless, MCPClientManager };
export type { ClaudeHeadlessOptions, MCPTool, MCPServer, MCPConfig };
