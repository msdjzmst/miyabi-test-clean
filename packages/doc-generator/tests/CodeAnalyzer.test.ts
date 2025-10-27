/**
 * CodeAnalyzer Basic Tests
 *
 * 基本的な動作を確認するスモークテスト
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CodeAnalyzer } from '../src/analyzer/CodeAnalyzer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CodeAnalyzer', () => {
  let testFileDir: string;
  let testFilePath: string;

  beforeAll(() => {
    // テスト用のTypeScriptファイルを作成
    testFileDir = path.join(__dirname, 'fixtures');
    testFilePath = path.join(testFileDir, 'sample.ts');

    if (!fs.existsSync(testFileDir)) {
      fs.mkdirSync(testFileDir, { recursive: true });
    }

    const sampleCode = `
/**
 * Sample function for testing
 * @param name - The name parameter
 * @param age - The age parameter
 * @returns A greeting message
 */
export function greet(name: string, age: number): string {
  return \`Hello, \${name}! You are \${age} years old.\`;
}

/**
 * Sample class for testing
 */
export class Calculator {
  /**
   * Adds two numbers
   * @param a - First number
   * @param b - Second number
   * @returns The sum
   */
  public add(a: number, b: number): number {
    return a + b;
  }

  /**
   * Private helper method
   */
  private helper(): void {
    // Do nothing
  }
}

/**
 * Sample interface for testing
 */
export interface User {
  /** User name */
  name: string;
  /** User age */
  age: number;
  /** Optional email */
  email?: string;
}
`;

    fs.writeFileSync(testFilePath, sampleCode, 'utf-8');
  });

  describe('初期化', () => {
    it('tsconfig無しで初期化できる', () => {
      expect(() => {
        new CodeAnalyzer();
      }).not.toThrow();
    });

    it('tsconfig有りで初期化できる', () => {
      const tsConfigPath = path.join(__dirname, '../tsconfig.json');
      expect(() => {
        new CodeAnalyzer(tsConfigPath);
      }).not.toThrow();
    });
  });

  describe('ソース追加', () => {
    it('ファイルを追加できる', () => {
      const analyzer = new CodeAnalyzer();
      expect(() => {
        analyzer.addSource(testFilePath);
      }).not.toThrow();
    });

    it('ディレクトリを追加できる', () => {
      const analyzer = new CodeAnalyzer();
      expect(() => {
        analyzer.addSource(testFileDir);
      }).not.toThrow();
    });

    it('存在しないパスでエラーを投げる', () => {
      const analyzer = new CodeAnalyzer();
      expect(() => {
        analyzer.addSource('/non/existent/path.ts');
      }).toThrow('Path does not exist');
    });
  });

  describe('解析', () => {
    it('関数を解析できる', () => {
      const analyzer = new CodeAnalyzer();
      analyzer.addSource(testFilePath);
      const result = analyzer.analyze();

      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBeGreaterThan(0);

      const greetFunc = result.functions.find((f) => f.name === 'greet');
      expect(greetFunc).toBeDefined();
      expect(greetFunc?.parameters).toHaveLength(2);
      expect(greetFunc?.returnType).toContain('string');
      expect(greetFunc?.isExported).toBe(true);
    });

    it('クラスを解析できる', () => {
      const analyzer = new CodeAnalyzer();
      analyzer.addSource(testFilePath);
      const result = analyzer.analyze();

      expect(result.classes).toBeDefined();
      expect(result.classes.length).toBeGreaterThan(0);

      const calculatorClass = result.classes.find((c) => c.name === 'Calculator');
      expect(calculatorClass).toBeDefined();
      expect(calculatorClass?.methods.length).toBeGreaterThan(0);
      expect(calculatorClass?.isExported).toBe(true);
    });

    it('インターフェースを解析できる', () => {
      const analyzer = new CodeAnalyzer();
      analyzer.addSource(testFilePath);
      const result = analyzer.analyze();

      expect(result.interfaces).toBeDefined();
      expect(result.interfaces.length).toBeGreaterThan(0);

      const userInterface = result.interfaces.find((i) => i.name === 'User');
      expect(userInterface).toBeDefined();
      expect(userInterface?.properties).toHaveLength(3);
      expect(userInterface?.isExported).toBe(true);
    });

    it('解析結果に正しいメタデータを含む', () => {
      const analyzer = new CodeAnalyzer();
      analyzer.addSource(testFilePath);
      const result = analyzer.analyze();

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.analysisDate).toBeDefined();
      expect(result.projectPath).toBeDefined();
    });
  });

  describe('プロジェクト情報', () => {
    it('プロジェクト情報を取得できる', () => {
      const analyzer = new CodeAnalyzer();
      analyzer.addSource(testFilePath);

      const info = analyzer.getProjectInfo();
      expect(info.totalSourceFiles).toBeGreaterThan(0);
      expect(info.rootDirectory).toBeDefined();
    });
  });
});
