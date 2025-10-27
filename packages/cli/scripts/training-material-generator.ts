#!/usr/bin/env node
/**
 * Training Material Generator
 * Generates training materials and tutorials from code documentation
 */

import { Octokit } from '@octokit/rest';
import { DocGenerator, FunctionDoc, ClassDoc, InterfaceDoc } from './doc-generator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Training material structure
 */
export interface TrainingMaterial {
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  topics: string[];
  content: string;
  exercises?: Array<{
    question: string;
    hint?: string;
    solution?: string;
  }>;
}

/**
 * Generates training materials from code documentation
 */
export class TrainingMaterialGenerator {
  private octokit: Octokit;
  private docGenerator: DocGenerator;

  constructor(
    token: string,
    private owner: string,
    private repo: string
  ) {
    this.octokit = new Octokit({ auth: token });
    this.docGenerator = new DocGenerator();
  }

  /**
   * Generate training material from a TypeScript file
   * @param filePath Path to the source file
   * @param level Difficulty level
   * @returns Generated training material
   */
  async generateFromFile(
    filePath: string,
    level: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
  ): Promise<TrainingMaterial> {
    const docs = await this.docGenerator.extractJSDoc(filePath);
    const fileName = path.basename(filePath, path.extname(filePath));

    let content = `# ${this.formatTitle(fileName)}\n\n`;
    content += `## Overview\n\n`;
    content += `This guide covers the functionality provided by \`${fileName}\`.\n\n`;

    const topics: string[] = [];

    // Generate content for functions
    const functions = docs.filter(d => 'parameters' in d && !('methods' in d)) as FunctionDoc[];
    if (functions.length > 0) {
      content += `## Functions\n\n`;
      for (const func of functions) {
        topics.push(func.name);
        content += this.generateFunctionTutorial(func);
      }
    }

    // Generate content for classes
    const classes = docs.filter(d => 'methods' in d) as ClassDoc[];
    if (classes.length > 0) {
      content += `## Classes\n\n`;
      for (const cls of classes) {
        topics.push(cls.name);
        content += this.generateClassTutorial(cls);
      }
    }

    // Generate exercises
    const exercises = this.generateExercises(docs, level);

    return {
      title: this.formatTitle(fileName),
      description: `Training material for ${fileName}`,
      level,
      topics,
      content,
      exercises
    };
  }

  /**
   * Generate tutorial content for a function
   */
  private generateFunctionTutorial(func: FunctionDoc): string {
    let content = `### ${func.name}\n\n`;

    if (func.description) {
      content += `${func.description}\n\n`;
    }

    // Usage section
    content += `**How to use:**\n\n`;
    content += '```typescript\n';

    const params = func.parameters.map(p => {
      if (p.type === 'string') return `"example"`;
      if (p.type === 'number') return `42`;
      if (p.type === 'boolean') return `true`;
      if (p.type.includes('[]')) return `[]`;
      if (p.type.includes('{}') || p.type === 'object') return `{}`;
      return `value`;
    }).join(', ');

    const asyncPrefix = func.isAsync ? 'await ' : '';
    content += `const result = ${asyncPrefix}${func.name}(${params});\n`;
    content += '```\n\n';

    // Example from JSDoc
    if (func.examples && func.examples.length > 0) {
      content += `**Example:**\n\n`;
      for (const example of func.examples) {
        content += '```typescript\n';
        content += example;
        content += '\n```\n\n';
      }
    }

    // Parameters explanation
    if (func.parameters.length > 0) {
      content += `**Parameters explained:**\n\n`;
      for (const param of func.parameters) {
        content += `- **${param.name}** (\`${param.type}\`)`;
        if (param.description) {
          content += `: ${param.description}`;
        } else {
          content += `: The ${param.name} parameter`;
        }
        content += '\n';
      }
      content += '\n';
    }

    // Return value
    if (func.returnType !== 'void') {
      content += `**Returns:**\n\n`;
      content += `This function returns a \`${func.returnType}\``;
      if (func.returnDescription) {
        content += ` - ${func.returnDescription}`;
      }
      content += '.\n\n';
    }

    content += '---\n\n';
    return content;
  }

  /**
   * Generate tutorial content for a class
   */
  private generateClassTutorial(cls: ClassDoc): string {
    let content = `### ${cls.name}\n\n`;

    if (cls.description) {
      content += `${cls.description}\n\n`;
    }

    // Instantiation
    content += `**Creating an instance:**\n\n`;
    content += '```typescript\n';
    content += `const instance = new ${cls.name}();\n`;
    content += '```\n\n';

    // Properties
    if (cls.properties.length > 0) {
      content += `**Properties:**\n\n`;
      for (const prop of cls.properties) {
        content += `- **${prop.name}** (\`${prop.type}\`)`;
        if (prop.description) {
          content += `: ${prop.description}`;
        }
        content += '\n';
      }
      content += '\n';
    }

    // Methods
    if (cls.methods.length > 0) {
      content += `**Methods:**\n\n`;
      for (const method of cls.methods) {
        content += `#### ${method.name}\n\n`;
        if (method.description) {
          content += `${method.description}\n\n`;
        }

        const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        const asyncPrefix = method.isAsync ? 'await ' : '';
        content += '```typescript\n';
        content += `const result = ${asyncPrefix}instance.${method.name}(${params});\n`;
        content += '```\n\n';
      }
    }

    content += '---\n\n';
    return content;
  }

  /**
   * Generate exercises based on the documentation
   */
  private generateExercises(
    docs: Array<FunctionDoc | ClassDoc | InterfaceDoc>,
    level: 'beginner' | 'intermediate' | 'advanced'
  ): Array<{ question: string; hint?: string; solution?: string }> {
    const exercises = [];

    const functions = docs.filter(d => 'parameters' in d && !('methods' in d)) as FunctionDoc[];
    const classes = docs.filter(d => 'methods' in d) as ClassDoc[];

    if (level === 'beginner') {
      // Simple usage exercises
      if (functions.length > 0) {
        const func = functions[0];
        exercises.push({
          question: `Call the \`${func.name}\` function with appropriate parameters.`,
          hint: `Check the function signature and parameter types.`,
          solution: `const result = ${func.isAsync ? 'await ' : ''}${func.name}(/* your parameters */);`
        });
      }
    } else if (level === 'intermediate') {
      // Combination exercises
      if (functions.length > 1) {
        exercises.push({
          question: `Combine multiple functions from this module to achieve a specific task.`,
          hint: `Think about the order of operations and data flow.`
        });
      }
      if (classes.length > 0) {
        const cls = classes[0];
        exercises.push({
          question: `Create an instance of \`${cls.name}\` and use at least two of its methods.`,
          hint: `Remember to handle async methods with await if needed.`
        });
      }
    } else if (level === 'advanced') {
      // Advanced integration exercises
      exercises.push({
        question: `Design a system that integrates all the components from this module.`,
        hint: `Consider error handling, async operations, and modularity.`
      });
      if (classes.length > 0) {
        exercises.push({
          question: `Extend one of the classes with additional functionality.`,
          hint: `Use TypeScript's inheritance or composition patterns.`
        });
      }
    }

    return exercises;
  }

  /**
   * Generate training materials for a directory
   * @param dirPath Directory containing source files
   * @param outputDir Output directory for training materials
   */
  async generateForDirectory(dirPath: string, outputDir: string): Promise<void> {
    const files = this.getTypeScriptFiles(dirPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const file of files) {
      const material = await this.generateFromFile(file);
      const outputPath = path.join(
        outputDir,
        `${path.basename(file, path.extname(file))}-training.md`
      );

      let markdown = `# ${material.title}\n\n`;
      markdown += `**Level:** ${material.level}\n\n`;
      markdown += `**Topics:** ${material.topics.join(', ')}\n\n`;
      markdown += `---\n\n`;
      markdown += material.content;

      if (material.exercises && material.exercises.length > 0) {
        markdown += `## Exercises\n\n`;
        material.exercises.forEach((ex, idx) => {
          markdown += `### Exercise ${idx + 1}\n\n`;
          markdown += `${ex.question}\n\n`;
          if (ex.hint) {
            markdown += `**Hint:** ${ex.hint}\n\n`;
          }
          if (ex.solution) {
            markdown += `<details>\n<summary>Solution</summary>\n\n\`\`\`typescript\n${ex.solution}\n\`\`\`\n\n</details>\n\n`;
          }
        });
      }

      fs.writeFileSync(outputPath, markdown, 'utf-8');
      console.log(`✅ Generated training material: ${outputPath}`);
    }
  }

  /**
   * Publish training materials to GitHub Discussions
   * @param material Training material to publish
   * @param categoryId Discussion category ID
   */
  async publishToDiscussions(material: TrainingMaterial, categoryId: string): Promise<void> {
    const body = material.content + '\n\n' +
      (material.exercises?.map((ex, idx) =>
        `## Exercise ${idx + 1}\n${ex.question}\n${ex.hint ? `**Hint:** ${ex.hint}\n` : ''}`
      ).join('\n') || '');

    try {
      // Use GraphQL to create discussion
      const query = `
        mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
          createDiscussion(input: {
            repositoryId: $repositoryId,
            categoryId: $categoryId,
            title: $title,
            body: $body
          }) {
            discussion {
              id
              url
            }
          }
        }
      `;

      // Get repository ID
      const repo = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo
      });

      const result = await this.octokit.graphql(query, {
        repositoryId: repo.data.node_id,
        categoryId,
        title: `📚 ${material.title} [${material.level}]`,
        body
      });

      console.log(`✅ Published to discussions:`, (result as any).createDiscussion.discussion.url);
    } catch (error) {
      console.error('❌ Error publishing to discussions:', error);
      throw error;
    }
  }

  /**
   * Get all TypeScript files in a directory (non-recursive)
   */
  private getTypeScriptFiles(dirPath: string): string[] {
    return fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map(file => path.join(dirPath, file));
  }

  /**
   * Format title from filename
   */
  private formatTitle(fileName: string): string {
    return fileName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: training-material-generator <input-dir> <output-dir>');
    process.exit(1);
  }

  const [inputDir, outputDir] = args;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const generator = new TrainingMaterialGenerator(token, 'owner', 'repo');

  (async () => {
    await generator.generateForDirectory(inputDir, outputDir);
    console.log(`✅ Training materials generated in ${outputDir}`);
  })();
}
