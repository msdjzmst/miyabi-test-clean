/**
 * TemplateEngine Basic Tests
 *
 * 基本的な動作を確認するスモークテスト
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TemplateEngine } from '../src/generator/TemplateEngine';
import { AnalysisResult } from '../src/analyzer/CodeAnalyzer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TemplateEngine', () => {
  let outputDir: string;

  beforeAll(() => {
    outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // クリーンアップ
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  describe('初期化', () => {
    it('デフォルトテンプレートで初期化できる', () => {
      expect(() => {
        new TemplateEngine();
      }).not.toThrow();
    });
  });

  describe('ドキュメント生成', () => {
    it('空の解析結果からインデックスを生成できる', () => {
      const engine = new TemplateEngine();
      const result: AnalysisResult = {
        functions: [],
        classes: [],
        interfaces: [],
        totalFiles: 0,
        analysisDate: new Date().toISOString(),
        projectPath: '/test/project',
      };

      const files = engine.generate(result, {
        outputDir,
        title: 'Test Documentation',
      });

      expect(files).toBeDefined();
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toContain('README.md');

      // README.mdが生成されたことを確認
      const readmePath = path.join(outputDir, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Test Documentation');
    });

    it('関数を含むドキュメントを生成できる', () => {
      const engine = new TemplateEngine();
      const result: AnalysisResult = {
        functions: [
          {
            name: 'testFunction',
            description: 'A test function',
            parameters: [
              {
                name: 'arg1',
                type: 'string',
                optional: false,
                description: 'First argument',
              },
            ],
            returnType: 'void',
            isAsync: false,
            isExported: true,
            decorators: [],
            sourceCode: 'function testFunction(arg1: string): void {}',
            filePath: '/test/file.ts',
            line: 1,
          },
        ],
        classes: [],
        interfaces: [],
        totalFiles: 1,
        analysisDate: new Date().toISOString(),
        projectPath: '/test/project',
      };

      const files = engine.generate(result, {
        outputDir,
        title: 'Function Test',
      });

      expect(files.length).toBeGreaterThanOrEqual(2); // README + functions.md
      expect(files.some((f) => f.includes('functions.md'))).toBe(true);

      const functionsPath = path.join(outputDir, 'functions.md');
      expect(fs.existsSync(functionsPath)).toBe(true);

      const content = fs.readFileSync(functionsPath, 'utf-8');
      expect(content).toContain('testFunction');
      expect(content).toContain('A test function');
    });

    it('クラスを含むドキュメントを生成できる', () => {
      const engine = new TemplateEngine();
      const result: AnalysisResult = {
        functions: [],
        classes: [
          {
            name: 'TestClass',
            description: 'A test class',
            extends: null,
            implements: [],
            properties: [],
            methods: [
              {
                name: 'testMethod',
                description: 'A test method',
                parameters: [],
                returnType: 'void',
                visibility: 'public',
                isStatic: false,
                isAsync: false,
              },
            ],
            isAbstract: false,
            isExported: true,
            decorators: [],
            filePath: '/test/file.ts',
            line: 1,
          },
        ],
        interfaces: [],
        totalFiles: 1,
        analysisDate: new Date().toISOString(),
        projectPath: '/test/project',
      };

      const files = engine.generate(result, {
        outputDir,
        title: 'Class Test',
      });

      expect(files.some((f) => f.includes('classes.md'))).toBe(true);

      const classesPath = path.join(outputDir, 'classes.md');
      expect(fs.existsSync(classesPath)).toBe(true);

      const content = fs.readFileSync(classesPath, 'utf-8');
      expect(content).toContain('TestClass');
      expect(content).toContain('testMethod');
    });

    it('インターフェースを含むドキュメントを生成できる', () => {
      const engine = new TemplateEngine();
      const result: AnalysisResult = {
        functions: [],
        classes: [],
        interfaces: [
          {
            name: 'TestInterface',
            description: 'A test interface',
            extends: [],
            properties: [
              {
                name: 'prop1',
                type: 'string',
                optional: false,
                description: 'A property',
              },
            ],
            methods: [],
            isExported: true,
            filePath: '/test/file.ts',
            line: 1,
          },
        ],
        totalFiles: 1,
        analysisDate: new Date().toISOString(),
        projectPath: '/test/project',
      };

      const files = engine.generate(result, {
        outputDir,
        title: 'Interface Test',
      });

      expect(files.some((f) => f.includes('interfaces.md'))).toBe(true);

      const interfacesPath = path.join(outputDir, 'interfaces.md');
      expect(fs.existsSync(interfacesPath)).toBe(true);

      const content = fs.readFileSync(interfacesPath, 'utf-8');
      expect(content).toContain('TestInterface');
      expect(content).toContain('prop1');
    });
  });

  describe('カスタムテンプレート', () => {
    it('カスタムテンプレートを登録できる', () => {
      const engine = new TemplateEngine();
      const customTemplate = '# Custom {{title}}';

      expect(() => {
        engine.registerTemplate('index', customTemplate);
      }).not.toThrow();
    });
  });
});
