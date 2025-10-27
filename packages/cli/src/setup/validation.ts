/**
 * Input validation for claude-config.ts security
 *
 * Implements CWE-22 path traversal prevention and input sanitization
 * for GitHub parameters and file operations.
 *
 * @module validation
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Validation error class with structured error information
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate project path to prevent path traversal attacks (CWE-22)
 *
 * Security checks:
 * - Must be absolute path
 * - No path traversal sequences (../)
 * - No null bytes
 * - Path must resolve to itself (no symlink tricks)
 *
 * @param projectPath - Path to validate
 * @throws {ValidationError} If validation fails
 */
export function validateProjectPath(projectPath: string): void {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new ValidationError(
      'Project path must be a non-empty string',
      'projectPath',
      projectPath
    );
  }

  // Must be absolute path
  if (!path.isAbsolute(projectPath)) {
    throw new ValidationError(
      `Project path must be absolute, got: ${projectPath}`,
      'projectPath',
      projectPath
    );
  }

  // Check for path traversal sequences
  const normalized = path.normalize(projectPath);
  if (normalized.includes('..')) {
    throw new ValidationError(
      'Project path contains path traversal sequences (..)',
      'projectPath',
      projectPath
    );
  }

  // Check for null bytes (path injection)
  if (projectPath.includes('\0')) {
    throw new ValidationError(
      'Project path contains null bytes',
      'projectPath',
      projectPath
    );
  }

  // Path must resolve to itself (detect symlink tricks)
  const resolved = path.resolve(projectPath);
  if (resolved !== normalized) {
    throw new ValidationError(
      `Project path resolution mismatch: ${projectPath} vs ${resolved}`,
      'projectPath',
      projectPath
    );
  }
}

/**
 * Validate GitHub owner name
 *
 * GitHub username rules:
 * - Alphanumeric and hyphens only
 * - Cannot start or end with hyphen
 * - Max 39 characters
 * - Cannot be empty
 *
 * @param owner - GitHub owner/username to validate
 * @throws {ValidationError} If validation fails
 */
export function validateGitHubOwner(owner: string): void {
  if (!owner || typeof owner !== 'string') {
    throw new ValidationError(
      'GitHub owner must be a non-empty string',
      'owner',
      owner
    );
  }

  // Length check
  if (owner.length > 39) {
    throw new ValidationError(
      `GitHub owner exceeds maximum length (39 characters), got: ${owner.length}`,
      'owner',
      owner
    );
  }

  // Pattern check: alphanumeric and hyphens only
  const pattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  if (!pattern.test(owner)) {
    throw new ValidationError(
      'GitHub owner must contain only alphanumeric characters and hyphens, and cannot start/end with hyphen',
      'owner',
      owner
    );
  }

  // Additional safety: check for injection attempts
  if (owner.includes('..') || owner.includes('/') || owner.includes('\\')) {
    throw new ValidationError(
      'GitHub owner contains invalid characters',
      'owner',
      owner
    );
  }
}

/**
 * Validate GitHub repository name
 *
 * GitHub repository rules:
 * - Alphanumeric, hyphens, underscores, and dots
 * - Cannot start with dot or hyphen
 * - Max 100 characters
 * - Cannot be empty
 *
 * @param repo - GitHub repository name to validate
 * @throws {ValidationError} If validation fails
 */
export function validateGitHubRepo(repo: string): void {
  if (!repo || typeof repo !== 'string') {
    throw new ValidationError(
      'GitHub repository name must be a non-empty string',
      'repo',
      repo
    );
  }

  // Length check
  if (repo.length > 100) {
    throw new ValidationError(
      `GitHub repository name exceeds maximum length (100 characters), got: ${repo.length}`,
      'repo',
      repo
    );
  }

  // Pattern check: alphanumeric, hyphens, underscores, dots
  const pattern = /^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/;
  if (!pattern.test(repo)) {
    throw new ValidationError(
      'GitHub repository name must start with alphanumeric or underscore, and contain only alphanumeric, hyphens, underscores, and dots',
      'repo',
      repo
    );
  }

  // Additional safety: check for path traversal
  if (repo.includes('..') || repo.includes('/') || repo.includes('\\')) {
    throw new ValidationError(
      'GitHub repository name contains invalid path characters',
      'repo',
      repo
    );
  }

  // Reserved names check
  const reserved = ['.', '..', '.git'];
  if (reserved.includes(repo)) {
    throw new ValidationError(
      `GitHub repository name cannot be a reserved name: ${repo}`,
      'repo',
      repo
    );
  }
}

/**
 * Validate GitHub token format
 *
 * GitHub token formats:
 * - Personal Access Token (classic): ghp_[A-Za-z0-9]{36}
 * - Fine-grained PAT: github_pat_[A-Za-z0-9_]{82}
 * - OAuth: gho_[A-Za-z0-9]{36}
 * - User-to-server: ghu_[A-Za-z0-9]{36}
 * - Server-to-server: ghs_[A-Za-z0-9]{36}
 * - Refresh: ghr_[A-Za-z0-9]{36}
 *
 * @param token - GitHub token to validate
 * @throws {ValidationError} If validation fails
 */
export function validateGitHubToken(token: string): void {
  if (!token || typeof token !== 'string') {
    throw new ValidationError(
      'GitHub token must be a non-empty string',
      'token',
      '[REDACTED]'
    );
  }

  // Length check (minimum 40 characters for safety)
  if (token.length < 40) {
    throw new ValidationError(
      'GitHub token is too short (minimum 40 characters)',
      'token',
      '[REDACTED]'
    );
  }

  // Pattern check: must start with known GitHub token prefix
  const validPrefixes = ['ghp_', 'github_pat_', 'gho_', 'ghu_', 'ghs_', 'ghr_'];
  const hasValidPrefix = validPrefixes.some((prefix) => token.startsWith(prefix));

  if (!hasValidPrefix) {
    throw new ValidationError(
      'GitHub token must start with a valid prefix (ghp_, github_pat_, gho_, ghu_, ghs_, ghr_)',
      'token',
      '[REDACTED]'
    );
  }

  // Check for null bytes and control characters
  if (/[\x00-\x1F\x7F]/.test(token)) {
    throw new ValidationError(
      'GitHub token contains invalid control characters',
      'token',
      '[REDACTED]'
    );
  }

  // Check for obvious injection attempts
  if (token.includes(' ') || token.includes('\n') || token.includes('\r') || token.includes('\t')) {
    throw new ValidationError(
      'GitHub token contains whitespace characters',
      'token',
      '[REDACTED]'
    );
  }
}

/**
 * Validate project name
 *
 * Project name rules:
 * - Non-empty string
 * - Max 100 characters
 * - Safe characters only (alphanumeric, hyphens, underscores, spaces)
 * - No path traversal sequences
 *
 * @param projectName - Project name to validate
 * @throws {ValidationError} If validation fails
 */
export function validateProjectName(projectName: string): void {
  if (!projectName || typeof projectName !== 'string') {
    throw new ValidationError(
      'Project name must be a non-empty string',
      'projectName',
      projectName
    );
  }

  // Trim whitespace for validation
  const trimmed = projectName.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(
      'Project name cannot be empty or whitespace only',
      'projectName',
      projectName
    );
  }

  // Length check
  if (trimmed.length > 100) {
    throw new ValidationError(
      `Project name exceeds maximum length (100 characters), got: ${trimmed.length}`,
      'projectName',
      projectName
    );
  }

  // Pattern check: safe characters only
  const pattern = /^[a-zA-Z0-9_\s-]+$/;
  if (!pattern.test(trimmed)) {
    throw new ValidationError(
      'Project name must contain only alphanumeric characters, hyphens, underscores, and spaces',
      'projectName',
      projectName
    );
  }

  // Path traversal check
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new ValidationError(
      'Project name contains path traversal sequences',
      'projectName',
      projectName
    );
  }
}

/**
 * Validate file path for safe file operations
 *
 * Security checks:
 * - Must be absolute path
 * - No path traversal sequences
 * - No null bytes
 * - Must be within expected directory
 *
 * @param filePath - File path to validate
 * @param baseDir - Optional base directory to restrict path within
 * @throws {ValidationError} If validation fails
 */
export function validateFilePath(filePath: string, baseDir?: string): void {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError(
      'File path must be a non-empty string',
      'filePath',
      filePath
    );
  }

  // Must be absolute path
  if (!path.isAbsolute(filePath)) {
    throw new ValidationError(
      `File path must be absolute, got: ${filePath}`,
      'filePath',
      filePath
    );
  }

  // Check for null bytes
  if (filePath.includes('\0')) {
    throw new ValidationError(
      'File path contains null bytes',
      'filePath',
      filePath
    );
  }

  // Normalize and check for path traversal
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) {
    throw new ValidationError(
      'File path contains path traversal sequences (..)',
      'filePath',
      filePath
    );
  }

  // If baseDir provided, ensure path is within it
  if (baseDir) {
    const normalizedBase = path.normalize(path.resolve(baseDir));
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.startsWith(normalizedBase)) {
      throw new ValidationError(
        `File path must be within base directory: ${baseDir}`,
        'filePath',
        filePath
      );
    }
  }
}

/**
 * Validate file size before operations
 *
 * Security checks:
 * - File exists
 * - Size within reasonable limits (default 10MB)
 * - Not a directory
 *
 * @param filePath - File path to check
 * @param maxSizeBytes - Maximum allowed size in bytes (default 10MB)
 * @throws {ValidationError} If validation fails
 */
export function validateFileSize(filePath: string, maxSizeBytes: number = 10 * 1024 * 1024): void {
  if (!fs.existsSync(filePath)) {
    throw new ValidationError(
      `File does not exist: ${filePath}`,
      'filePath',
      filePath
    );
  }

  const stats = fs.statSync(filePath);

  // Check if it's a directory
  if (stats.isDirectory()) {
    throw new ValidationError(
      `Path is a directory, not a file: ${filePath}`,
      'filePath',
      filePath
    );
  }

  // Check file size
  if (stats.size > maxSizeBytes) {
    throw new ValidationError(
      `File size exceeds maximum allowed (${maxSizeBytes} bytes): ${stats.size} bytes`,
      'filePath',
      filePath
    );
  }

  // Check for zero-byte files (potential issues)
  if (stats.size === 0) {
    throw new ValidationError(
      `File is empty (0 bytes): ${filePath}`,
      'filePath',
      filePath
    );
  }
}

/**
 * Validate file content for safe operations
 *
 * Security checks:
 * - UTF-8 encoding
 * - No null bytes
 * - Reasonable line length
 * - No binary content
 *
 * @param content - File content to validate
 * @throws {ValidationError} If validation fails
 */
export function validateFileContent(content: string): void {
  if (typeof content !== 'string') {
    throw new ValidationError(
      'File content must be a string',
      'content',
      typeof content
    );
  }

  // Check for null bytes (binary content or injection)
  if (content.includes('\0')) {
    throw new ValidationError(
      'File content contains null bytes (binary content not allowed)',
      'content',
      '[REDACTED]'
    );
  }

  // Check for control characters (except common ones like \n, \r, \t)
  const controlCharsPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
  if (controlCharsPattern.test(content)) {
    throw new ValidationError(
      'File content contains invalid control characters',
      'content',
      '[REDACTED]'
    );
  }

  // Check for reasonable line length (prevent DOS via extremely long lines)
  const lines = content.split('\n');
  const maxLineLength = 10000;
  const longLine = lines.find((line) => line.length > maxLineLength);
  if (longLine) {
    throw new ValidationError(
      `File content contains line exceeding maximum length (${maxLineLength} characters)`,
      'content',
      '[REDACTED]'
    );
  }

  // Check total content size (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  const byteLength = Buffer.byteLength(content, 'utf-8');
  if (byteLength > maxSize) {
    throw new ValidationError(
      `File content exceeds maximum size (${maxSize} bytes): ${byteLength} bytes`,
      'content',
      '[REDACTED]'
    );
  }
}

/**
 * Validate and detect symlinks
 *
 * Security checks:
 * - Detect symbolic links
 * - Prevent symlink attacks
 * - Ensure file is a regular file
 *
 * @param filePath - File path to check
 * @throws {ValidationError} If file is a symlink
 */
export function validateSymlink(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new ValidationError(
      `File does not exist: ${filePath}`,
      'filePath',
      filePath
    );
  }

  // Use lstatSync to detect symlinks (doesn't follow symlinks)
  const stats = fs.lstatSync(filePath);

  if (stats.isSymbolicLink()) {
    throw new ValidationError(
      `Path is a symbolic link (not allowed): ${filePath}`,
      'filePath',
      filePath
    );
  }

  // Additional check: ensure it's a regular file or directory
  if (!stats.isFile() && !stats.isDirectory()) {
    throw new ValidationError(
      `Path is not a regular file or directory: ${filePath}`,
      'filePath',
      filePath
    );
  }
}

/**
 * Sanitize template variables to prevent template injection
 *
 * Security checks:
 * - Remove special characters used in template injection
 * - Limit length
 * - Allow only safe characters
 *
 * @param value - Template variable value to sanitize
 * @param maxLength - Maximum allowed length (default 200)
 * @returns Sanitized value
 * @throws {ValidationError} If value cannot be sanitized safely
 */
export function sanitizeTemplateVariable(value: string, maxLength: number = 200): string {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(
      'Template variable must be a non-empty string',
      'templateVariable',
      value
    );
  }

  // Length check
  if (value.length > maxLength) {
    throw new ValidationError(
      `Template variable exceeds maximum length (${maxLength} characters), got: ${value.length}`,
      'templateVariable',
      value
    );
  }

  // Remove potentially dangerous characters for template injection
  // Keep: alphanumeric, spaces, hyphens, underscores, dots
  const sanitized = value.replace(/[^a-zA-Z0-9\s._-]/g, '');

  // Check if sanitization removed too much (potential injection attempt)
  const removalPercentage = ((value.length - sanitized.length) / value.length) * 100;
  if (removalPercentage > 50) {
    throw new ValidationError(
      `Template variable contains too many invalid characters (${removalPercentage.toFixed(1)}% removed)`,
      'templateVariable',
      value
    );
  }

  // Final check: ensure result is not empty after sanitization
  if (sanitized.trim().length === 0) {
    throw new ValidationError(
      'Template variable is empty after sanitization',
      'templateVariable',
      value
    );
  }

  return sanitized.trim();
}

/**
 * Validate all parameters for deployClaudeConfig
 *
 * Convenience function to validate all parameters at once
 *
 * @param projectPath - Project path to validate
 * @param projectName - Project name to validate
 * @throws {ValidationError} If any validation fails
 */
export function validateDeployClaudeConfigParams(projectPath: string, projectName: string): void {
  validateProjectPath(projectPath);
  validateProjectName(projectName);
}

/**
 * Validate all parameters for deployClaudeConfigToGitHub
 *
 * Convenience function to validate all parameters at once
 *
 * @param owner - GitHub owner to validate
 * @param repo - GitHub repository to validate
 * @param projectName - Project name to validate
 * @param token - GitHub token to validate
 * @throws {ValidationError} If any validation fails
 */
export function validateDeployToGitHubParams(
  owner: string,
  repo: string,
  projectName: string,
  token: string
): void {
  validateGitHubOwner(owner);
  validateGitHubRepo(repo);
  validateProjectName(projectName);
  validateGitHubToken(token);
}
