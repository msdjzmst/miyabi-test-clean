/**
 * Security Validator for Dynamic Code Generation
 *
 * Validates generated code for dangerous patterns and security vulnerabilities
 */

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  /** Whether code is safe */
  safe: boolean;

  /** Detected security issues */
  issues: SecurityIssue[];

  /** Severity level (0-100, higher is more severe) */
  maxSeverity: number;

  /** Sanitized code (if fixable) */
  sanitizedCode?: string;
}

/**
 * Security issue
 */
export interface SecurityIssue {
  /** Issue type */
  type: SecurityIssueType;

  /** Severity (0-100) */
  severity: number;

  /** Issue description */
  message: string;

  /** Line number (if applicable) */
  line?: number;

  /** Code snippet */
  snippet?: string;

  /** Suggested fix */
  suggestedFix?: string;
}

/**
 * Security issue types
 */
export enum SecurityIssueType {
  EVAL_USAGE = 'eval_usage',
  EXEC_USAGE = 'exec_usage',
  REQUIRE_DYNAMIC = 'require_dynamic',
  CHILD_PROCESS = 'child_process',
  FILE_SYSTEM_WRITE = 'file_system_write',
  NETWORK_REQUEST = 'network_request',
  ENVIRONMENT_ACCESS = 'environment_access',
  GLOBAL_MODIFICATION = 'global_modification',
  PROTOTYPE_POLLUTION = 'prototype_pollution',
  ARBITRARY_CODE = 'arbitrary_code',
}

/**
 * Dangerous pattern definition
 */
interface DangerousPattern {
  pattern: RegExp;
  type: SecurityIssueType;
  severity: number;
  message: string;
  suggestedFix?: string;
}

/**
 * Dangerous code patterns
 */
const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // eval() - Critical
  {
    pattern: /\beval\s*\(/gi,
    type: SecurityIssueType.EVAL_USAGE,
    severity: 100,
    message: 'Usage of eval() is prohibited - can execute arbitrary code',
    suggestedFix: 'Use safer alternatives like JSON.parse() or explicit logic',
  },

  // Function constructor - Critical
  {
    pattern: /new\s+Function\s*\(/gi,
    type: SecurityIssueType.ARBITRARY_CODE,
    severity: 100,
    message: 'new Function() constructor can execute arbitrary code',
    suggestedFix: 'Use regular function declarations',
  },

  // exec() / execSync() - Critical
  {
    pattern: /\b(exec|execSync|spawn|spawnSync|fork|execFile|execFileSync)\s*\(/gi,
    type: SecurityIssueType.CHILD_PROCESS,
    severity: 95,
    message: 'Child process execution detected - potential command injection',
    suggestedFix: 'Avoid shell commands or use whitelisted commands only',
  },

  // require() with dynamic path - High
  {
    pattern: /require\s*\(\s*[^'"][^)]*\)/gi,
    type: SecurityIssueType.REQUIRE_DYNAMIC,
    severity: 80,
    message: 'Dynamic require() detected - can load arbitrary modules',
    suggestedFix: 'Use static imports or whitelist allowed modules',
  },

  // fs write operations - High
  {
    pattern: /\b(writeFile|writeFileSync|appendFile|appendFileSync|unlink|unlinkSync|rmdir|rmdirSync)\s*\(/gi,
    type: SecurityIssueType.FILE_SYSTEM_WRITE,
    severity: 75,
    message: 'File system write operation detected',
    suggestedFix: 'Restrict file operations to specific directories',
  },

  // Network requests - Medium
  {
    pattern: /\b(fetch|http\.request|https\.request|axios(\.\w+)?|XMLHttpRequest)\s*\(/gi,
    type: SecurityIssueType.NETWORK_REQUEST,
    severity: 60,
    message: 'Network request detected',
    suggestedFix: 'Whitelist allowed domains or use controlled API',
  },

  // Process/environment access - Medium
  {
    pattern: /\b(process\.env|process\.exit|process\.kill|process\.abort)\b/gi,
    type: SecurityIssueType.ENVIRONMENT_ACCESS,
    severity: 65,
    message: 'Process/environment access detected',
    suggestedFix: 'Limit access to environment variables',
  },

  // Global object modification - Medium
  {
    pattern: /\b(global\.|window\.|globalThis\.)\w+\s*=/gi,
    type: SecurityIssueType.GLOBAL_MODIFICATION,
    severity: 70,
    message: 'Global object modification detected',
    suggestedFix: 'Use local scope instead of modifying globals',
  },

  // Prototype pollution - High
  {
    pattern: /(__proto__|constructor\.prototype|Object\.prototype)\s*\[/gi,
    type: SecurityIssueType.PROTOTYPE_POLLUTION,
    severity: 85,
    message: 'Potential prototype pollution detected',
    suggestedFix: 'Use Object.create(null) or avoid dynamic prototype access',
  },
];

/**
 * Security Validator
 */
export class SecurityValidator {
  /**
   * Validate code for security issues
   */
  static validate(code: string): SecurityValidationResult {
    const issues: SecurityIssue[] = [];

    // Check each dangerous pattern
    for (const dangerousPattern of DANGEROUS_PATTERNS) {
      const matches = Array.from(code.matchAll(dangerousPattern.pattern));

      for (const match of matches) {
        const line = this.getLineNumber(code, match.index || 0);
        const snippet = this.getCodeSnippet(code, match.index || 0);

        issues.push({
          type: dangerousPattern.type,
          severity: dangerousPattern.severity,
          message: dangerousPattern.message,
          line,
          snippet,
          suggestedFix: dangerousPattern.suggestedFix,
        });
      }
    }

    // Calculate max severity
    const maxSeverity = issues.length > 0
      ? Math.max(...issues.map((issue) => issue.severity))
      : 0;

    // Code is safe if no critical issues (severity < 90)
    const safe = maxSeverity < 90;

    return {
      safe,
      issues,
      maxSeverity,
      sanitizedCode: safe ? code : undefined,
    };
  }

  /**
   * Validate and throw if unsafe
   */
  static validateOrThrow(code: string): void {
    const result = this.validate(code);

    if (!result.safe) {
      const criticalIssues = result.issues.filter((issue) => issue.severity >= 90);

      throw new Error(
        `Security validation failed: ${criticalIssues.length} critical issue(s) detected\n` +
        criticalIssues.map((issue) => `  - ${issue.message} (severity: ${issue.severity})`).join('\n')
      );
    }
  }

  /**
   * Check if code contains specific security issue type
   */
  static hasIssueType(code: string, type: SecurityIssueType): boolean {
    const result = this.validate(code);
    return result.issues.some((issue) => issue.type === type);
  }

  /**
   * Get security score (0-100, higher is better)
   */
  static getSecurityScore(code: string): number {
    const result = this.validate(code);

    if (result.issues.length === 0) {
      return 100;
    }

    // Calculate weighted score based on severity
    const totalSeverity = result.issues.reduce((sum, issue) => sum + issue.severity, 0);
    const avgSeverity = totalSeverity / result.issues.length;

    // Score = 100 - (average severity * issue count factor)
    const issueCountFactor = Math.min(result.issues.length / 5, 1); // Cap at 5 issues
    const score = 100 - (avgSeverity * (0.5 + 0.5 * issueCountFactor));

    return Math.max(0, Math.round(score));
  }

  /**
   * Get allowed patterns (whitelist)
   */
  static isWhitelisted(code: string): boolean {
    // Common safe patterns
    const whitelistPatterns = [
      /^\/\/.*$/gm, // Comments
      /^\/\*[\s\S]*?\*\/$/gm, // Block comments
      /^import\s+.*from\s+['"].*['"]/gm, // Static imports
      /^const\s+\w+\s*=/gm, // Const declarations
      /^let\s+\w+\s*=/gm, // Let declarations
      /^function\s+\w+/gm, // Function declarations
      /^class\s+\w+/gm, // Class declarations
    ];

    // Check if code only contains whitelisted patterns
    const cleanCode = code.trim();

    for (const pattern of whitelistPatterns) {
      if (pattern.test(cleanCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get line number from index
   */
  private static getLineNumber(code: string, index: number): number {
    const lines = code.substring(0, index).split('\n');
    return lines.length;
  }

  /**
   * Get code snippet around index
   */
  private static getCodeSnippet(code: string, index: number, contextLines: number = 2): string {
    const lines = code.split('\n');
    const lineNumber = this.getLineNumber(code, index);

    const startLine = Math.max(0, lineNumber - contextLines - 1);
    const endLine = Math.min(lines.length, lineNumber + contextLines);

    const snippet = lines.slice(startLine, endLine).join('\n');

    return snippet;
  }

  /**
   * Sanitize code by removing dangerous patterns (best effort)
   */
  static sanitize(code: string): { sanitized: string; removed: string[] } {
    let sanitized = code;
    const removed: string[] = [];

    // Remove eval() calls
    const evalPattern = /\beval\s*\([^)]*\)/gi;
    const evalMatches = Array.from(code.matchAll(evalPattern));
    for (const match of evalMatches) {
      sanitized = sanitized.replace(match[0], '/* REMOVED: eval() call */');
      removed.push(`eval() at line ${this.getLineNumber(code, match.index || 0)}`);
    }

    // Remove Function constructor
    const functionPattern = /new\s+Function\s*\([^)]*\)/gi;
    const functionMatches = Array.from(code.matchAll(functionPattern));
    for (const match of functionMatches) {
      sanitized = sanitized.replace(match[0], '/* REMOVED: Function constructor */');
      removed.push(`Function() at line ${this.getLineNumber(code, match.index || 0)}`);
    }

    // Remove child process calls
    const execPattern = /\b(exec|execSync|spawn|spawnSync)\s*\([^)]*\)/gi;
    const execMatches = Array.from(code.matchAll(execPattern));
    for (const match of execMatches) {
      sanitized = sanitized.replace(match[0], '/* REMOVED: child process call */');
      removed.push(`${match[1]}() at line ${this.getLineNumber(code, match.index || 0)}`);
    }

    return { sanitized, removed };
  }

  /**
   * Generate security report
   */
  static generateReport(code: string): string {
    const result = this.validate(code);
    const score = this.getSecurityScore(code);

    let report = '=== Security Validation Report ===\n\n';
    report += `Security Score: ${score}/100\n`;
    report += `Status: ${result.safe ? '✅ SAFE' : '❌ UNSAFE'}\n`;
    report += `Issues Found: ${result.issues.length}\n`;
    report += `Max Severity: ${result.maxSeverity}/100\n\n`;

    if (result.issues.length > 0) {
      report += 'Issues:\n';

      // Group by severity
      const critical = result.issues.filter((issue) => issue.severity >= 90);
      const high = result.issues.filter((issue) => issue.severity >= 70 && issue.severity < 90);
      const medium = result.issues.filter((issue) => issue.severity >= 50 && issue.severity < 70);
      const low = result.issues.filter((issue) => issue.severity < 50);

      if (critical.length > 0) {
        report += '\n🚨 CRITICAL:\n';
        critical.forEach((issue) => {
          report += `  - ${issue.message} (line ${issue.line})\n`;
          if (issue.suggestedFix) {
            report += `    Fix: ${issue.suggestedFix}\n`;
          }
        });
      }

      if (high.length > 0) {
        report += '\n⚠️  HIGH:\n';
        high.forEach((issue) => {
          report += `  - ${issue.message} (line ${issue.line})\n`;
        });
      }

      if (medium.length > 0) {
        report += '\n⚡ MEDIUM:\n';
        medium.forEach((issue) => {
          report += `  - ${issue.message} (line ${issue.line})\n`;
        });
      }

      if (low.length > 0) {
        report += '\nℹ️  LOW:\n';
        low.forEach((issue) => {
          report += `  - ${issue.message} (line ${issue.line})\n`;
        });
      }
    } else {
      report += '✅ No security issues detected.\n';
    }

    return report;
  }
}
