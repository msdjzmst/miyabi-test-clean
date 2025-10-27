/**
 * Global configuration management
 * Manages ~/.miyabi/ directory for user-wide settings
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';

/**
 * Global config directory path
 */
export const GLOBAL_CONFIG_DIR = join(homedir(), '.miyabi');

/**
 * Marker file for first-run detection
 */
export const FIRST_RUN_MARKER = join(GLOBAL_CONFIG_DIR, '.first-run');

/**
 * Global config file
 */
export const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'config.json');

/**
 * Global state file
 */
export const GLOBAL_STATE_FILE = join(GLOBAL_CONFIG_DIR, 'state.json');

/**
 * Global config structure
 */
export interface GlobalConfig {
  version: string;
  installedAt: string;
  lastUsed?: string;
  onboardingCompleted?: boolean;
  preferences?: {
    language?: 'ja' | 'en';
    autoUpdate?: boolean;
    telemetry?: boolean;
  };
}

/**
 * Global state structure
 */
export interface GlobalState {
  projectsCreated: number;
  projectsInstalled: number;
  lastProject?: string;
  totalCommands: number;
}

/**
 * Initialize global config directory
 */
export function initGlobalConfig(): void {
  if (!existsSync(GLOBAL_CONFIG_DIR)) {
    mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true, mode: 0o755 });
  }
}

/**
 * Check if this is the first run
 */
export function isFirstRun(): boolean {
  return !existsSync(FIRST_RUN_MARKER);
}

/**
 * Mark first run as complete
 */
export function markFirstRunComplete(): void {
  initGlobalConfig();
  writeFileSync(FIRST_RUN_MARKER, new Date().toISOString(), 'utf-8');
}

/**
 * Load global config
 */
export function loadGlobalConfig(): GlobalConfig | null {
  if (!existsSync(GLOBAL_CONFIG_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as GlobalConfig;
  } catch (error) {
    return null;
  }
}

/**
 * Save global config
 */
export function saveGlobalConfig(config: GlobalConfig): void {
  initGlobalConfig();
  writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Load global state
 */
export function loadGlobalState(): GlobalState {
  if (!existsSync(GLOBAL_STATE_FILE)) {
    return {
      projectsCreated: 0,
      projectsInstalled: 0,
      totalCommands: 0,
    };
  }

  try {
    const content = readFileSync(GLOBAL_STATE_FILE, 'utf-8');
    return JSON.parse(content) as GlobalState;
  } catch (error) {
    return {
      projectsCreated: 0,
      projectsInstalled: 0,
      totalCommands: 0,
    };
  }
}

/**
 * Save global state
 */
export function saveGlobalState(state: GlobalState): void {
  initGlobalConfig();
  writeFileSync(GLOBAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Increment project created counter
 */
export function incrementProjectsCreated(): void {
  const state = loadGlobalState();
  state.projectsCreated += 1;
  saveGlobalState(state);
}

/**
 * Increment project installed counter
 */
export function incrementProjectsInstalled(): void {
  const state = loadGlobalState();
  state.projectsInstalled += 1;
  saveGlobalState(state);
}

/**
 * Update last used timestamp
 */
export function updateLastUsed(): void {
  const config = loadGlobalConfig();
  if (config) {
    config.lastUsed = new Date().toISOString();
    saveGlobalConfig(config);
  }
}

/**
 * Increment total commands counter
 */
export function incrementCommandCounter(): void {
  const state = loadGlobalState();
  state.totalCommands += 1;
  saveGlobalState(state);
}

/**
 * Get stats summary
 */
export function getStatsSummary(): GlobalState {
  return loadGlobalState();
}
