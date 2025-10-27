#!/usr/bin/env node

/**
 * Gemini Image & TTS Generation MCP Server
 *
 * Claude Code内でGemini 2.5 Flash Image/TTSを直接実行できるMCPサーバー
 *
 * 提供ツール:
 * - gemini__generate_image - テキストから画像生成
 * - gemini__generate_images_batch - 複数画像を一括生成（note.com記事用）
 * - gemini__generate_speech - テキストから音声生成（TTS）
 * - gemini__generate_speeches_batch - 複数音声を一括生成
 * - gemini__check_api_key - Google API Keyの設定確認
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { config } from 'dotenv';

// Load .env file from project root
config({ path: join(process.cwd(), '.env') });

const server = new Server(
  {
    name: 'gemini-media-generation',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Execute image generation command
 */
function generateImage(prompt, options = {}) {
  try {
    const cwd = options.cwd || process.cwd();

    // Build command
    let cmd = `npm run generate-image -- "${prompt}"`;

    if (options.output) {
      // Ensure output directory exists
      const outputDir = dirname(join(cwd, options.output));
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      cmd += ` --output=${options.output}`;
    }

    if (options.aspectRatio) {
      cmd += ` --aspect-ratio=${options.aspectRatio}`;
    }

    if (options.apiKey) {
      cmd += ` --api-key=${options.apiKey}`;
    }

    // Execute
    const result = execSync(cmd, {
      encoding: 'utf-8',
      cwd,
      maxBuffer: 50 * 1024 * 1024, // 50MB for image data
      timeout: 120000, // 2 minutes timeout
      env: {
        ...process.env,
        GOOGLE_API_KEY: options.apiKey || process.env.GOOGLE_API_KEY,
      },
    });

    return {
      success: true,
      output: result,
      prompt,
      aspectRatio: options.aspectRatio || '1:1',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString() || '',
      stdout: error.stdout?.toString() || '',
      prompt,
    };
  }
}

/**
 * Check if Google API Key is configured
 */
function checkApiKey() {
  const apiKey = process.env.GOOGLE_API_KEY;

  return {
    configured: !!apiKey,
    apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : null,
    howToSetup: !apiKey
      ? 'To set up Google API Key:\n1. Visit https://aistudio.google.com/apikey\n2. Create API Key\n3. Set environment variable: export GOOGLE_API_KEY=your_api_key_here'
      : null,
  };
}

/**
 * Generate multiple images in batch
 */
function generateImagesBatch(prompts, options = {}) {
  const results = [];
  const cwd = options.cwd || process.cwd();

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const outputPath = options.outputPattern
      ? options.outputPattern.replace('{index}', i + 1)
      : `./assets/generated-images/image-${i + 1}.png`;

    console.error(`Generating image ${i + 1}/${prompts.length}: ${prompt.substring(0, 50)}...`);

    const result = generateImage(prompt, {
      ...options,
      output: outputPath,
      cwd,
    });

    results.push({
      index: i + 1,
      prompt,
      outputPath,
      ...result,
    });

    // Small delay between requests to avoid rate limiting
    if (i < prompts.length - 1) {
      execSync('sleep 2');
    }
  }

  return results;
}

/**
 * Execute speech generation command
 */
function generateSpeech(text, options = {}) {
  try {
    const cwd = options.cwd || process.cwd();

    // Build command
    let cmd = `npm run generate-speech -- "${text}"`;

    if (options.output) {
      // Ensure output directory exists
      const outputDir = dirname(join(cwd, options.output));
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      cmd += ` --output=${options.output}`;
    }

    if (options.voice) {
      cmd += ` --voice=${options.voice}`;
    }

    if (options.apiKey) {
      cmd += ` --api-key=${options.apiKey}`;
    }

    // Execute
    const result = execSync(cmd, {
      encoding: 'utf-8',
      cwd,
      maxBuffer: 50 * 1024 * 1024, // 50MB for audio data
      timeout: 120000, // 2 minutes timeout
      env: {
        ...process.env,
        GOOGLE_API_KEY: options.apiKey || process.env.GOOGLE_API_KEY,
      },
    });

    return {
      success: true,
      output: result,
      text,
      voice: options.voice || 'Kore',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString() || '',
      stdout: error.stdout?.toString() || '',
      text,
    };
  }
}

/**
 * Generate multiple speeches in batch
 */
function generateSpeechesBatch(texts, options = {}) {
  const results = [];
  const cwd = options.cwd || process.cwd();

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const outputPath = options.outputPattern
      ? options.outputPattern.replace('{index}', i + 1)
      : `./assets/generated-audio/speech-${i + 1}.wav`;

    console.error(`Generating speech ${i + 1}/${texts.length}: ${text.substring(0, 50)}...`);

    const result = generateSpeech(text, {
      ...options,
      output: outputPath,
      cwd,
    });

    results.push({
      index: i + 1,
      text,
      outputPath,
      ...result,
    });

    // Small delay between requests to avoid rate limiting
    if (i < texts.length - 1) {
      execSync('sleep 2');
    }
  }

  return results;
}

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'gemini__generate_image',
        description: 'Gemini 2.5 Flash Imageを使用してテキストから画像を生成します。日本語プロンプト対応、自動リトライ機能付き。note.com記事用の画像生成に最適です。',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: '画像生成プロンプト（日本語・英語対応）。詳細に記述するほど高品質な画像が生成されます。',
            },
            output: {
              type: 'string',
              description: '出力ファイルパス（例: ./assets/my-image.png）。省略時は自動生成されたパスに保存されます。',
            },
            aspectRatio: {
              type: 'string',
              enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
              description: 'アスペクト比。note.com記事用には16:9推奨。',
              default: '1:1',
            },
            apiKey: {
              type: 'string',
              description: 'Google API Key（オプション）。環境変数GOOGLE_API_KEYでも設定可能。',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'gemini__generate_images_batch',
        description: '複数の画像を一括生成します。note.com記事用に複数の挿絵を生成する場合に便利です。自動的に2秒間隔でリクエストを送信し、レート制限を回避します。',
        inputSchema: {
          type: 'object',
          properties: {
            prompts: {
              type: 'array',
              items: { type: 'string' },
              description: '画像生成プロンプトの配列。各プロンプトから1枚ずつ画像が生成されます。',
            },
            outputPattern: {
              type: 'string',
              description: '出力ファイルパスのパターン。{index}が連番に置き換えられます（例: ./assets/note-article-{index}.png）',
              default: './assets/generated-images/image-{index}.png',
            },
            aspectRatio: {
              type: 'string',
              enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
              description: 'すべての画像に適用するアスペクト比',
              default: '16:9',
            },
            apiKey: {
              type: 'string',
              description: 'Google API Key（オプション）',
            },
          },
          required: ['prompts'],
        },
      },
      {
        name: 'gemini__generate_speech',
        description: 'Gemini 2.5 Flash TTSを使用してテキストから音声を生成します。日本語・英語対応、自動リトライ機能付き。note.com記事用の音声生成に最適です。',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: '音声化するテキスト（日本語・英語対応）。',
            },
            output: {
              type: 'string',
              description: '出力ファイルパス（例: ./assets/my-speech.wav）。省略時は自動生成されたパスに保存されます。',
            },
            voice: {
              type: 'string',
              enum: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'],
              description: '音声名（Puck, Charon, Kore, Fenrir, Aoede）。デフォルト: Kore',
              default: 'Kore',
            },
            apiKey: {
              type: 'string',
              description: 'Google API Key（オプション）。環境変数GOOGLE_API_KEYでも設定可能。',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'gemini__generate_speeches_batch',
        description: '複数の音声を一括生成します。note.com記事用に複数の音声を生成する場合に便利です。自動的に2秒間隔でリクエストを送信し、レート制限を回避します。',
        inputSchema: {
          type: 'object',
          properties: {
            texts: {
              type: 'array',
              items: { type: 'string' },
              description: '音声化するテキストの配列。各テキストから1つずつ音声が生成されます。',
            },
            outputPattern: {
              type: 'string',
              description: '出力ファイルパスのパターン。{index}が連番に置き換えられます（例: ./assets/note-article-{index}.wav）',
              default: './assets/generated-audio/speech-{index}.wav',
            },
            voice: {
              type: 'string',
              enum: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'],
              description: 'すべての音声に適用する音声名',
              default: 'Kore',
            },
            apiKey: {
              type: 'string',
              description: 'Google API Key（オプション）',
            },
          },
          required: ['texts'],
        },
      },
      {
        name: 'gemini__check_api_key',
        description: 'Google API Keyが正しく設定されているかを確認します。設定方法の案内も表示します。',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'gemini__generate_image': {
        const { prompt, output, aspectRatio, apiKey } = args;

        const result = generateImage(prompt, {
          output,
          aspectRatio,
          apiKey,
        });

        if (result.success) {
          const outputPath = result.output.match(/画像が生成されました: (.+)/)?.[1] || 'Unknown path';

          return {
            content: [
              {
                type: 'text',
                text: `✅ 画像生成成功\n\n**プロンプト**: ${result.prompt}\n**アスペクト比**: ${result.aspectRatio}\n**出力先**: ${outputPath}\n\n${result.output}`,
              },
            ],
          };
        } else {
          let errorText = `❌ 画像生成失敗\n\n**プロンプト**: ${result.prompt}\n\n`;

          if (result.error.includes('GOOGLE_API_KEY')) {
            errorText += `**エラー**: Google API Keyが設定されていません\n\n`;
            errorText += `**設定方法**:\n`;
            errorText += `1. https://aistudio.google.com/apikey にアクセス\n`;
            errorText += `2. API Keyを作成\n`;
            errorText += `3. 環境変数に設定:\n`;
            errorText += `   \`\`\`bash\n   export GOOGLE_API_KEY=your_api_key_here\n   \`\`\`\n`;
          } else {
            errorText += `**エラー**: ${result.error}\n\n`;
            errorText += `**詳細**:\n${result.stderr || result.stdout}\n`;
          }

          return {
            content: [
              {
                type: 'text',
                text: errorText,
              },
            ],
            isError: true,
          };
        }
      }

      case 'gemini__generate_images_batch': {
        const { prompts, outputPattern, aspectRatio, apiKey } = args;

        if (!prompts || prompts.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ エラー: プロンプトが指定されていません',
              },
            ],
            isError: true,
          };
        }

        const results = generateImagesBatch(prompts, {
          outputPattern,
          aspectRatio,
          apiKey,
        });

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        let text = `📊 バッチ画像生成完了\n\n`;
        text += `**成功**: ${successCount}/${results.length}枚\n`;
        text += `**失敗**: ${failedCount}/${results.length}枚\n\n`;
        text += `---\n\n`;

        for (const result of results) {
          if (result.success) {
            const outputPath = result.output.match(/画像が生成されました: (.+)/)?.[1] || result.outputPath;
            text += `✅ **画像 ${result.index}** 生成成功\n`;
            text += `   - プロンプト: ${result.prompt.substring(0, 60)}...\n`;
            text += `   - 出力先: ${outputPath}\n\n`;
          } else {
            text += `❌ **画像 ${result.index}** 生成失敗\n`;
            text += `   - プロンプト: ${result.prompt.substring(0, 60)}...\n`;
            text += `   - エラー: ${result.error}\n\n`;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
          isError: failedCount > 0,
        };
      }

      case 'gemini__generate_speech': {
        const { text, output, voice, apiKey } = args;

        const result = generateSpeech(text, {
          output,
          voice,
          apiKey,
        });

        if (result.success) {
          const outputPath = result.output.match(/音声が生成されました: (.+)/)?.[1] || 'Unknown path';

          return {
            content: [
              {
                type: 'text',
                text: `✅ 音声生成成功\n\n**テキスト**: ${result.text.substring(0, 100)}...\n**音声**: ${result.voice}\n**出力先**: ${outputPath}\n\n${result.output}`,
              },
            ],
          };
        } else {
          let errorText = `❌ 音声生成失敗\n\n**テキスト**: ${result.text.substring(0, 100)}...\n\n`;

          if (result.error.includes('GOOGLE_API_KEY')) {
            errorText += `**エラー**: Google API Keyが設定されていません\n\n`;
            errorText += `**設定方法**:\n`;
            errorText += `1. https://aistudio.google.com/apikey にアクセス\n`;
            errorText += `2. API Keyを作成\n`;
            errorText += `3. 環境変数に設定:\n`;
            errorText += `   \`\`\`bash\n   export GOOGLE_API_KEY=your_api_key_here\n   \`\`\`\n`;
          } else {
            errorText += `**エラー**: ${result.error}\n\n`;
            errorText += `**詳細**:\n${result.stderr || result.stdout}\n`;
          }

          return {
            content: [
              {
                type: 'text',
                text: errorText,
              },
            ],
            isError: true,
          };
        }
      }

      case 'gemini__generate_speeches_batch': {
        const { texts, outputPattern, voice, apiKey } = args;

        if (!texts || texts.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ エラー: テキストが指定されていません',
              },
            ],
            isError: true,
          };
        }

        const results = generateSpeechesBatch(texts, {
          outputPattern,
          voice,
          apiKey,
        });

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        let text = `📊 バッチ音声生成完了\n\n`;
        text += `**成功**: ${successCount}/${results.length}件\n`;
        text += `**失敗**: ${failedCount}/${results.length}件\n\n`;
        text += `---\n\n`;

        for (const result of results) {
          if (result.success) {
            const outputPath = result.output.match(/音声が生成されました: (.+)/)?.[1] || result.outputPath;
            text += `✅ **音声 ${result.index}** 生成成功\n`;
            text += `   - テキスト: ${result.text.substring(0, 60)}...\n`;
            text += `   - 出力先: ${outputPath}\n\n`;
          } else {
            text += `❌ **音声 ${result.index}** 生成失敗\n`;
            text += `   - テキスト: ${result.text.substring(0, 60)}...\n`;
            text += `   - エラー: ${result.error}\n\n`;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
          isError: failedCount > 0,
        };
      }

      case 'gemini__check_api_key': {
        const status = checkApiKey();

        let text = '🔑 Google API Key 設定状況\n\n';

        if (status.configured) {
          text += `✅ **設定済み**: ${status.apiKey}\n\n`;
          text += `画像・音声生成が利用可能です。\n`;
        } else {
          text += `❌ **未設定**: API Keyが見つかりません\n\n`;
          text += `${status.howToSetup}\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ エラーが発生しました\n\n${error.message}\n\n${error.stack}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Gemini Image & TTS Generation MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
