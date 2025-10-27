/**
 * Local project setup module
 *
 * Clone repository and initialize npm project
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LocalSetupOptions {
  skipInstall?: boolean;
  owner?: string; // Repository owner for .env template
  repo?: string;  // Repository name for .env template
}

/**
 * Clone repository and setup local project
 */
export async function cloneAndSetup(
  cloneUrl: string,
  projectName: string,
  options: LocalSetupOptions = {}
): Promise<void> {
  // Clone repository
  execSync(`git clone ${cloneUrl} ${projectName}`, {
    stdio: 'inherit',
  });

  const projectPath = path.join(process.cwd(), projectName);

  // Generate package.json
  await generatePackageJson(projectPath, projectName);

  // Generate tsconfig.json
  await generateTsConfig(projectPath);

  // Generate .gitignore
  await generateGitignore(projectPath);

  // Generate source directory with initial files
  await generateSourceDirectory(projectPath, projectName);

  // Generate test directory with example test
  await generateTestDirectory(projectPath, projectName);

  // Generate .env.example
  const repository = options.owner && options.repo ? `${options.owner}/${options.repo}` : 'owner/repo';
  await generateEnvExample(projectPath, repository);

  // Generate ESLint configuration
  await generateEslintConfig(projectPath);

  // Generate README.md
  await generateReadme(projectPath, projectName, repository);

  // Install dependencies
  if (!options.skipInstall) {
    execSync('npm install', {
      cwd: projectPath,
      stdio: 'inherit',
    });
  }
}

/**
 * Generate package.json
 */
async function generatePackageJson(projectPath: string, projectName: string): Promise<void> {
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    description: 'Autonomous development powered by Agentic OS',
    type: 'module',
    scripts: {
      dev: 'tsx src/index.ts',
      build: 'tsc',
      test: 'vitest',
      lint: 'eslint . --ext .ts,.tsx',
      typecheck: 'tsc --noEmit',
    },
    keywords: ['agentic-os', 'autonomous'],
    author: '',
    license: 'MIT',
    dependencies: {},
    devDependencies: {
      '@types/node': '^20.10.0',
      '@typescript-eslint/eslint-plugin': '^6.13.0',
      '@typescript-eslint/parser': '^6.13.0',
      eslint: '^8.54.0',
      tsx: '^4.7.0',
      typescript: '^5.8.3',
      vitest: '^3.2.4',
    },
  };

  fs.writeFileSync(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n'
  );
}

/**
 * Generate tsconfig.json
 */
async function generateTsConfig(projectPath: string): Promise<void> {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      lib: ['ES2022'],
      moduleResolution: 'node',
      esModuleInterop: true,
      resolveJsonModule: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  fs.writeFileSync(
    path.join(projectPath, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2) + '\n'
  );
}

/**
 * Generate .gitignore
 */
async function generateGitignore(projectPath: string): Promise<void> {
  const gitignore = `# Dependencies
node_modules/
package-lock.json

# Build output
dist/
*.tsbuildinfo

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;

  const gitignorePath = path.join(projectPath, '.gitignore');

  // Safely handle .gitignore (avoid TOCTOU race condition)
  try {
    // Try to read existing file
    const existing = fs.readFileSync(gitignorePath, 'utf-8');
    if (!existing.includes('# Agentic OS')) {
      // Append atomically using temp file + rename
      const tempPath = `${gitignorePath}.tmp`;
      fs.writeFileSync(tempPath, existing + '\n# Agentic OS\n' + gitignore, 'utf-8');
      fs.renameSync(tempPath, gitignorePath);
    }
  } catch (error: any) {
    // File doesn't exist, create new one
    if (error.code === 'ENOENT') {
      try {
        fs.writeFileSync(gitignorePath, gitignore, { encoding: 'utf-8', flag: 'wx' });
      } catch (writeError: any) {
        // Another process created it, ignore
        if (writeError.code !== 'EEXIST') {
          throw writeError;
        }
      }
    } else {
      throw error;
    }
  }
}

/**
 * Generate src/ directory with initial source file
 */
async function generateSourceDirectory(projectPath: string, projectName: string): Promise<void> {
  const srcDir = path.join(projectPath, 'src');

  // Create src directory
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // Load template
  const templatePath = path.join(__dirname, '../../templates/src-template/index.ts');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Source template not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const renderedContent = templateContent.replace(/{{PROJECT_NAME}}/g, projectName);

  // Write index.ts
  const indexPath = path.join(srcDir, 'index.ts');
  const tempPath = `${indexPath}.tmp`;
  fs.writeFileSync(tempPath, renderedContent, { encoding: 'utf-8', mode: 0o644 });
  fs.renameSync(tempPath, indexPath);
}

/**
 * Generate tests/ directory with example test
 */
async function generateTestDirectory(projectPath: string, projectName: string): Promise<void> {
  const testsDir = path.join(projectPath, 'tests');

  // Create tests directory
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }

  // Load template
  const templatePath = path.join(__dirname, '../../templates/test-template/example.test.ts');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Test template not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const renderedContent = templateContent.replace(/{{PROJECT_NAME}}/g, projectName);

  // Write example.test.ts
  const testPath = path.join(testsDir, 'example.test.ts');
  const tempPath = `${testPath}.tmp`;
  fs.writeFileSync(tempPath, renderedContent, { encoding: 'utf-8', mode: 0o644 });
  fs.renameSync(tempPath, testPath);
}

/**
 * Generate .env.example from template
 */
async function generateEnvExample(projectPath: string, repository: string): Promise<void> {
  // Load template
  const templatePath = path.join(__dirname, '../../templates/.env.example.template');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`.env.example template not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const renderedContent = templateContent.replace(/{{REPOSITORY}}/g, repository);

  // Write .env.example
  const envPath = path.join(projectPath, '.env.example');
  const tempPath = `${envPath}.tmp`;
  fs.writeFileSync(tempPath, renderedContent, { encoding: 'utf-8', mode: 0o644 });
  fs.renameSync(tempPath, envPath);
}

/**
 * Generate ESLint configuration
 */
async function generateEslintConfig(projectPath: string): Promise<void> {
  // Load template
  const templatePath = path.join(__dirname, '../../templates/eslintrc.json.template');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`ESLint template not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  // Write .eslintrc.json
  const eslintPath = path.join(projectPath, '.eslintrc.json');
  const tempPath = `${eslintPath}.tmp`;
  fs.writeFileSync(tempPath, templateContent, { encoding: 'utf-8', mode: 0o644 });
  fs.renameSync(tempPath, eslintPath);
}

/**
 * Generate README.md from template
 */
async function generateReadme(projectPath: string, projectName: string, repository: string): Promise<void> {
  // Load template
  const templatePath = path.join(__dirname, '../../templates/README.md.template');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`README template not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const renderedContent = templateContent
    .replace(/{{PROJECT_NAME}}/g, projectName)
    .replace(/{{REPOSITORY}}/g, repository);

  // Write README.md
  const readmePath = path.join(projectPath, 'README.md');

  // Check if README already exists (GitHub auto-generates one)
  if (fs.existsSync(readmePath)) {
    // Backup existing README
    const backupPath = path.join(projectPath, 'README.github.md');
    fs.renameSync(readmePath, backupPath);
  }

  const tempPath = `${readmePath}.tmp`;
  fs.writeFileSync(tempPath, renderedContent, { encoding: 'utf-8', mode: 0o644 });
  fs.renameSync(tempPath, readmePath);
}
