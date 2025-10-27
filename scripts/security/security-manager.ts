#!/usr/bin/env tsx
/**
 * Security Manager - セキュリティとアクセス制御の管理
 *
 * 機能:
 * - CODEOWNERS ファイル生成
 * - ブランチ保護ルール管理
 * - シークレットスキャン統合
 * - 依存関係の脆弱性チェック
 * - セキュリティポリシー適用
 */

import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface SecurityConfig {
  owner: string;
  repo: string;
  githubToken: string;
}

interface VulnerabilityReport {
  severity: 'critical' | 'high' | 'moderate' | 'low';
  package: string;
  version: string;
  title: string;
  url?: string;
  fixAvailable?: boolean;
}

interface SecretScanResult {
  file: string;
  line: number;
  type: string;
  detected: string;
}

interface BranchProtectionRule {
  branch: string;
  requiredReviews: number;
  requireCodeOwnerReviews: boolean;
  dismissStaleReviews: boolean;
  requireStatusChecks: boolean;
  requiredStatusChecks: string[];
  enforceAdmins: boolean;
  restrictPushes: boolean;
  allowedPushers: string[];
}

export class SecurityManager {
  private octokit: Octokit;
  private config: SecurityConfig;
  private projectRoot: string;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.githubToken });
    this.projectRoot = process.cwd();
  }

  // ============================================================================
  // CODEOWNERS Management
  // ============================================================================

  /**
   * CODEOWNERS ファイルを生成
   */
  async generateCodeowners(): Promise<void> {
    console.log('🔐 Generating CODEOWNERS file...');

    const codeownersContent = this.buildCodeownersContent();
    const codeownersPath = path.join(this.projectRoot, 'CODEOWNERS');

    await fs.promises.writeFile(codeownersPath, codeownersContent, 'utf-8');

    console.log(`✅ CODEOWNERS file created: ${codeownersPath}`);
  }

  /**
   * CODEOWNERS の内容を構築
   */
  private buildCodeownersContent(): string {
    return `# CODEOWNERS - Code ownership and review requirements
#
# Each line represents a file pattern and the owners who should review changes
# Patterns follow the same syntax as .gitignore files
#
# More info: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners

# ============================================================================
# Global Owners (Default reviewers for everything)
# ============================================================================
* @ShunsukeHayashi

# ============================================================================
# Agent Code (AI Agents)
# ============================================================================
/agents/**                       @ShunsukeHayashi
/agents/coordinator/**           @ShunsukeHayashi
/agents/codegen/**               @ShunsukeHayashi
/agents/review/**                @ShunsukeHayashi
/agents/issue/**                 @ShunsukeHayashi
/agents/pr/**                    @ShunsukeHayashi
/agents/deployment/**            @ShunsukeHayashi

# ============================================================================
# Scripts and Automation
# ============================================================================
/scripts/**                      @ShunsukeHayashi
/scripts/security-manager.ts     @ShunsukeHayashi

# ============================================================================
# Workflows and CI/CD
# ============================================================================
/.github/workflows/**            @ShunsukeHayashi
/.github/workflows/security-audit.yml @ShunsukeHayashi

# ============================================================================
# Security and Configuration
# ============================================================================
/SECURITY.md                     @ShunsukeHayashi
/CODEOWNERS                      @ShunsukeHayashi
/.github/dependabot.yml          @ShunsukeHayashi

# ============================================================================
# Documentation
# ============================================================================
/docs/**                         @ShunsukeHayashi
/README.md                       @ShunsukeHayashi
/CONTRIBUTING.md                 @ShunsukeHayashi

# ============================================================================
# Package and Dependencies
# ============================================================================
/package.json                    @ShunsukeHayashi
/package-lock.json               @ShunsukeHayashi
/tsconfig.json                   @ShunsukeHayashi

# ============================================================================
# Knowledge Base
# ============================================================================
/knowledge-base/**               @ShunsukeHayashi

# ============================================================================
# Reports and Metrics
# ============================================================================
/reports/**                      @ShunsukeHayashi
`;
  }

  // ============================================================================
  // Branch Protection Rules
  // ============================================================================

  /**
   * ブランチ保護ルールを設定
   */
  async setupBranchProtection(): Promise<void> {
    console.log('🛡️ Setting up branch protection rules...');

    const rules: BranchProtectionRule[] = [
      {
        branch: 'main',
        requiredReviews: 1,
        requireCodeOwnerReviews: true,
        dismissStaleReviews: true,
        requireStatusChecks: true,
        requiredStatusChecks: [
          'test',
          'lint',
          'security-audit',
        ],
        enforceAdmins: false,
        restrictPushes: true,
        allowedPushers: ['ShunsukeHayashi'],
      },
      {
        branch: 'develop',
        requiredReviews: 1,
        requireCodeOwnerReviews: true,
        dismissStaleReviews: true,
        requireStatusChecks: true,
        requiredStatusChecks: ['test', 'lint'],
        enforceAdmins: false,
        restrictPushes: false,
        allowedPushers: [],
      },
    ];

    for (const rule of rules) {
      await this.applyBranchProtection(rule);
    }

    console.log('✅ Branch protection rules configured');
  }

  /**
   * 個別のブランチ保護ルールを適用
   */
  private async applyBranchProtection(rule: BranchProtectionRule): Promise<void> {
    try {
      await this.octokit.rest.repos.updateBranchProtection({
        owner: this.config.owner,
        repo: this.config.repo,
        branch: rule.branch,
        required_status_checks: rule.requireStatusChecks
          ? {
            strict: true,
            contexts: rule.requiredStatusChecks,
          }
          : null as any,
        enforce_admins: rule.enforceAdmins,
        required_pull_request_reviews: {
          dismissal_restrictions: {},
          dismiss_stale_reviews: rule.dismissStaleReviews,
          require_code_owner_reviews: rule.requireCodeOwnerReviews,
          required_approving_review_count: rule.requiredReviews,
        },
        restrictions: rule.restrictPushes
          ? {
            users: rule.allowedPushers,
            teams: [],
            apps: [],
          }
          : null as any,
      });

      console.log(`  ✓ Protected branch: ${rule.branch}`);
    } catch (error: any) {
      console.error(`  ✗ Failed to protect branch ${rule.branch}: ${error.message}`);
    }
  }

  // ============================================================================
  // Secret Scanning
  // ============================================================================

  /**
   * シークレットスキャンを実行
   */
  async scanForSecrets(): Promise<SecretScanResult[]> {
    console.log('🔍 Scanning for secrets...');

    const results: SecretScanResult[] = [];

    // パターンベースのシークレット検出
    const secretPatterns = [
      { type: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
      { type: 'API Key', pattern: /api[_-]?key[_-]?[=:]\s*['"]?[A-Za-z0-9_\-]{32,}['"]?/i },
      { type: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
      { type: 'Private Key', pattern: /-----BEGIN (RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY-----/ },
      { type: 'Password', pattern: /password[_-]?[=:]\s*['"]?[^\s'"]{8,}['"]?/i },
    ];

    // 検索対象のファイルを取得
    const files = await this.getTrackableFiles();

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          for (const { type, pattern } of secretPatterns) {
            const match = line.match(pattern);
            if (match) {
              results.push({
                file,
                line: i + 1,
                type,
                detected: `${match[0].substring(0, 20)  }...`,
              });
            }
          }
        }
      } catch (error) {
        // ファイル読み込みエラーは無視
      }
    }

    if (results.length > 0) {
      console.log(`⚠️  Found ${results.length} potential secrets`);
      results.forEach((r) => {
        console.log(`  - ${r.file}:${r.line} (${r.type})`);
      });
    } else {
      console.log('✅ No secrets detected');
    }

    return results;
  }

  /**
   * 追跡対象のファイルを取得
   */
  private async getTrackableFiles(): Promise<string[]> {
    try {
      const output = execSync('git ls-files', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });

      return output
        .split('\n')
        .filter((f) => f.trim())
        .filter((f) => !f.includes('node_modules'))
        .filter((f) => !f.includes('.git/'))
        .map((f) => path.join(this.projectRoot, f));
    } catch (error) {
      return [];
    }
  }

  // ============================================================================
  // Dependency Vulnerability Checks
  // ============================================================================

  /**
   * 依存関係の脆弱性をチェック
   */
  async checkDependencyVulnerabilities(): Promise<VulnerabilityReport[]> {
    console.log('🔎 Checking dependency vulnerabilities...');

    const vulnerabilities: VulnerabilityReport[] = [];

    try {
      // npm audit を実行
      const output = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });

      const auditResult = JSON.parse(output);

      // 脆弱性を解析
      if (auditResult.vulnerabilities) {
        for (const [pkgName, vuln] of Object.entries(auditResult.vulnerabilities)) {
          const v = vuln as any;

          vulnerabilities.push({
            severity: v.severity || 'moderate',
            package: pkgName,
            version: v.range || 'unknown',
            title: v.via?.[0]?.title || 'Unknown vulnerability',
            url: v.via?.[0]?.url,
            fixAvailable: v.fixAvailable || false,
          });
        }
      }
    } catch (error: any) {
      // npm audit はエラーコードを返すことがあるが、JSONは出力される
      try {
        const auditResult = JSON.parse(error.stdout || '{}');
        if (auditResult.vulnerabilities) {
          for (const [pkgName, vuln] of Object.entries(auditResult.vulnerabilities)) {
            const v = vuln as any;
            vulnerabilities.push({
              severity: v.severity || 'moderate',
              package: pkgName,
              version: v.range || 'unknown',
              title: v.via?.[0]?.title || 'Unknown vulnerability',
              url: v.via?.[0]?.url,
              fixAvailable: v.fixAvailable || false,
            });
          }
        }
      } catch (parseError) {
        console.error('Failed to parse npm audit output');
      }
    }

    if (vulnerabilities.length > 0) {
      console.log(`⚠️  Found ${vulnerabilities.length} vulnerabilities`);

      // 重要度別に集計
      const bySeverity = vulnerabilities.reduce((acc, v) => {
        acc[v.severity] = (acc[v.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('  Severity breakdown:');
      Object.entries(bySeverity).forEach(([severity, count]) => {
        console.log(`    - ${severity}: ${count}`);
      });
    } else {
      console.log('✅ No vulnerabilities found');
    }

    return vulnerabilities;
  }

  // ============================================================================
  // Security Policy Enforcement
  // ============================================================================

  /**
   * セキュリティポリシーを適用
   */
  async enforceSecurityPolicies(): Promise<{
    passed: boolean;
    violations: string[];
  }> {
    console.log('🔒 Enforcing security policies...');

    const violations: string[] = [];

    // 1. シークレットスキャン
    const secrets = await this.scanForSecrets();
    if (secrets.length > 0) {
      violations.push(`Found ${secrets.length} potential secrets in code`);
    }

    // 2. 脆弱性チェック
    const vulnerabilities = await this.checkDependencyVulnerabilities();
    const criticalVulns = vulnerabilities.filter((v) => v.severity === 'critical');
    const highVulns = vulnerabilities.filter((v) => v.severity === 'high');

    if (criticalVulns.length > 0) {
      violations.push(`Found ${criticalVulns.length} critical vulnerabilities`);
    }
    if (highVulns.length > 0) {
      violations.push(`Found ${highVulns.length} high severity vulnerabilities`);
    }

    // 3. SECURITY.md の存在確認
    const securityMdPath = path.join(this.projectRoot, 'SECURITY.md');
    if (!fs.existsSync(securityMdPath)) {
      violations.push('SECURITY.md file is missing');
    }

    // 4. CODEOWNERS の存在確認
    const codeownersPath = path.join(this.projectRoot, 'CODEOWNERS');
    if (!fs.existsSync(codeownersPath)) {
      violations.push('CODEOWNERS file is missing');
    }

    const passed = violations.length === 0;

    if (passed) {
      console.log('✅ All security policies passed');
    } else {
      console.log(`❌ Security policy violations (${violations.length}):`);
      violations.forEach((v) => console.log(`  - ${v}`));
    }

    return { passed, violations };
  }

  // ============================================================================
  // SBOM Generation (Software Bill of Materials)
  // ============================================================================

  /**
   * SBOM を生成
   */
  async generateSBOM(): Promise<void> {
    console.log('📋 Generating SBOM (Software Bill of Materials)...');

    try {
      const packageJson = JSON.parse(
        await fs.promises.readFile(
          path.join(this.projectRoot, 'package.json'),
          'utf-8',
        ),
      );

      const sbom = {
        bomFormat: 'CycloneDX',
        specVersion: '1.4',
        version: 1,
        metadata: {
          timestamp: new Date().toISOString(),
          component: {
            type: 'application',
            name: packageJson.name || 'unknown',
            version: packageJson.version || '0.0.0',
          },
        },
        components: [] as any[],
      };

      // 依存関係を追加
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [name, version] of Object.entries(allDeps)) {
        sbom.components.push({
          type: 'library',
          name,
          version: (version as string).replace(/^[\^~]/, ''),
          purl: `pkg:npm/${name}@${(version as string).replace(/^[\^~]/, '')}`,
        });
      }

      const sbomPath = path.join(this.projectRoot, 'reports', 'sbom.json');
      await fs.promises.mkdir(path.dirname(sbomPath), { recursive: true });
      await fs.promises.writeFile(sbomPath, JSON.stringify(sbom, null, 2));

      console.log(`✅ SBOM generated: ${sbomPath}`);
    } catch (error: any) {
      console.error(`Failed to generate SBOM: ${error.message}`);
    }
  }

  // ============================================================================
  // Security Report
  // ============================================================================

  /**
   * セキュリティレポートを生成してGitHub Issueに投稿
   */
  async postSecurityReport(): Promise<void> {
    console.log('📊 Generating security report...');

    const secrets = await this.scanForSecrets();
    const vulnerabilities = await this.checkDependencyVulnerabilities();
    const policyResult = await this.enforceSecurityPolicies();

    const report = this.formatSecurityReport(
      secrets,
      vulnerabilities,
      policyResult,
    );

    // GitHub Issue に投稿
    try {
      const issue = await this.octokit.rest.issues.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: `Security Audit Report - ${new Date().toISOString().split('T')[0]}`,
        body: report,
        labels: ['security', 'audit', 'automated'],
      });

      console.log(`✅ Security report posted: ${issue.data.html_url}`);
    } catch (error: any) {
      console.error(`Failed to post security report: ${error.message}`);
    }
  }

  /**
   * セキュリティレポートをフォーマット
   */
  private formatSecurityReport(
    secrets: SecretScanResult[],
    vulnerabilities: VulnerabilityReport[],
    policyResult: { passed: boolean; violations: string[] },
  ): string {
    const date = new Date().toISOString().split('T')[0];

    let report = `# Security Audit Report - ${date}

## Summary

- **Security Policy Status**: ${policyResult.passed ? '✅ PASSED' : '❌ FAILED'}
- **Secrets Detected**: ${secrets.length}
- **Vulnerabilities**: ${vulnerabilities.length}

`;

    // Policy Violations
    if (policyResult.violations.length > 0) {
      report += `## Policy Violations

`;
      policyResult.violations.forEach((v) => {
        report += `- ❌ ${v}\n`;
      });
      report += '\n';
    }

    // Secret Scan Results
    if (secrets.length > 0) {
      report += `## Detected Secrets

⚠️ **WARNING**: Potential secrets detected in the codebase!

| File | Line | Type |
|------|------|------|
`;
      secrets.forEach((s) => {
        report += `| ${s.file} | ${s.line} | ${s.type} |\n`;
      });
      report += '\n';
    }

    // Vulnerability Report
    if (vulnerabilities.length > 0) {
      const critical = vulnerabilities.filter((v) => v.severity === 'critical');
      const high = vulnerabilities.filter((v) => v.severity === 'high');
      const moderate = vulnerabilities.filter((v) => v.severity === 'moderate');
      const low = vulnerabilities.filter((v) => v.severity === 'low');

      report += `## Dependency Vulnerabilities

### By Severity

- 🔴 **Critical**: ${critical.length}
- 🟠 **High**: ${high.length}
- 🟡 **Moderate**: ${moderate.length}
- 🟢 **Low**: ${low.length}

`;

      if (critical.length > 0) {
        report += `### Critical Vulnerabilities

| Package | Version | Issue | Fix Available |
|---------|---------|-------|---------------|
`;
        critical.forEach((v) => {
          report += `| ${v.package} | ${v.version} | ${v.title} | ${v.fixAvailable ? '✅' : '❌'} |\n`;
        });
        report += '\n';
      }

      if (high.length > 0) {
        report += `### High Severity Vulnerabilities

| Package | Version | Issue | Fix Available |
|---------|---------|-------|---------------|
`;
        high.forEach((v) => {
          report += `| ${v.package} | ${v.version} | ${v.title} | ${v.fixAvailable ? '✅' : '❌'} |\n`;
        });
        report += '\n';
      }
    }

    report += `## Recommendations

`;

    if (secrets.length > 0) {
      report += `1. **Remove detected secrets immediately**
   - Review all detected secrets
   - Rotate compromised credentials
   - Use environment variables or secret management tools

`;
    }

    if (vulnerabilities.length > 0) {
      report += `2. **Update vulnerable dependencies**
   - Run \`npm audit fix\` to automatically fix vulnerabilities
   - Manually review and update packages with no automatic fix
   - Consider alternative packages if fixes are not available

`;
    }

    if (policyResult.violations.length > 0) {
      report += `3. **Address policy violations**
   - Resolve all security policy violations
   - Ensure required security files are present
   - Follow security best practices

`;
    }

    report += `## Next Steps

1. Review this report and prioritize fixes
2. Create issues for each critical finding
3. Implement fixes and validate
4. Re-run security audit to verify

---

🤖 Generated by Security Manager
`;

    return report;
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'audit';

  const config: SecurityConfig = {
    owner: process.env.GITHUB_OWNER || 'ShunsukeHayashi',
    repo: process.env.GITHUB_REPO || 'Autonomous-Operations',
    githubToken: process.env.GITHUB_TOKEN || '',
  };

  if (!config.githubToken) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const manager = new SecurityManager(config);

  switch (command) {
    case 'audit':
      await manager.enforceSecurityPolicies();
      await manager.generateSBOM();
      break;

    case 'codeowners':
      await manager.generateCodeowners();
      break;

    case 'branch-protection':
      await manager.setupBranchProtection();
      break;

    case 'scan-secrets':
      await manager.scanForSecrets();
      break;

    case 'check-vulnerabilities':
      await manager.checkDependencyVulnerabilities();
      break;

    case 'sbom':
      await manager.generateSBOM();
      break;

    case 'report':
      await manager.postSecurityReport();
      break;

    case 'all':
      await manager.generateCodeowners();
      await manager.setupBranchProtection();
      await manager.enforceSecurityPolicies();
      await manager.generateSBOM();
      await manager.postSecurityReport();
      break;

    default:
      console.log(`
Usage: tsx scripts/security-manager.ts [command]

Commands:
  audit                 Run security audit (policies + SBOM)
  codeowners           Generate CODEOWNERS file
  branch-protection    Setup branch protection rules
  scan-secrets         Scan for secrets in code
  check-vulnerabilities Check dependency vulnerabilities
  sbom                 Generate Software Bill of Materials
  report               Generate and post security report
  all                  Run all security tasks

Environment Variables:
  GITHUB_TOKEN         GitHub Personal Access Token (required)
  GITHUB_OWNER         GitHub repository owner (default: ShunsukeHayashi)
  GITHUB_REPO          GitHub repository name (default: Autonomous-Operations)
`);
      break;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}
