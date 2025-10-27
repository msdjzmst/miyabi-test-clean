/**
 * CodeAnalyzer - TypeScript AST解析エンジン
 *
 * ts-morphを使用してTypeScriptコードを解析し、
 * 関数、クラス、インターフェースの情報を抽出します。
 *
 * @module CodeAnalyzer
 */

import {
  Project,
  SourceFile,
  FunctionDeclaration,
  ClassDeclaration,
  InterfaceDeclaration,
  JSDoc,
  SyntaxKind,
} from 'ts-morph';
import path from 'path';
import fs from 'fs';

/**
 * 関数情報の型定義
 */
export interface FunctionInfo {
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    optional: boolean;
    description: string;
  }>;
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  decorators: string[];
  sourceCode: string;
  filePath: string;
  line: number;
}

/**
 * クラス情報の型定義
 */
export interface ClassInfo {
  name: string;
  description: string;
  extends: string | null;
  implements: string[];
  properties: Array<{
    name: string;
    type: string;
    visibility: 'public' | 'private' | 'protected';
    isStatic: boolean;
    isReadonly: boolean;
    description: string;
  }>;
  methods: Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      optional: boolean;
    }>;
    returnType: string;
    visibility: 'public' | 'private' | 'protected';
    isStatic: boolean;
    isAsync: boolean;
  }>;
  isAbstract: boolean;
  isExported: boolean;
  decorators: string[];
  filePath: string;
  line: number;
}

/**
 * インターフェース情報の型定義
 */
export interface InterfaceInfo {
  name: string;
  description: string;
  extends: string[];
  properties: Array<{
    name: string;
    type: string;
    optional: boolean;
    description: string;
  }>;
  methods: Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      optional: boolean;
    }>;
    returnType: string;
  }>;
  isExported: boolean;
  filePath: string;
  line: number;
}

/**
 * 解析結果の型定義
 */
export interface AnalysisResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  totalFiles: number;
  analysisDate: string;
  projectPath: string;
}

/**
 * CodeAnalyzer - TypeScriptコード解析エンジン
 *
 * ts-morphを使用してTypeScriptのASTを解析し、
 * ドキュメント生成に必要な情報を抽出します。
 */
export class CodeAnalyzer {
  private project: Project;
  private sourceFiles: SourceFile[] = [];

  /**
   * CodeAnalyzerを初期化します
   *
   * @param tsConfigFilePath - tsconfig.jsonのパス（オプション）
   */
  constructor(tsConfigFilePath?: string) {
    this.project = new Project({
      tsConfigFilePath: tsConfigFilePath || undefined,
      skipAddingFilesFromTsConfig: !tsConfigFilePath,
      skipFileDependencyResolution: true,
    });
  }

  /**
   * 指定されたディレクトリまたはファイルを解析対象に追加します
   *
   * @param targetPath - 解析対象のパス（ディレクトリまたはファイル）
   * @throws {Error} パスが存在しない場合
   */
  public addSource(targetPath: string): void {
    const resolvedPath = path.resolve(targetPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Path does not exist: ${resolvedPath}`);
    }

    const stats = fs.statSync(resolvedPath);

    if (stats.isDirectory()) {
      this.project.addSourceFilesAtPaths(`${resolvedPath}/**/*.ts`);
      this.project.addSourceFilesAtPaths(`${resolvedPath}/**/*.tsx`);
    } else if (stats.isFile() && /\.tsx?$/.test(resolvedPath)) {
      this.project.addSourceFileAtPath(resolvedPath);
    } else {
      throw new Error(`Invalid TypeScript file: ${resolvedPath}`);
    }

    this.sourceFiles = this.project.getSourceFiles();
  }

  /**
   * 全ての解析対象ファイルを解析し、結果を返します
   *
   * @returns {AnalysisResult} 解析結果
   */
  public analyze(): AnalysisResult {
    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];
    const interfaces: InterfaceInfo[] = [];

    for (const sourceFile of this.sourceFiles) {
      // 関数を解析
      const fileFunctions = sourceFile
        .getFunctions()
        .map((fn) => this.analyzeFunctionDeclaration(fn, sourceFile));
      functions.push(...fileFunctions);

      // クラスを解析
      const fileClasses = sourceFile
        .getClasses()
        .map((cls) => this.analyzeClassDeclaration(cls, sourceFile));
      classes.push(...fileClasses);

      // インターフェースを解析
      const fileInterfaces = sourceFile
        .getInterfaces()
        .map((iface) => this.analyzeInterfaceDeclaration(iface, sourceFile));
      interfaces.push(...fileInterfaces);
    }

    return {
      functions,
      classes,
      interfaces,
      totalFiles: this.sourceFiles.length,
      analysisDate: new Date().toISOString(),
      projectPath: this.project.getRootDirectories()[0]?.getPath() || 'N/A',
    };
  }

  /**
   * 関数宣言を解析します
   *
   * @private
   * @param fn - 関数宣言ノード
   * @param sourceFile - ソースファイル
   * @returns {FunctionInfo} 関数情報
   */
  private analyzeFunctionDeclaration(
    fn: FunctionDeclaration,
    sourceFile: SourceFile
  ): FunctionInfo {
    const jsDocs = fn.getJsDocs();
    const description = this.extractDescription(jsDocs);
    const paramDescriptions = this.extractParamDescriptions(jsDocs);

    return {
      name: fn.getName() || 'anonymous',
      description,
      parameters: fn.getParameters().map((param) => ({
        name: param.getName(),
        type: param.getType().getText(),
        optional: param.isOptional(),
        description: paramDescriptions[param.getName()] || '',
      })),
      returnType: fn.getReturnType().getText(),
      isAsync: fn.isAsync(),
      isExported: fn.isExported(),
      decorators: [],
      sourceCode: fn.getText(),
      filePath: sourceFile.getFilePath(),
      line: fn.getStartLineNumber(),
    };
  }

  /**
   * クラス宣言を解析します
   *
   * @private
   * @param cls - クラス宣言ノード
   * @param sourceFile - ソースファイル
   * @returns {ClassInfo} クラス情報
   */
  private analyzeClassDeclaration(
    cls: ClassDeclaration,
    sourceFile: SourceFile
  ): ClassInfo {
    const jsDocs = cls.getJsDocs();
    const description = this.extractDescription(jsDocs);

    const properties = cls.getProperties().map((prop) => {
      const propJsDocs = prop.getJsDocs();
      return {
        name: prop.getName(),
        type: prop.getType().getText(),
        visibility: this.getVisibility(prop),
        isStatic: prop.isStatic(),
        isReadonly: prop.isReadonly(),
        description: this.extractDescription(propJsDocs),
      };
    });

    const methods = cls.getMethods().map((method) => {
      const methodJsDocs = method.getJsDocs();
      return {
        name: method.getName(),
        description: this.extractDescription(methodJsDocs),
        parameters: method.getParameters().map((param) => ({
          name: param.getName(),
          type: param.getType().getText(),
          optional: param.isOptional(),
        })),
        returnType: method.getReturnType().getText(),
        visibility: this.getVisibility(method),
        isStatic: method.isStatic(),
        isAsync: method.isAsync(),
      };
    });

    return {
      name: cls.getName() || 'anonymous',
      description,
      extends: cls.getExtends()?.getText() || null,
      implements: cls.getImplements().map((impl) => impl.getText()),
      properties,
      methods,
      isAbstract: cls.isAbstract(),
      isExported: cls.isExported(),
      decorators: cls.getDecorators().map((d) => d.getText()),
      filePath: sourceFile.getFilePath(),
      line: cls.getStartLineNumber(),
    };
  }

  /**
   * インターフェース宣言を解析します
   *
   * @private
   * @param iface - インターフェース宣言ノード
   * @param sourceFile - ソースファイル
   * @returns {InterfaceInfo} インターフェース情報
   */
  private analyzeInterfaceDeclaration(
    iface: InterfaceDeclaration,
    sourceFile: SourceFile
  ): InterfaceInfo {
    const jsDocs = iface.getJsDocs();
    const description = this.extractDescription(jsDocs);

    const properties = iface.getProperties().map((prop) => {
      const propJsDocs = prop.getJsDocs();
      return {
        name: prop.getName(),
        type: prop.getType().getText(),
        optional: prop.hasQuestionToken(),
        description: this.extractDescription(propJsDocs),
      };
    });

    const methods = iface.getMethods().map((method) => {
      const methodJsDocs = method.getJsDocs();
      return {
        name: method.getName(),
        description: this.extractDescription(methodJsDocs),
        parameters: method.getParameters().map((param) => ({
          name: param.getName(),
          type: param.getType().getText(),
          optional: param.isOptional(),
        })),
        returnType: method.getReturnType().getText(),
      };
    });

    return {
      name: iface.getName(),
      description,
      extends: iface.getExtends().map((ext) => ext.getText()),
      properties,
      methods,
      isExported: iface.isExported(),
      filePath: sourceFile.getFilePath(),
      line: iface.getStartLineNumber(),
    };
  }

  /**
   * JSDocから説明文を抽出します
   *
   * @private
   * @param jsDocs - JSDocノードの配列
   * @returns {string} 説明文
   */
  private extractDescription(jsDocs: JSDoc[]): string {
    if (jsDocs.length === 0) return '';

    const firstDoc = jsDocs[0];
    if (!firstDoc) return '';
    const description = firstDoc.getDescription().trim();

    return description;
  }

  /**
   * JSDocからパラメータの説明を抽出します
   *
   * @private
   * @param jsDocs - JSDocノードの配列
   * @returns {Record<string, string>} パラメータ名と説明のマップ
   */
  private extractParamDescriptions(jsDocs: JSDoc[]): Record<string, string> {
    const paramDescriptions: Record<string, string> = {};

    for (const jsDoc of jsDocs) {
      const tags = jsDoc.getTags();
      for (const tag of tags) {
        if (tag.getTagName() === 'param') {
          const tagText = tag.getText();
          const match = tagText.match(/@param\s+(\w+)\s+-\s+(.+)/);
          if (match && match[1] && match[2]) {
            paramDescriptions[match[1]] = match[2].trim();
          }
        }
      }
    }

    return paramDescriptions;
  }

  /**
   * メンバーの可視性を取得します
   *
   * @private
   * @param member - クラスメンバー
   * @returns {'public' | 'private' | 'protected'} 可視性
   */
  private getVisibility(member: any): 'public' | 'private' | 'protected' {
    if (member.hasModifier) {
      if (member.hasModifier(SyntaxKind.PrivateKeyword)) return 'private';
      if (member.hasModifier(SyntaxKind.ProtectedKeyword)) return 'protected';
    }
    return 'public';
  }

  /**
   * プロジェクト情報を取得します
   *
   * @returns {object} プロジェクト情報
   */
  public getProjectInfo(): { totalSourceFiles: number; rootDirectory: string } {
    return {
      totalSourceFiles: this.sourceFiles.length,
      rootDirectory: this.project.getRootDirectories()[0]?.getPath() || 'N/A',
    };
  }
}
