#!/usr/bin/env node
/**
 * AI-Powered Documentation Generator
 * Automatically generates comprehensive documentation from TypeScript/JavaScript code
 *
 * Features:
 * - TypeScript AST parsing
 * - JSDoc comment extraction
 * - Markdown documentation generation
 * - Usage example generation
 * - Auto-update on code changes
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a documented function or method
 */
export interface FunctionDoc {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  returnType: string;
  returnDescription?: string;
  examples?: string[];
  isAsync: boolean;
  isExported: boolean;
}

/**
 * Represents a documented class
 */
export interface ClassDoc {
  name: string;
  description: string;
  methods: FunctionDoc[];
  properties: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  isExported: boolean;
}

/**
 * Represents a documented interface
 */
export interface InterfaceDoc {
  name: string;
  description: string;
  properties: Array<{
    name: string;
    type: string;
    description?: string;
    optional: boolean;
  }>;
  isExported: boolean;
}

/**
 * Main documentation generator class
 */
export class DocGenerator {
  constructor() {}

  /**
   * Extract JSDoc comments from a TypeScript file
   * @param filePath Path to the TypeScript file
   * @returns Array of extracted documentation objects
   */
  async extractJSDoc(filePath: string): Promise<Array<FunctionDoc | ClassDoc | InterfaceDoc>> {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const docs: Array<FunctionDoc | ClassDoc | InterfaceDoc> = [];

    const visit = (node: ts.Node) => {
      // Extract function documentation
      if (ts.isFunctionDeclaration(node) && node.name) {
        const functionDoc = this.extractFunctionDoc(node);
        if (functionDoc) {
          docs.push(functionDoc);
        }
      }

      // Extract class documentation
      if (ts.isClassDeclaration(node) && node.name) {
        const classDoc = this.extractClassDoc(node);
        if (classDoc) {
          docs.push(classDoc);
        }
      }

      // Extract interface documentation
      if (ts.isInterfaceDeclaration(node)) {
        const interfaceDoc = this.extractInterfaceDoc(node);
        if (interfaceDoc) {
          docs.push(interfaceDoc);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return docs;
  }

  /**
   * Extract documentation from a function declaration
   */
  private extractFunctionDoc(node: ts.FunctionDeclaration): FunctionDoc | null {
    if (!node.name) return null;

    const jsDocTags = ts.getJSDocTags(node);
    const jsDocComments = ts.getJSDocCommentsAndTags(node);

    let description = '';
    if (jsDocComments.length > 0) {
      const comment = jsDocComments[0];
      if (ts.isJSDoc(comment) && comment.comment) {
        description = typeof comment.comment === 'string'
          ? comment.comment
          : comment.comment.map(c => c.text).join('');
      }
    }

    const parameters = node.parameters.map(param => {
      const paramName = param.name.getText();
      const paramType = param.type ? param.type.getText() : 'any';

      // Find @param tag for this parameter
      const paramTag = jsDocTags.find(
        tag => tag.tagName.text === 'param' &&
        tag.comment && tag.comment.toString().includes(paramName)
      );

      const paramDesc = paramTag?.comment ?
        (typeof paramTag.comment === 'string' ? paramTag.comment : '') :
        undefined;

      return {
        name: paramName,
        type: paramType,
        description: paramDesc
      };
    });

    const returnType = node.type ? node.type.getText() : 'void';
    const returnTag = jsDocTags.find(tag => tag.tagName.text === 'returns');
    const returnDescription = returnTag?.comment ?
      (typeof returnTag.comment === 'string' ? returnTag.comment : '') :
      undefined;

    // Extract examples
    const exampleTags = jsDocTags.filter(tag => tag.tagName.text === 'example');
    const examples = exampleTags.map(tag =>
      typeof tag.comment === 'string' ? tag.comment : ''
    ).filter(ex => ex);

    const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name: node.name.getText(),
      description,
      parameters,
      returnType,
      returnDescription,
      examples: examples.length > 0 ? examples : undefined,
      isAsync,
      isExported
    };
  }

  /**
   * Extract documentation from a class declaration
   */
  private extractClassDoc(node: ts.ClassDeclaration): ClassDoc | null {
    if (!node.name) return null;

    const jsDocComments = ts.getJSDocCommentsAndTags(node);
    let description = '';
    if (jsDocComments.length > 0) {
      const comment = jsDocComments[0];
      if (ts.isJSDoc(comment) && comment.comment) {
        description = typeof comment.comment === 'string'
          ? comment.comment
          : comment.comment.map(c => c.text).join('');
      }
    }

    const methods: FunctionDoc[] = [];
    const properties: Array<{ name: string; type: string; description?: string }> = [];

    node.members.forEach(member => {
      if (ts.isMethodDeclaration(member) && member.name) {
        const methodDoc = this.extractMethodDoc(member);
        if (methodDoc) {
          methods.push(methodDoc);
        }
      }

      if (ts.isPropertyDeclaration(member) && member.name) {
        const propertyDoc = this.extractPropertyDoc(member);
        if (propertyDoc) {
          properties.push(propertyDoc);
        }
      }
    });

    const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name: node.name.getText(),
      description,
      methods,
      properties,
      isExported
    };
  }

  /**
   * Extract documentation from a method declaration
   */
  private extractMethodDoc(node: ts.MethodDeclaration): FunctionDoc | null {
    const jsDocComments = ts.getJSDocCommentsAndTags(node);

    let description = '';
    if (jsDocComments.length > 0) {
      const comment = jsDocComments[0];
      if (ts.isJSDoc(comment) && comment.comment) {
        description = typeof comment.comment === 'string'
          ? comment.comment
          : comment.comment.map(c => c.text).join('');
      }
    }

    const parameters = node.parameters.map(param => {
      const paramName = param.name.getText();
      const paramType = param.type ? param.type.getText() : 'any';
      return {
        name: paramName,
        type: paramType
      };
    });

    const returnType = node.type ? node.type.getText() : 'void';
    const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false;

    return {
      name: node.name.getText(),
      description,
      parameters,
      returnType,
      isAsync,
      isExported: false
    };
  }

  /**
   * Extract documentation from a property declaration
   */
  private extractPropertyDoc(node: ts.PropertyDeclaration): { name: string; type: string; description?: string } | null {
    const jsDocComments = ts.getJSDocCommentsAndTags(node);
    let description = '';
    if (jsDocComments.length > 0) {
      const comment = jsDocComments[0];
      if (ts.isJSDoc(comment) && comment.comment) {
        description = typeof comment.comment === 'string'
          ? comment.comment
          : comment.comment.map(c => c.text).join('');
      }
    }

    return {
      name: node.name.getText(),
      type: node.type ? node.type.getText() : 'any',
      description: description || undefined
    };
  }

  /**
   * Extract documentation from an interface declaration
   */
  private extractInterfaceDoc(node: ts.InterfaceDeclaration): InterfaceDoc | null {
    const jsDocComments = ts.getJSDocCommentsAndTags(node);
    let description = '';
    if (jsDocComments.length > 0) {
      const comment = jsDocComments[0];
      if (ts.isJSDoc(comment) && comment.comment) {
        description = typeof comment.comment === 'string'
          ? comment.comment
          : comment.comment.map(c => c.text).join('');
      }
    }

    const properties = node.members.map(member => {
      if (ts.isPropertySignature(member) && member.name) {
        const propJsDoc = ts.getJSDocCommentsAndTags(member);
        let propDesc = '';
        if (propJsDoc.length > 0) {
          const comment = propJsDoc[0];
          if (ts.isJSDoc(comment) && comment.comment) {
            propDesc = typeof comment.comment === 'string'
              ? comment.comment
              : comment.comment.map(c => c.text).join('');
          }
        }

        return {
          name: member.name.getText(),
          type: member.type ? member.type.getText() : 'any',
          description: propDesc || undefined,
          optional: !!member.questionToken
        };
      }
      return null;
    }).filter((prop): prop is NonNullable<typeof prop> => prop !== null);

    const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name: node.name.getText(),
      description,
      properties,
      isExported
    };
  }

  /**
   * Generate markdown documentation from extracted docs
   * @param docs Array of documentation objects
   * @param outputPath Path to write the markdown file
   */
  async generateMarkdown(
    docs: Array<FunctionDoc | ClassDoc | InterfaceDoc>,
    outputPath: string
  ): Promise<void> {
    let markdown = '# API Documentation\n\n';
    markdown += `*Generated on ${new Date().toISOString()}*\n\n`;
    markdown += '---\n\n';

    // Separate by type
    const functions = docs.filter(d => 'parameters' in d && !('methods' in d)) as FunctionDoc[];
    const classes = docs.filter(d => 'methods' in d) as ClassDoc[];
    const interfaces = docs.filter(d => 'properties' in d && !('methods' in d)) as InterfaceDoc[];

    // Functions
    if (functions.length > 0) {
      markdown += '## Functions\n\n';
      for (const func of functions) {
        markdown += this.generateFunctionMarkdown(func);
      }
    }

    // Classes
    if (classes.length > 0) {
      markdown += '## Classes\n\n';
      for (const cls of classes) {
        markdown += this.generateClassMarkdown(cls);
      }
    }

    // Interfaces
    if (interfaces.length > 0) {
      markdown += '## Interfaces\n\n';
      for (const iface of interfaces) {
        markdown += this.generateInterfaceMarkdown(iface);
      }
    }

    fs.writeFileSync(outputPath, markdown, 'utf-8');
  }

  /**
   * Generate markdown for a function
   */
  private generateFunctionMarkdown(func: FunctionDoc): string {
    let md = `### ${func.name}\n\n`;

    if (func.description) {
      md += `${func.description}\n\n`;
    }

    // Signature
    const params = func.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
    const asyncPrefix = func.isAsync ? 'async ' : '';
    md += `**Signature:**\n\`\`\`typescript\n${asyncPrefix}function ${func.name}(${params}): ${func.returnType}\n\`\`\`\n\n`;

    // Parameters
    if (func.parameters.length > 0) {
      md += '**Parameters:**\n\n';
      for (const param of func.parameters) {
        md += `- \`${param.name}\` (\`${param.type}\`)`;
        if (param.description) {
          md += ` - ${param.description}`;
        }
        md += '\n';
      }
      md += '\n';
    }

    // Returns
    if (func.returnType !== 'void') {
      md += `**Returns:** \`${func.returnType}\``;
      if (func.returnDescription) {
        md += ` - ${func.returnDescription}`;
      }
      md += '\n\n';
    }

    // Examples
    if (func.examples && func.examples.length > 0) {
      md += '**Examples:**\n\n';
      for (const example of func.examples) {
        md += `\`\`\`typescript\n${example}\n\`\`\`\n\n`;
      }
    }

    md += '---\n\n';
    return md;
  }

  /**
   * Generate markdown for a class
   */
  private generateClassMarkdown(cls: ClassDoc): string {
    let md = `### ${cls.name}\n\n`;

    if (cls.description) {
      md += `${cls.description}\n\n`;
    }

    // Properties
    if (cls.properties.length > 0) {
      md += '**Properties:**\n\n';
      for (const prop of cls.properties) {
        md += `- \`${prop.name}\` (\`${prop.type}\`)`;
        if (prop.description) {
          md += ` - ${prop.description}`;
        }
        md += '\n';
      }
      md += '\n';
    }

    // Methods
    if (cls.methods.length > 0) {
      md += '**Methods:**\n\n';
      for (const method of cls.methods) {
        const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        const asyncPrefix = method.isAsync ? 'async ' : '';
        md += `- \`${asyncPrefix}${method.name}(${params}): ${method.returnType}\``;
        if (method.description) {
          md += `\n  - ${method.description}`;
        }
        md += '\n';
      }
      md += '\n';
    }

    md += '---\n\n';
    return md;
  }

  /**
   * Generate markdown for an interface
   */
  private generateInterfaceMarkdown(iface: InterfaceDoc): string {
    let md = `### ${iface.name}\n\n`;

    if (iface.description) {
      md += `${iface.description}\n\n`;
    }

    // Properties
    if (iface.properties.length > 0) {
      md += '**Properties:**\n\n';
      md += '```typescript\n';
      md += `interface ${iface.name} {\n`;
      for (const prop of iface.properties) {
        const optional = prop.optional ? '?' : '';
        md += `  ${prop.name}${optional}: ${prop.type};`;
        if (prop.description) {
          md += ` // ${prop.description}`;
        }
        md += '\n';
      }
      md += '}\n```\n\n';
    }

    md += '---\n\n';
    return md;
  }

  /**
   * Generate documentation for all TypeScript files in a directory
   * @param dirPath Directory to scan
   * @param outputPath Output markdown file path
   * @param recursive Whether to scan subdirectories
   */
  async generateDocsForDirectory(
    dirPath: string,
    outputPath: string,
    recursive: boolean = true
  ): Promise<void> {
    const files = this.getTypeScriptFiles(dirPath, recursive);
    const allDocs: Array<FunctionDoc | ClassDoc | InterfaceDoc> = [];

    for (const file of files) {
      const docs = await this.extractJSDoc(file);
      allDocs.push(...docs);
    }

    await this.generateMarkdown(allDocs, outputPath);
  }

  /**
   * Get all TypeScript files in a directory
   */
  private getTypeScriptFiles(dirPath: string, recursive: boolean): string[] {
    const files: string[] = [];

    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && recursive && item !== 'node_modules' && item !== 'dist') {
        files.push(...this.getTypeScriptFiles(fullPath, recursive));
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Watch directory for changes and regenerate docs
   * @param dirPath Directory to watch
   * @param outputPath Output markdown file path
   */
  watchAndGenerate(dirPath: string, outputPath: string): void {
    console.log(`👀 Watching ${dirPath} for changes...`);

    fs.watch(dirPath, { recursive: true }, async (_eventType, filename) => {
      if (filename && (filename.endsWith('.ts') || filename.endsWith('.tsx'))) {
        console.log(`📝 File changed: ${filename}, regenerating docs...`);
        try {
          await this.generateDocsForDirectory(dirPath, outputPath);
          console.log(`✅ Documentation updated at ${outputPath}`);
        } catch (error) {
          console.error(`❌ Error generating docs:`, error);
        }
      }
    });
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: doc-generator <input-dir> <output-file> [--watch]');
    process.exit(1);
  }

  const [inputDir, outputFile] = args;
  const watch = args.includes('--watch');

  const generator = new DocGenerator();

  (async () => {
    await generator.generateDocsForDirectory(inputDir, outputFile);
    console.log(`✅ Documentation generated at ${outputFile}`);

    if (watch) {
      generator.watchAndGenerate(inputDir, outputFile);
    }
  })();
}
