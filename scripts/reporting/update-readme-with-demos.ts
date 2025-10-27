import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@miyabi/coding-agents/ui/index';

/**
 * Updates README.md to include screenshots and demo GIFs
 */
export class ReadmeUpdater {
  private readonly readmePath = path.join(process.cwd(), 'README.md');
  private readonly assetsPath = 'assets';

  /**
   * Update README with demo content
   */
  public updateReadme(): void {
    try {
      const currentContent = fs.readFileSync(this.readmePath, 'utf-8');
      const updatedContent = this.insertDemoContent(currentContent);

      // Backup original
      fs.writeFileSync(`${this.readmePath}.backup`, currentContent);
      fs.writeFileSync(this.readmePath, updatedContent);

      logger.success('README.md updated with demo content');
    } catch (error) {
      logger.error('Failed to update README:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Insert demo content into README
   */
  private insertDemoContent(content: string): string {
    // Replace the existing demo placeholder
    const demoPlaceholder = '![Demo](https://img.shields.io/badge/Demo-Coming%20Soon-orange?style=for-the-badge)';

    const demoSection = `
## 🎬 デモンストレーション

### クイックスタート
![Quick Start Demo](${this.assetsPath}/gifs/quickstart-demo.gif)

*一つのコマンドで始まる自律型開発*

### AIエージェント連携
![Agent Workflow](${this.assetsPath}/gifs/workflow-demo.gif)

*5つのAIエージェントが協調して開発を進める様子*

### プロジェクト構造生成
![Project Structure](${this.assetsPath}/gifs/structure-demo.gif)

*完全なプロジェクト構造が自動生成される*

<details>
<summary><b>📸 スクリーンショット</b></summary>

### CLI ヘルプ画面
![CLI Help](${this.assetsPath}/screenshots/cli-help.png)

### プロジェクト初期化
![Project Init](${this.assetsPath}/screenshots/project-init.png)

### エージェントワークフロー
![Agent Workflow](${this.assetsPath}/screenshots/agent-workflow.png)

### 完成プロジェクト
![Completed Project](${this.assetsPath}/screenshots/completed-project.png)

</details>

## 🏗️ アーキテクチャ

![Architecture Overview](${this.assetsPath}/architecture-diagram.png)

### エージェント連携フロー

\`\`\`mermaid
graph LR
    A[👤 User Request] --> B[🎯 PlannerAgent]
    B --> C[👨‍💻 DeveloperAgent]
    C --> D[🔍 ReviewerAgent]
    D --> E[🧪 TestAgent]
    E --> F[📚 DocAgent]
    F --> G[✅ Complete]
    
    B -.-> H[🧠 Claude AI]
    C -.-> H
    D -.-> H
    E -.-> H
    F -.-> H
\`\`\`
`;

    // Replace demo placeholder with actual demo section
    let updatedContent = content.replace(demoPlaceholder, demoSection);

    // Add English demo section
    const englishDemoSection = `
## 🎬 Demonstrations

### Quick Start
![Quick Start Demo](${this.assetsPath}/gifs/quickstart-demo.gif)

*Autonomous development begins with a single command*

### AI Agent Collaboration  
![Agent Workflow](${this.assetsPath}/gifs/workflow-demo.gif)

*Five AI agents collaborating seamlessly*

### Project Structure Generation
![Project Structure](${this.assetsPath}/gifs/structure-demo.gif)

*Complete project structure auto-generated*

<details>
<summary><b>📸 Screenshots</b></summary>

### CLI Help Screen
![CLI Help](${this.assetsPath}/screenshots/cli-help.png)

### Project Initialization
![Project Init](${this.assetsPath}/screenshots/project-init.png)

### Agent Workflow
![Agent Workflow](${this.assetsPath}/screenshots/agent-workflow.png)

### Completed Project
![Completed Project](${this.assetsPath}/screenshots/completed-project.png)

</details>
`;

    // Insert English demo section after English header
    const englishHeaderRegex = /(## 🎯 English\s*<details[^>]*>)/;
    if (englishHeaderRegex.test(updatedContent)) {
      updatedContent = updatedContent.replace(
        englishHeaderRegex,
        `$1\n\n${englishDemoSection}`,
      );
    }

    return updatedContent;
  }

  /**
   * Generate demo badges for README
   */
  public generateDemoBadges(): string {
    return `
[![Demo: Quick Start](https://img.shields.io/badge/Demo-Quick%20Start-blue?style=for-the-badge)](${this.assetsPath}/gifs/quickstart-demo.gif)
[![Demo: AI Agents](https://img.shields.io/badge/Demo-AI%20Agents-green?style=for-the-badge)](${this.assetsPath}/gifs/workflow-demo.gif)
[![Demo: Project Gen](https://img.shields.io/badge/Demo-Project%20Gen-purple?style=for-the-badge)](${this.assetsPath}/gifs/structure-demo.gif)
`;
  }

  /**
   * Create assets directory structure
   */
  public createAssetStructure(): void {
    const directories = [
      path.join(this.assetsPath, 'screenshots'),
      path.join(this.assetsPath, 'gifs'),
      path.join(this.assetsPath, 'diagrams'),
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    });

    // Create .gitkeep and README for asset directories
    const assetReadme = `# Miyabi Demo Assets

This directory contains screenshots and demo GIFs for the Miyabi project.

## Contents

### Screenshots (/screenshots)
- \`cli-help.png\` - CLI help screen
- \`project-init.png\` - Project initialization
- \`agent-workflow.png\` - AI agent workflow
- \`completed-project.png\` - Final project structure

### GIFs (/gifs)  
- \`quickstart-demo.gif\` - Quick start demonstration
- \`workflow-demo.gif\` - AI agent collaboration
- \`structure-demo.gif\` - Project generation

### Diagrams (/diagrams)
- Architecture diagrams and flowcharts

## Recording Guidelines

1. Use consistent terminal theme (dark with good contrast)
2. Keep GIFs under 5MB for GitHub compatibility
3. Use 16:9 aspect ratio when possible
4. Include clear, readable text
5. Optimize GIFs for web viewing

## Tools

- **Recording**: asciinema, ttygif
- **Screenshots**: OS built-in tools
- **Optimization**: gifsicle, imagemagick
`;

    fs.writeFileSync(path.join(this.assetsPath, 'README.md'), assetReadme);

    logger.success('Asset directory structure created');
  }
}

// ESM module check
import { fileURLToPath } from 'node:url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const updater = new ReadmeUpdater();

  const command = process.argv[2];
  switch (command) {
    case 'update':
      updater.updateReadme();
      break;
    case 'structure':
      updater.createAssetStructure();
      break;
    default:
      updater.createAssetStructure();
      updater.updateReadme();
  }
}
