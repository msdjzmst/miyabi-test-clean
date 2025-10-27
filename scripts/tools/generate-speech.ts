#!/usr/bin/env node
/**
 * Gemini 2.5 Flash TTS - 音声生成ツール
 *
 * Features:
 *   - Text-to-Speech with Gemini 2.5 Flash
 *   - Multiple voice options
 *   - Auto-retry with exponential backoff
 *   - WAV file output
 *   - Japanese language optimized
 *
 * Usage:
 *   npm run generate-speech -- "テキスト" --output=path/to/audio.wav
 *   npm run generate-speech -- "Text" --voice=Kore
 *
 * Environment Variables:
 *   GOOGLE_API_KEY - Google Gemini API key (required)
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env file
config();

// ============================================================================
// Type Definitions
// ============================================================================

interface GenerateSpeechOptions {
  text: string;
  output?: string;
  voice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';
  apiKey?: string;
  retries?: number;
}

interface GeminiTTSRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig: {
    responseModalities: string[];
    speechConfig?: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: string;
        };
      };
    };
  };
}

interface GeminiTTSResponse {
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

const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'assets', 'generated-audio');

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

// Voice descriptions
const VOICE_DESCRIPTIONS: Record<string, string> = {
  Puck: 'Warm and expressive, suitable for storytelling',
  Charon: 'Deep and authoritative, good for narration',
  Kore: 'Clear and natural, ideal for general purposes',
  Fenrir: 'Strong and dynamic, great for announcements',
  Aoede: 'Melodic and pleasant, perfect for conversational content',
};

// ============================================================================
// Main Function
// ============================================================================

export async function generateSpeech(options: GenerateSpeechOptions): Promise<string> {
  // API key取得
  const apiKey = options.apiKey || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_API_KEY is required. Set it as environment variable or pass via --api-key option.\n' +
      'Get your API key from: https://aistudio.google.com/apikey',
    );
  }

  const voice = options.voice || 'Kore';

  console.log('🎙️ Gemini 2.5 Flash TTS - 音声生成開始');
  console.log(`📝 Text: ${options.text.substring(0, 100)}${options.text.length > 100 ? '...' : ''}`);
  console.log(`🗣️ Voice: ${voice} (${VOICE_DESCRIPTIONS[voice]})`);

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

      console.log(`🚀 音声を生成中... (試行 ${attempt + 1}/${maxRetries + 1})`);

      // リクエストボディ作成
      const requestBody: GeminiTTSRequest = {
        contents: [
          {
            parts: [
              {
                text: options.text,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
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

      const data = (await response.json()) as GeminiTTSResponse;

      // プロンプトブロックチェック
      if (data.promptFeedback?.blockReason) {
        let reason = `テキストがブロックされました。理由: ${data.promptFeedback.blockReason}`;
        if (data.promptFeedback.blockReasonMessage) {
          reason += ` - ${data.promptFeedback.blockReasonMessage}`;
        }
        throw new Error(reason);
      }

      // エラーチェック
      if (data.error) {
        throw new Error(`Gemini API Error: ${data.error.message} (${data.error.code})`);
      }

      // 音声データ抽出
      const audioData = extractAudioData(data);
      if (!audioData) {
        let finishReasonInfo = '';
        if (data.candidates?.[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') {
          finishReasonInfo = ` 終了理由: ${data.candidates[0].finishReason}.`;
        }
        throw new Error(`APIから音声データが返されませんでした。${finishReasonInfo}`);
      }

      // 音声保存
      const outputPath = await saveAudio(audioData, options.output);

      console.log(`✅ 音声生成完了: ${outputPath}`);
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
 * レスポンスから音声データを抽出
 */
function extractAudioData(response: GeminiTTSResponse): string | null {
  if (!response.candidates || response.candidates.length === 0) {
    return null;
  }

  const parts = response.candidates[0].content.parts;
  for (const part of parts) {
    if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
      return part.inlineData.data;
    }
  }

  return null;
}

/**
 * 音声をBase64からWAVファイルに保存
 */
async function saveAudio(base64Data: string, outputPath?: string): Promise<string> {
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
    filePath = path.join(DEFAULT_OUTPUT_DIR, `gemini-speech-${timestamp}.wav`);
  }

  // ディレクトリ作成（存在しない場合）
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Base64デコードして保存 (PCM data)
  const buffer = Buffer.from(base64Data, 'base64');

  // WAV header creation
  const wavBuffer = createWavBuffer(buffer);
  fs.writeFileSync(filePath, wavBuffer);

  return filePath;
}

/**
 * Create WAV file buffer with proper header
 * Based on Python's wave.open() behavior
 */
function createWavBuffer(pcmData: Buffer): Buffer {
  const channels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;

  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, 44);

  return buffer;
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): GenerateSpeechOptions | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return null;
  }

  const options: GenerateSpeechOptions = {
    text: '',
  };

  // テキスト抽出（最初の非オプション引数）
  for (const arg of args) {
    if (!arg.startsWith('--')) {
      options.text = arg;
      break;
    }
  }

  if (!options.text) {
    console.error('❌ Error: Text is required');
    printHelp();
    return null;
  }

  // オプション解析
  for (const arg of args) {
    if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--voice=')) {
      const voiceName = arg.split('=')[1] as any;
      if (['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'].includes(voiceName)) {
        options.voice = voiceName;
      } else {
        console.error(`❌ Error: Invalid voice: ${voiceName}`);
        console.error('   Valid values: Puck, Charon, Kore, Fenrir, Aoede');
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
Gemini 2.5 Flash TTS - 音声生成ツール

Usage:
  npm run generate-speech -- "<text>" [options]

Arguments:
  <text>                テキスト（日本語・英語対応）

Options:
  --output=<path>       出力ファイルパス（デフォルト: assets/generated-audio/）
  --voice=<name>        音声名（Puck, Charon, Kore, Fenrir, Aoede）
                        デフォルト: Kore
  --api-key=<key>       Google API Key（環境変数 GOOGLE_API_KEY でも可）
  --help, -h            ヘルプ表示

Available Voices:
  Puck    - ${VOICE_DESCRIPTIONS.Puck}
  Charon  - ${VOICE_DESCRIPTIONS.Charon}
  Kore    - ${VOICE_DESCRIPTIONS.Kore}
  Fenrir  - ${VOICE_DESCRIPTIONS.Fenrir}
  Aoede   - ${VOICE_DESCRIPTIONS.Aoede}

Environment Variables:
  GOOGLE_API_KEY        Google Gemini API key（必須）
                        取得先: https://aistudio.google.com/apikey

Examples:
  # 基本的な使い方
  npm run generate-speech -- "こんにちは、素晴らしい一日を！"

  # 音声指定
  npm run generate-speech -- "Welcome to Miyabi" --voice=Charon

  # 出力先指定
  npm run generate-speech -- "AI開発の未来" --output=./my-speech.wav

  # note.com記事用音声生成
  npm run generate-speech -- "Miyabiは見えないアシスタントとして、あなたの仕事を自動化します" --voice=Kore --output=./assets/note-article-intro.wav
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

  generateSpeech(options)
    .then((outputPath) => {
      console.log(`\n🎉 成功！音声が生成されました: ${outputPath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ エラー:', error.message);
      process.exit(1);
    });
}
