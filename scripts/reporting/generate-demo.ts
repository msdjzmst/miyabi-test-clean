import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@miyabi/coding-agents/ui/index';

/**
 * Demo generation script for creating screenshots and GIFs
 * Captures the Miyabi CLI in action for documentation purposes
 */
export class DemoGenerator {
  private readonly assetsDir = path.join(process.cwd(), 'assets');
  private readonly screenshotsDir = path.join(this.assetsDir, 'screenshots');
  private readonly gifsDir = path.join(this.assetsDir, 'gifs');

  constructor() {
    this.ensureDirectories();
  }

  /**
   * Ensure asset directories exist
   */
  private ensureDirectories(): void {
    [this.assetsDir, this.screenshotsDir, this.gifsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Generate all demo assets
   */
  public async generateAll(): Promise<void> {
    logger.info('Generating demo assets...');

    try {
      await this.captureQuickStart();
      await this.captureAgentWorkflow();
      await this.captureProjectStructure();
      await this.generateArchitectureDiagram();

      logger.success('Demo assets generated successfully!');
    } catch (error) {
      logger.error('Failed to generate demo assets:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Capture quick start demo
   */
  private async captureQuickStart(): Promise<void> {
    // Generate terminal recording script
    const scriptPath = path.join(this.assetsDir, 'quickstart-demo.sh');
    const script = `#!/bin/bash
# Miyabi Quick Start Demo
echo "🌸 Miyabi - Beauty in Autonomous Development"
echo "=========================================="
sleep 2

echo "$ npx miyabi --help"
sleep 1
npx miyabi --help
sleep 3

echo ""
echo "$ npx miyabi init demo-project"
sleep 1
npx miyabi init demo-project
sleep 2

echo ""
echo "$ cd demo-project && npx miyabi"
sleep 1
cd demo-project && npx miyabi
`;

    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, '755');

    logger.info('Quick start demo script generated');
  }

  /**
   * Capture agent workflow demonstration
   */
  private async captureAgentWorkflow(): Promise<void> {
    const workflowScript = `#!/bin/bash
# Miyabi Agent Workflow Demo
echo "🤖 Miyabi AI Agents in Action"
echo "============================="
sleep 2

echo "Initializing project with AI assistance..."
npx miyabi init ai-demo --template typescript
sleep 3

echo ""
echo "Running autonomous development cycle..."
cd ai-demo
npx miyabi develop --feature "user authentication"
sleep 5

echo ""
echo "AI agents collaborating on code generation..."
sleep 2
echo "✅ PlannerAgent: Creating development roadmap"
sleep 1
echo "✅ DeveloperAgent: Generating code structure"  
sleep 1
echo "✅ ReviewerAgent: Analyzing code quality"
sleep 1
echo "✅ TestAgent: Creating comprehensive tests"
sleep 1
echo "✅ DocumentationAgent: Updating documentation"
sleep 2

echo ""
echo "🎉 Feature completed successfully!"
`;

    const scriptPath = path.join(this.assetsDir, 'workflow-demo.sh');
    fs.writeFileSync(scriptPath, workflowScript);
    fs.chmodSync(scriptPath, '755');

    logger.info('Agent workflow demo script generated');
  }

  /**
   * Capture project structure visualization
   */
  private async captureProjectStructure(): Promise<void> {
    const structureDemo = `#!/bin/bash
# Miyabi Project Structure Demo
echo "📁 Miyabi Generated Project Structure"
echo "===================================="
sleep 2

echo "Creating new project..."
npx miyabi init structure-demo --verbose
cd structure-demo

echo ""
echo "Generated project structure:"
tree -I 'node_modules|.git' -L 3

echo ""
echo "Key files created by Miyabi:"
echo "├── 📄 README.md (AI-generated)"
echo "├── 🔧 package.json (optimized dependencies)"
echo "├── 📝 tsconfig.json (strict TypeScript config)"
echo "├── 🧪 jest.config.js (testing setup)"
echo "├── 🏗️ src/"
echo "│   ├── 🎯 index.ts (main entry point)"
echo "│   ├── 🧩 types/ (comprehensive type definitions)"
echo "│   ├── 🤖 agents/ (AI agent implementations)"
echo "│   └── 🧪 __tests__/ (generated tests)"
echo "└── 📚 docs/ (auto-generated documentation)"
`;

    const scriptPath = path.join(this.assetsDir, 'structure-demo.sh');
    fs.writeFileSync(scriptPath, structureDemo);
    fs.chmodSync(scriptPath, '755');

    logger.info('Project structure demo script generated');
  }

  /**
   * Generate architecture diagram
   */
  private async generateArchitectureDiagram(): Promise<void> {
    const diagram = `
# Miyabi Architecture Overview

\`\`\`mermaid
graph TB
    CLI[🌸 Miyabi CLI] --> Core[Core Engine]
    
    Core --> PM[Project Manager]
    Core --> AM[Agent Manager] 
    Core --> UM[UI Manager]
    
    AM --> PA[🎯 PlannerAgent]
    AM --> DA[👨‍💻 DeveloperAgent]  
    AM --> RA[🔍 ReviewerAgent]
    AM --> TA[🧪 TestAgent]
    AM --> DOA[📚 DocumentationAgent]
    
    PA --> Codex[🦀 Codex AI]
    DA --> Codex
    RA --> Codex  
    TA --> Codex
    DOA --> Codex
    
    Codex --> Claude[🧠 Claude API]
    
    PM --> FS[📁 File System]
    PM --> Git[📚 Git Repository]
    PM --> NPM[📦 NPM Registry]
    
    UM --> Terminal[💻 Terminal UI]
    UM --> Logs[📊 Structured Logging]
    UM --> Progress[⏳ Progress Tracking]
\`\`\`

## Agent Collaboration Flow

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant CLI as Miyabi CLI
    participant PA as PlannerAgent
    participant DA as DeveloperAgent
    participant RA as ReviewerAgent
    participant TA as TestAgent
    participant DOA as DocAgent
    
    U->>CLI: npx miyabi develop --feature "auth"
    CLI->>PA: Plan feature implementation
    PA->>PA: Analyze requirements
    PA->>DA: Send implementation plan
    
    DA->>DA: Generate code structure
    DA->>RA: Request code review
    RA->>RA: Analyze code quality
    RA->>DA: Provide feedback
    
    DA->>TA: Request test generation
    TA->>TA: Create comprehensive tests
    TA->>DOA: Update documentation
    
    DOA->>DOA: Generate docs
    DOA->>CLI: Complete feature
    CLI->>U: ✅ Feature ready!
\`\`\`
`;

    const diagramPath = path.join(this.assetsDir, 'architecture.md');
    fs.writeFileSync(diagramPath, diagram);

    logger.info('Architecture diagram generated');
  }

  /**
   * Create demo recording instructions
   */
  public generateRecordingInstructions(): void {
    const instructions = `# Demo Recording Instructions

## Prerequisites

1. Install required tools:
   \`\`\`bash
   # For terminal recording
   npm install -g ttygif
   brew install asciinema  # macOS
   
   # For GIF conversion
   brew install imagemagick
   brew install gifsicle
   \`\`\`

## Recording Demos

### 1. Quick Start Demo
\`\`\`bash
# Record terminal session
asciinema rec quickstart-demo.cast --command "./assets/quickstart-demo.sh"

# Convert to GIF
ttygif quickstart-demo.cast
mv tty.gif assets/gifs/quickstart-demo.gif

# Optimize GIF
gifsicle -O3 assets/gifs/quickstart-demo.gif -o assets/gifs/quickstart-demo-optimized.gif
\`\`\`

### 2. Agent Workflow Demo
\`\`\`bash
asciinema rec workflow-demo.cast --command "./assets/workflow-demo.sh"
ttygif workflow-demo.cast
mv tty.gif assets/gifs/workflow-demo.gif
gifsicle -O3 assets/gifs/workflow-demo.gif -o assets/gifs/workflow-demo-optimized.gif
\`\`\`

### 3. Project Structure Demo
\`\`\`bash
asciinema rec structure-demo.cast --command "./assets/structure-demo.sh"
ttygif structure-demo.cast
mv tty.gif assets/gifs/structure-demo.gif
gifsicle -O3 assets/gifs/structure-demo.gif -o assets/gifs/structure-demo-optimized.gif
\`\`\`

## Screenshots

### Capture static screenshots:
\`\`\`bash
# Terminal screenshots using built-in tools
# macOS: Cmd+Shift+4 then Space to capture terminal window
# Linux: Use gnome-screenshot or flameshot
# Windows: Use Windows Snipping Tool
\`\`\`

## File Organization

\`\`\`
assets/
├── screenshots/
│   ├── cli-help.png
│   ├── project-init.png
│   ├── agent-workflow.png
│   └── completed-project.png
├── gifs/
│   ├── quickstart-demo.gif
│   ├── workflow-demo.gif
│   └── structure-demo.gif
└── architecture.md
\`\`\`
`;

    const instructionsPath = path.join(this.assetsDir, 'RECORDING.md');
    fs.writeFileSync(instructionsPath, instructions);

    logger.info('Recording instructions generated');
  }
}

// ESM module check
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const generator = new DemoGenerator();

  const command = process.argv[2];
  switch (command) {
    case 'generate':
      generator.generateAll();
      break;
    case 'instructions':
      generator.generateRecordingInstructions();
      break;
    default:
      console.log('Usage: npm run demo:generate or npm run demo:instructions');
  }
}
