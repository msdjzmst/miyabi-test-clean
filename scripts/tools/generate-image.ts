#!/usr/bin/env node
/**
 * Gemini 2.5 Flash Image - 画像生成ツール
 *
 * Features:
 *   - Auto-retry with exponential backoff
 *   - Safety settings configuration
 *   - Progress reporting
 *   - Japanese language optimized
 *
 * Usage:
 *   npm run generate-image -- "prompt text" --output=path/to/image.png
 *   npm run generate-image -- "prompt text" --aspect-ratio=16:9
 *
 * Environment Variables:
 *   GOOGLE_API_KEY - Google Gemini API key (required)
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env file
config();

// Note: Using native fetch API (available in Node.js 18+)

// ============================================================================
// Type Definitions
// ============================================================================

interface GenerateImageOptions {
  prompt: string;
  output?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  apiKey?: string;
  retries?: number;
}

interface GeminiAPIRequest {
  contents: Array<{
    parts: Array<{
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }>;
  }>;
  generationConfig?: {
    responseModalities?: string[];
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

interface GeminiAPIResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_MODEL = 'gemini-2.5-flash-image-preview';
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'assets', 'generated-images');

const MAX_RETRIES = 3; // Initial attempt + 3 retries = 4 total attempts
const INITIAL_BACKOFF_MS = 2000;

// Safety settings to allow creative content
const SAFETY_SETTINGS = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_NONE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_NONE',
  },
];

// ============================================================================
// Main Function
// ============================================================================

export async function generateImage(options: GenerateImageOptions): Promise<string> {
  // API key取得
  const apiKey = options.apiKey || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_API_KEY is required. Set it as environment variable or pass via --api-key option.\n' +
      'Get your API key from: https://aistudio.google.com/apikey',
    );
  }

  console.log('🎨 Gemini 2.5 Flash Image - 画像生成開始');
  console.log(`📝 Prompt: ${options.prompt}`);
  console.log(`📐 Aspect Ratio: ${options.aspectRatio || '1:1 (default)'}`);

  const maxRetries = options.retries || MAX_RETRIES;
  let lastError: any = null;

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Exponential backoff for retries
      if (attempt > 0) {
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
        const waitSeconds = Math.round(backoffTime / 1000);
        console.log(`⏳ APIエラー。リトライ中... (${attempt}/${maxRetries}) [${waitSeconds}秒待機]`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }

      console.log(`🚀 画像を生成中... (試行 ${attempt + 1}/${maxRetries + 1})`);

      // リクエストボディ作成
      const requestBody: GeminiAPIRequest = {
        contents: [
          {
            parts: [
              {
                text: buildPrompt(options.prompt, options.aspectRatio),
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['image'],
        },
        safetySettings: SAFETY_SETTINGS,
      };

      // API呼び出し
      const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as GeminiAPIResponse;

      // プロンプトブロックチェック
      if (data.promptFeedback?.blockReason) {
        let reason = `プロンプトがブロックされました。理由: ${data.promptFeedback.blockReason}`;
        if (data.promptFeedback.blockReasonMessage) {
          reason += ` - ${data.promptFeedback.blockReasonMessage}`;
        }
        throw new Error(reason);
      }

      // エラーチェック
      if (data.error) {
        throw new Error(`Gemini API Error: ${data.error.message} (${data.error.code})`);
      }

      // 画像データ抽出
      const imageData = extractImageData(data);
      if (!imageData) {
        let finishReasonInfo = '';
        if (data.candidates?.[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') {
          finishReasonInfo = ` 終了理由: ${data.candidates[0].finishReason}.`;
        }
        throw new Error(`APIから画像データが返されませんでした。${finishReasonInfo}`);
      }

      // 画像保存
      const outputPath = await saveImage(imageData, options.output);

      console.log(`✅ 画像生成完了: ${outputPath}`);
      return outputPath;

    } catch (error) {
      console.error(`❌ 試行 ${attempt + 1} 失敗:`, error);
      lastError = error;
    }
  }

  // All retries failed
  const errorMessage = lastError instanceof Error ? lastError.message : JSON.stringify(lastError);
  throw new Error(`自動リトライに失敗しました (${maxRetries + 1}回試行): ${errorMessage}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * プロンプト構築（アスペクト比を含む）
 */
function buildPrompt(basePrompt: string, aspectRatio?: string): string {
  let prompt = basePrompt;

  // アスペクト比指定
  if (aspectRatio) {
    prompt += `\n\nImage aspect ratio: ${aspectRatio}`;
  }

  // 日本語プロンプトの場合、品質向上のための追加指示
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(basePrompt)) {
    prompt += '\n\nHigh quality, detailed, professional illustration.';
  }

  return prompt;
}

/**
 * レスポンスから画像データを抽出
 */
function extractImageData(response: GeminiAPIResponse): string | null {
  if (!response.candidates || response.candidates.length === 0) {
    return null;
  }

  const parts = response.candidates[0].content.parts;
  for (const part of parts) {
    if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
      return part.inlineData.data;
    }
  }

  return null;
}

/**
 * 画像をBase64からファイルに保存
 */
async function saveImage(base64Data: string, outputPath?: string): Promise<string> {
  // 出力パス決定
  let filePath: string;

  if (outputPath) {
    filePath = path.resolve(outputPath);
  } else {
    // デフォルト出力先
    if (!fs.existsSync(DEFAULT_OUTPUT_DIR)) {
      fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    filePath = path.join(DEFAULT_OUTPUT_DIR, `gemini-image-${timestamp}.png`);
  }

  // ディレクトリ作成（存在しない場合）
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Base64デコードして保存
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): GenerateImageOptions | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return null;
  }

  const options: GenerateImageOptions = {
    prompt: '',
  };

  // プロンプト抽出（最初の非オプション引数）
  for (const arg of args) {
    if (!arg.startsWith('--')) {
      options.prompt = arg;
      break;
    }
  }

  if (!options.prompt) {
    console.error('❌ Error: Prompt is required');
    printHelp();
    return null;
  }

  // オプション解析
  for (const arg of args) {
    if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--aspect-ratio=')) {
      const ratio = arg.split('=')[1] as any;
      if (['1:1', '16:9', '9:16', '4:3', '3:4'].includes(ratio)) {
        options.aspectRatio = ratio;
      } else {
        console.error(`❌ Error: Invalid aspect ratio: ${ratio}`);
        console.error('   Valid values: 1:1, 16:9, 9:16, 4:3, 3:4');
        return null;
      }
    } else if (arg.startsWith('--api-key=')) {
      options.apiKey = arg.split('=')[1];
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Gemini 2.5 Flash Image - 画像生成ツール

Usage:
  npm run generate-image -- "<prompt>" [options]

Arguments:
  <prompt>              画像生成プロンプト（日本語対応）

Options:
  --output=<path>       出力ファイルパス（デフォルト: assets/generated-images/）
  --aspect-ratio=<ratio> アスペクト比（1:1, 16:9, 9:16, 4:3, 3:4）
  --api-key=<key>       Google API Key（環境変数 GOOGLE_API_KEY でも可）
  --help, -h            ヘルプ表示

Environment Variables:
  GOOGLE_API_KEY        Google Gemini API key（必須）
                        取得先: https://aistudio.google.com/apikey

Examples:
  # 基本的な使い方
  npm run generate-image -- "美しい日本庭園の風景"

  # アスペクト比指定
  npm run generate-image -- "未来都市の夜景" --aspect-ratio=16:9

  # 出力先指定
  npm run generate-image -- "AI自動レストランの様子" --output=./my-image.png

  # note.com記事用画像生成
  npm run generate-image -- "Miyabiの自動開発フロー図、シンプルでわかりやすいインフォグラフィック" --aspect-ratio=16:9 --output=./assets/note-article-1.png
`);
}

// ============================================================================
// Main Execution
// ============================================================================

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs();

  if (!options) {
    process.exit(1);
  }

  generateImage(options)
    .then((outputPath) => {
      console.log(`\n🎉 成功！画像が生成されました: ${outputPath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ エラー:', error.message);
      process.exit(1);
    });
}
