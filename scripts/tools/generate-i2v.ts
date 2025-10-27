#!/usr/bin/env node
/**
 * Seedance I2V (Image-to-Video) Generation Tool
 *
 * Features:
 *   - AI-powered Image-to-Video generation using ByteDance's Seedance API
 *   - High-quality video generation from single image
 *   - Camera motion control (fixed/dynamic)
 *   - Resolution & duration customization
 *   - Automatic task polling and video download
 *
 * Usage:
 *   npm run generate-i2v -- --image="path/to/image.png" --prompt="Describe motion"
 *   npm run generate-i2v -- --url="https://example.com/image.png" --prompt="Motion description"
 *
 * Environment Variables:
 *   ARK_API_KEY - ByteDance ARK API Key (required)
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env file
config();

// ============================================================================
// Type Definitions
// ============================================================================

interface GenerateI2VOptions {
  image?: string; // Local image path
  url?: string; // Remote image URL
  prompt: string;
  resolution?: '720p' | '1080p';
  duration?: 5 | 10;
  cameraFixed?: boolean;
  output?: string;
  apiKey?: string;
}

interface SeedanceTaskResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  result?: {
    video_url?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const SEEDANCE_MODEL = 'seedance-1-0-pro-250528';
const ARK_API_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'assets', 'generated-i2v');
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max wait time

// ============================================================================
// Main Function
// ============================================================================

export async function generateI2V(options: GenerateI2VOptions): Promise<string> {
  console.log('🎬 Seedance I2V Generation - 開始');

  // API key取得
  const apiKey = options.apiKey || process.env.ARK_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ARK_API_KEY is required. Set it as environment variable or pass via --api-key option.\n' +
      'Get your API key from ByteDance ARK platform',
    );
  }

  // Validate inputs
  if (!options.image && !options.url) {
    throw new Error('Either --image (local path) or --url (remote URL) is required');
  }

  if (options.image && !fs.existsSync(options.image)) {
    throw new Error(`Image file not found: ${options.image}`);
  }

  // Build image URL
  let imageUrl: string;
  if (options.url) {
    imageUrl = options.url;
  } else if (options.image) {
    // For local images, we need to upload them first or provide a public URL
    // For simplicity, we'll throw an error for now and require URL
    throw new Error(
      'Local image upload not yet implemented. Please use --url with a public image URL.\n' +
      'You can upload your image to a public hosting service (e.g., Imgur, Cloudinary) and use the URL.',
    );
  } else {
    throw new Error('Image URL is required');
  }

  // Build prompt with parameters
  const resolution = options.resolution || '1080p';
  const duration = options.duration || 5;
  const cameraFixed = options.cameraFixed !== undefined ? options.cameraFixed : false;

  const fullPrompt = `${options.prompt} --resolution ${resolution} --duration ${duration} --camerafixed ${cameraFixed}`;

  console.log(`📝 Prompt: ${options.prompt}`);
  console.log(`🖼️ Image URL: ${imageUrl}`);
  console.log(`📐 Resolution: ${resolution}`);
  console.log(`⏱️ Duration: ${duration}s`);
  console.log(`📹 Camera: ${cameraFixed ? 'Fixed' : 'Dynamic'}`);

  try {
    // Step 1: Create task
    console.log('\n🚀 Creating I2V generation task...');
    const taskId = await createTask(apiKey, imageUrl, fullPrompt);
    console.log(`✅ Task created: ${taskId}`);

    // Step 2: Poll task status
    console.log('\n⏳ Waiting for video generation (this may take 1-5 minutes)...');
    const videoUrl = await pollTask(apiKey, taskId);

    if (!videoUrl) {
      throw new Error('Video generation completed but no video URL returned');
    }

    console.log(`✅ Video generated: ${videoUrl}`);

    // Step 3: Download video
    console.log('\n📥 Downloading video...');
    const outputPath = options.output || getDefaultOutputPath();
    await downloadVideo(videoUrl, outputPath);

    console.log(`✅ Video saved: ${outputPath}`);

    // Get file size
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 File size: ${fileSizeMB} MB`);

    return outputPath;
  } catch (error) {
    console.error('❌ Error generating I2V:', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create I2V generation task
 */
async function createTask(apiKey: string, imageUrl: string, prompt: string): Promise<string> {
  const requestBody = {
    model: SEEDANCE_MODEL,
    content: [
      {
        type: 'text',
        text: prompt,
      },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      },
    ],
  };

  const response = await fetch(ARK_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create task (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { id?: string };

  if (!data.id) {
    throw new Error(`No task ID returned: ${JSON.stringify(data)}`);
  }

  return data.id;
}

/**
 * Poll task status until completion
 */
async function pollTask(apiKey: string, taskId: string): Promise<string | null> {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    attempts++;

    const response = await fetch(`${ARK_API_ENDPOINT}/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to query task (${response.status}): ${errorText}`);
    }

    const data = await response.json() as SeedanceTaskResponse;

    console.log(`   [${attempts}/${MAX_POLL_ATTEMPTS}] Status: ${data.status}`);

    if (data.status === 'completed') {
      return data.result?.video_url || null;
    } else if (data.status === 'failed') {
      const errorMsg = data.error?.message || 'Unknown error';
      throw new Error(`Task failed: ${errorMsg}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Task timeout after ${MAX_POLL_ATTEMPTS} attempts (${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s)`);
}

/**
 * Download video from URL
 */
async function downloadVideo(url: string, outputPath: string): Promise<void> {
  ensureDirectoryExists(path.dirname(outputPath));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(outputPath, buffer);
}

/**
 * Get default output path
 */
function getDefaultOutputPath(): string {
  if (!fs.existsSync(DEFAULT_OUTPUT_DIR)) {
    fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(DEFAULT_OUTPUT_DIR, `i2v-${timestamp}.mp4`);
}

/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): GenerateI2VOptions | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return null;
  }

  const options: Partial<GenerateI2VOptions> = {};

  // Parse options
  for (const arg of args) {
    if (arg.startsWith('--image=')) {
      options.image = arg.split('=')[1];
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg.startsWith('--prompt=')) {
      options.prompt = arg.split('=')[1];
    } else if (arg.startsWith('--resolution=')) {
      const res = arg.split('=')[1] as any;
      if (['720p', '1080p'].includes(res)) {
        options.resolution = res;
      } else {
        console.error(`❌ Error: Invalid resolution: ${res}`);
        return null;
      }
    } else if (arg.startsWith('--duration=')) {
      const dur = parseInt(arg.split('=')[1], 10) as any;
      if ([5, 10].includes(dur)) {
        options.duration = dur;
      } else {
        console.error(`❌ Error: Invalid duration: ${dur}`);
        return null;
      }
    } else if (arg.startsWith('--camera-fixed=')) {
      options.cameraFixed = arg.split('=')[1] === 'true';
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--api-key=')) {
      options.apiKey = arg.split('=')[1];
    }
  }

  if (!options.prompt) {
    console.error('❌ Error: --prompt is required');
    printHelp();
    return null;
  }

  if (!options.image && !options.url) {
    console.error('❌ Error: Either --image or --url is required');
    printHelp();
    return null;
  }

  return options as GenerateI2VOptions;
}

function printHelp() {
  console.log(`
🎬 Seedance I2V (Image-to-Video) Generation Tool

Usage:
  npm run generate-i2v -- --url="<image_url>" --prompt="<motion_description>" [options]
  npm run generate-i2v -- --image="<local_path>" --prompt="<motion_description>" [options]

Required Arguments:
  --url=<url>           Public image URL (required if --image not provided)
  --image=<path>        Local image path (NOT YET IMPLEMENTED - use --url instead)
  --prompt=<text>       Motion description prompt

Options:
  --resolution=<res>    Video resolution: 720p, 1080p (default: 1080p)
  --duration=<sec>      Video duration: 5, 10 (default: 5)
  --camera-fixed=<bool> Camera fixed (true) or dynamic (false) (default: false)
  --output=<path>       Output video path (default: assets/generated-i2v/)
  --api-key=<key>       ByteDance ARK API Key (or set ARK_API_KEY env var)
  --help, -h            Show this help

Environment Variables:
  ARK_API_KEY           ByteDance ARK API Key (required)
                        Get from: ByteDance ARK platform

Examples:
  # Basic usage with public image URL
  npm run generate-i2v -- \\
    --url="https://example.com/image.png" \\
    --prompt="Camera slowly zooms in on the subject"

  # High-res with camera motion
  npm run generate-i2v -- \\
    --url="https://example.com/landscape.png" \\
    --prompt="Drone flying through mountains at breakneck speed" \\
    --resolution=1080p \\
    --duration=10 \\
    --camera-fixed=false

  # Fixed camera shot
  npm run generate-i2v -- \\
    --url="https://example.com/portrait.png" \\
    --prompt="Subject slowly smiles at the camera" \\
    --camera-fixed=true \\
    --output="./my-video.mp4"

  # Use environment variable for API key
  export ARK_API_KEY=your_api_key_here
  npm run generate-i2v -- --url="..." --prompt="..."

Requirements:
  - ByteDance ARK API Key
  - Public image URL (local image upload not yet implemented)

Notes:
  - Video generation typically takes 1-5 minutes
  - Task status is polled every 5 seconds
  - Maximum wait time: 5 minutes (60 attempts)
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

  generateI2V(options)
    .then((outputPath) => {
      console.log(`\n🎉 Success! I2V video generated: ${outputPath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    });
}
