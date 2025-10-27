#!/usr/bin/env node
/**
 * Short Video Generation Tool
 *
 * Features:
 *   - Combine images and audio into short videos
 *   - Optimized for TikTok/YouTube Shorts/Instagram Reels (9:16 aspect ratio)
 *   - Text overlays and transitions
 *   - FFmpeg-based video processing
 *
 * Usage:
 *   npm run generate-video -- --images="img1.png,img2.png" --audio="speech.wav" --output="video.mp4"
 *   npm run generate-video -- --template=miyabi-intro
 *
 * Environment Variables:
 *   None required (uses FFmpeg)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load .env file
config();

// ============================================================================
// Type Definitions
// ============================================================================

interface GenerateVideoOptions {
  images: string[];
  audio?: string;
  output?: string;
  duration?: number; // Duration per image in seconds
  width?: number;
  height?: number;
  fps?: number;
  title?: string;
  subtitle?: string;
  transition?: 'fade' | 'slide' | 'none';
  template?: 'miyabi-intro' | 'tutorial' | 'feature-showcase';
}

interface VideoTemplate {
  name: string;
  images: string[];
  audioScript: string[];
  title: string;
  subtitle?: string;
  duration: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'assets', 'generated-videos');
const DEFAULT_WIDTH = 1080; // 9:16 aspect ratio for shorts
const DEFAULT_HEIGHT = 1920;
const DEFAULT_FPS = 30;
const DEFAULT_DURATION_PER_IMAGE = 3; // seconds

// Video templates for common use cases
const VIDEO_TEMPLATES: Record<string, VideoTemplate> = {
  'miyabi-intro': {
    name: 'Miyabi Introduction',
    images: [
      './assets/miyabi-note-article-image-1-invisible-assistant.png',
      './assets/miyabi-note-article-image-2-workflow.png',
      './assets/miyabi-note-article-image-3-staff.png',
    ],
    audioScript: [
      'Miyabiは見えないアシスタントとして、あなたの仕事を自動化します',
      '朝、やることメモを残すだけで、夕方には完成報告が届きます',
      '6種類のAIスタッフが24時間365日働きます',
    ],
    title: 'Miyabi - 見えないアシスタント',
    subtitle: '何もしなくても仕事が終わる',
    duration: 3,
  },
};

// ============================================================================
// Main Function
// ============================================================================

export async function generateVideo(options: GenerateVideoOptions): Promise<string> {
  console.log('🎬 Short Video Generation - 開始');

  // Validate images
  if (!options.images || options.images.length === 0) {
    throw new Error('At least one image is required');
  }

  for (const img of options.images) {
    if (!fs.existsSync(img)) {
      throw new Error(`Image not found: ${img}`);
    }
  }

  // Validate audio (optional)
  if (options.audio && !fs.existsSync(options.audio)) {
    throw new Error(`Audio file not found: ${options.audio}`);
  }

  // Setup output path
  const output = options.output || getDefaultOutputPath();
  ensureDirectoryExists(path.dirname(output));

  // Video settings
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  const fps = options.fps || DEFAULT_FPS;
  const duration = options.duration || DEFAULT_DURATION_PER_IMAGE;

  console.log(`📐 Resolution: ${width}x${height} @ ${fps}fps`);
  console.log(`📝 Images: ${options.images.length}`);
  console.log(`🎵 Audio: ${options.audio || 'None'}`);
  console.log(`⏱️ Duration per image: ${duration}s`);

  try {
    // Step 1: Create video from images
    const tempVideoPath = await createVideoFromImages(options.images, {
      width,
      height,
      fps,
      duration,
      transition: options.transition || 'fade',
    });

    // Step 2: Add audio if provided
    let finalVideoPath = tempVideoPath;
    if (options.audio) {
      finalVideoPath = await addAudioToVideo(tempVideoPath, options.audio, output);
      // Clean up temp file
      fs.unlinkSync(tempVideoPath);
    } else {
      // Rename temp file to output
      fs.renameSync(tempVideoPath, output);
      finalVideoPath = output;
    }

    // Step 3: Add text overlays if provided
    if (options.title || options.subtitle) {
      const withTextPath = await addTextOverlay(finalVideoPath, {
        title: options.title,
        subtitle: options.subtitle,
      });
      fs.unlinkSync(finalVideoPath);
      fs.renameSync(withTextPath, output);
    }

    console.log(`✅ Video generated: ${output}`);

    // Get file size
    const stats = fs.statSync(output);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 File size: ${fileSizeMB} MB`);

    return output;
  } catch (error) {
    console.error('❌ Error generating video:', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create video from multiple images with transitions
 */
async function createVideoFromImages(
  images: string[],
  options: {
    width: number;
    height: number;
    fps: number;
    duration: number;
    transition: 'fade' | 'slide' | 'none';
  },
): Promise<string> {
  const tempOutput = path.join(DEFAULT_OUTPUT_DIR, `temp-${Date.now()}.mp4`);
  ensureDirectoryExists(path.dirname(tempOutput));

  console.log('🎞️ Creating video from images...');

  // Create filter complex for transitions
  const { width, height, fps, duration, transition } = options;

  if (images.length === 1) {
    // Single image - simple conversion
    const cmd = `ffmpeg -loop 1 -i "${images[0]}" -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2" -t ${duration} -c:v libx264 -pix_fmt yuv420p -r ${fps} "${tempOutput}"`;
    execSync(cmd, { stdio: 'inherit' });
  } else {
    // Multiple images with transitions
    const transitionDuration = 0.5; // 0.5 second transition
    const inputs = images.map((img) => `-loop 1 -t ${duration} -i "${img}"`).join(' ');

    let filterResult;
    if (transition === 'fade') {
      // Fade transition between images
      filterResult = createFadeTransitionFilter(images.length, duration, transitionDuration, width, height);
    } else if (transition === 'slide') {
      // Slide transition
      filterResult = createSlideTransitionFilter(images.length, duration, transitionDuration, width, height);
    } else {
      // No transition - just concat
      filterResult = createSimpleConcatFilter(images.length, width, height);
    }

    const cmd = `ffmpeg ${inputs} -filter_complex "${filterResult.filter}" -map "${filterResult.map}" -c:v libx264 -pix_fmt yuv420p -r ${fps} "${tempOutput}"`;

    execSync(cmd, { stdio: 'inherit' });
  }

  console.log(`✅ Images compiled: ${tempOutput}`);
  return tempOutput;
}

/**
 * Create fade transition filter for FFmpeg
 */
function createFadeTransitionFilter(
  numImages: number,
  duration: number,
  transitionDuration: number,
  width: number,
  height: number,
): { filter: string; map: string } {
  let filter = '';
  const segments: string[] = [];

  for (let i = 0; i < numImages; i++) {
    // Scale and pad each image
    filter += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}];`;

    if (i > 0) {
      // Add fade transition
      filter += `[v${i - 1}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${duration - transitionDuration}[vout${i}];`;
      segments.push(`vout${i}`);
    } else {
      segments.push(`v${i}`);
    }
  }

  // Build final concat if multiple segments
  if (numImages > 2) {
    filter += `${segments.map((s) => `[${s}]`).join('')  }concat=n=${segments.length}:v=1:a=0[outv]`;
    return { filter, map: '[outv]' };
  } else if (numImages === 2) {
    return { filter, map: `[${segments[segments.length - 1]}]` };
  }

  return { filter, map: '[v0]' };
}

/**
 * Create slide transition filter
 */
function createSlideTransitionFilter(
  numImages: number,
  duration: number,
  transitionDuration: number,
  width: number,
  height: number,
): { filter: string; map: string } {
  let filter = '';

  for (let i = 0; i < numImages; i++) {
    filter += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}];`;

    if (i > 0) {
      filter += `[v${i - 1}][v${i}]xfade=transition=slideleft:duration=${transitionDuration}:offset=${duration - transitionDuration}[vout${i}];`;
    }
  }

  return { filter, map: `[vout${numImages - 1}]` };
}

/**
 * Create simple concat filter (no transitions)
 */
function createSimpleConcatFilter(numImages: number, width: number, height: number): { filter: string; map: string } {
  let filter = '';

  for (let i = 0; i < numImages; i++) {
    filter += `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`;
  }

  const inputs = Array.from({ length: numImages }, (_, i) => `[v${i}]`).join('');
  filter += `${inputs}concat=n=${numImages}:v=1:a=0[outv]`;
  return { filter, map: '[outv]' };
}

/**
 * Add audio to video
 */
async function addAudioToVideo(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
  console.log('🎵 Adding audio to video...');

  const tempOutput = outputPath.replace('.mp4', '-with-audio.mp4');

  const cmd = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -shortest "${tempOutput}"`;

  execSync(cmd, { stdio: 'inherit' });

  console.log(`✅ Audio added: ${tempOutput}`);
  return tempOutput;
}

/**
 * Add text overlay (title and subtitle)
 */
async function addTextOverlay(
  videoPath: string,
  text: { title?: string; subtitle?: string },
): Promise<string> {
  if (!text.title && !text.subtitle) {
    return videoPath;
  }

  console.log('📝 Adding text overlay...');

  const tempOutput = videoPath.replace('.mp4', '-with-text.mp4');

  let drawtext = '';

  if (text.title) {
    drawtext = `drawtext=text='${escapeFFmpegText(text.title)}':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=100:box=1:boxcolor=black@0.6:boxborderw=10`;
  }

  if (text.subtitle) {
    if (drawtext) {
      drawtext += ',';
    }
    drawtext += `drawtext=text='${escapeFFmpegText(text.subtitle)}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=200:box=1:boxcolor=black@0.6:boxborderw=10`;
  }

  const cmd = `ffmpeg -i "${videoPath}" -vf "${drawtext}" -c:a copy "${tempOutput}"`;

  execSync(cmd, { stdio: 'inherit' });

  console.log(`✅ Text overlay added: ${tempOutput}`);
  return tempOutput;
}

/**
 * Escape special characters for FFmpeg drawtext
 */
function escapeFFmpegText(text: string): string {
  return text.replace(/'/g, "\\\\'").replace(/:/g, '\\:');
}

/**
 * Get default output path
 */
function getDefaultOutputPath(): string {
  if (!fs.existsSync(DEFAULT_OUTPUT_DIR)) {
    fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(DEFAULT_OUTPUT_DIR, `short-video-${timestamp}.mp4`);
}

/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate video from template
 */
export async function generateVideoFromTemplate(templateName: string): Promise<string> {
  const template = VIDEO_TEMPLATES[templateName];

  if (!template) {
    throw new Error(`Template not found: ${templateName}. Available templates: ${Object.keys(VIDEO_TEMPLATES).join(', ')}`);
  }

  console.log(`🎬 Using template: ${template.name}`);

  // Generate audio from script
  console.log('🎙️ Generating audio from script...');
  const audioFiles: string[] = [];

  for (let i = 0; i < template.audioScript.length; i++) {
    const audioPath = path.join(DEFAULT_OUTPUT_DIR, `temp-audio-${i}.wav`);
    // Note: This requires generate-speech to be available
    execSync(`npm run generate-speech -- "${template.audioScript[i]}" --voice=Kore --output="${audioPath}"`, {
      stdio: 'inherit',
    });
    audioFiles.push(audioPath);
  }

  // Concatenate audio files
  const concatenatedAudio = path.join(DEFAULT_OUTPUT_DIR, 'temp-audio-combined.wav');
  const audioListFile = path.join(DEFAULT_OUTPUT_DIR, 'audio-list.txt');
  fs.writeFileSync(audioListFile, audioFiles.map((f) => `file '${f}'`).join('\n'));
  execSync(`ffmpeg -f concat -safe 0 -i "${audioListFile}" -c copy "${concatenatedAudio}"`, { stdio: 'inherit' });

  // Generate video
  const output = await generateVideo({
    images: template.images,
    audio: concatenatedAudio,
    title: template.title,
    subtitle: template.subtitle,
    duration: template.duration,
    transition: 'fade',
  });

  // Clean up temp files
  audioFiles.forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));
  fs.existsSync(concatenatedAudio) && fs.unlinkSync(concatenatedAudio);
  fs.existsSync(audioListFile) && fs.unlinkSync(audioListFile);

  return output;
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): { options: GenerateVideoOptions | null; template: string | null } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return { options: null, template: null };
  }

  // Check for template
  const templateArg = args.find((arg) => arg.startsWith('--template='));
  if (templateArg) {
    const templateName = templateArg.split('=')[1];
    return { options: null, template: templateName };
  }

  const options: GenerateVideoOptions = {
    images: [],
  };

  // Parse options
  for (const arg of args) {
    if (arg.startsWith('--images=')) {
      options.images = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--audio=')) {
      options.audio = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg.startsWith('--duration=')) {
      options.duration = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--width=')) {
      options.width = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--height=')) {
      options.height = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--title=')) {
      options.title = arg.split('=')[1];
    } else if (arg.startsWith('--subtitle=')) {
      options.subtitle = arg.split('=')[1];
    } else if (arg.startsWith('--transition=')) {
      options.transition = arg.split('=')[1] as any;
    }
  }

  if (options.images.length === 0) {
    console.error('❌ Error: At least one image is required');
    printHelp();
    return { options: null, template: null };
  }

  return { options, template: null };
}

function printHelp() {
  console.log(`
🎬 Short Video Generation Tool - TikTok/YouTube Shorts/Instagram Reels

Usage:
  npm run generate-video -- --images="img1.png,img2.png" [options]
  npm run generate-video -- --template=miyabi-intro

Options:
  --images=<paths>      Comma-separated image paths (required if not using template)
  --audio=<path>        Audio file path (WAV/MP3)
  --output=<path>       Output video path (default: assets/generated-videos/)
  --duration=<seconds>  Duration per image (default: 3)
  --width=<pixels>      Video width (default: 1080 for 9:16)
  --height=<pixels>     Video height (default: 1920 for 9:16)
  --title=<text>        Title overlay
  --subtitle=<text>     Subtitle overlay
  --transition=<type>   Transition type: fade, slide, none (default: fade)
  --template=<name>     Use predefined template
  --help, -h            Show this help

Available Templates:
  miyabi-intro          Miyabi introduction video (3 images + TTS)
  tutorial              Tutorial video template
  feature-showcase      Feature showcase template

Examples:
  # Basic video from images
  npm run generate-video -- --images="./assets/img1.png,./assets/img2.png,./assets/img3.png"

  # Video with audio
  npm run generate-video -- \\
    --images="./assets/img1.png,./assets/img2.png" \\
    --audio="./assets/narration.wav" \\
    --output="./my-video.mp4"

  # Video with text overlay
  npm run generate-video -- \\
    --images="./assets/miyabi-intro.png" \\
    --title="Miyabi" \\
    --subtitle="見えないアシスタント" \\
    --duration=5

  # Use template
  npm run generate-video -- --template=miyabi-intro

Requirements:
  - FFmpeg must be installed (check with: ffmpeg -version)
  - For templates with TTS: generate-speech script must be available
`);
}

// ============================================================================
// Main Execution
// ============================================================================

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { options, template } = parseArgs();

  if (!options && !template) {
    process.exit(1);
  }

  const execute = template
    ? generateVideoFromTemplate(template)
    : generateVideo(options!);

  execute
    .then((outputPath) => {
      console.log(`\n🎉 Success! Video generated: ${outputPath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    });
}
