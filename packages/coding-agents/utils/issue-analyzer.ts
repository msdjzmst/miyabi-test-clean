/**
 * IssueAnalyzer - Shared utility for Issue analysis
 *
 * Consolidates duplicate Issue analysis logic used across:
 * - CoordinatorAgent
 * - IssueAgent
 *
 * This utility provides consistent Issue type, severity, impact, and duration estimation.
 */

import { Issue, Task, Severity, ImpactLevel } from '../types/index';

export class IssueAnalyzer {
  /**
   * Determine task type from labels or title
   */
  static determineType(
    labels: string[],
    title: string,
    body: string = ''
  ): Task['type'] {
    const text = (title + ' ' + body).toLowerCase();

    // Check existing labels first
    for (const label of labels) {
      if (label.includes('feature')) return 'feature';
      if (label.includes('bug')) return 'bug';
      if (label.includes('refactor')) return 'refactor';
      if (label.includes('documentation')) return 'docs';
      if (label.includes('test')) return 'test';
      if (label.includes('deployment')) return 'deployment';
    }

    // Keyword-based detection
    if (text.match(/\b(bug|fix|error|issue|problem|broken)\b/)) return 'bug';
    if (text.match(/\b(feature|add|new|implement|create)\b/)) return 'feature';
    if (text.match(/\b(refactor|cleanup|improve|optimize)\b/)) return 'refactor';
    if (text.match(/\b(doc|documentation|readme|guide)\b/)) return 'docs';
    if (text.match(/\b(test|spec|coverage)\b/)) return 'test';
    if (text.match(/\b(deploy|release|ci|cd)\b/)) return 'deployment';

    return 'feature'; // Default
  }

  /**
   * Determine Issue type from Issue object
   */
  static determineIssueType(issue: Issue): Task['type'] {
    return this.determineType(issue.labels, issue.title, issue.body);
  }

  /**
   * Determine severity from labels or content
   */
  static determineSeverity(
    labels: string[],
    title: string,
    body: string = ''
  ): Severity {
    const text = (title + ' ' + body).toLowerCase();

    // Check existing labels first
    for (const label of labels) {
      if (label.includes('Sev.1-Critical')) return 'Sev.1-Critical';
      if (label.includes('Sev.2-High')) return 'Sev.2-High';
      if (label.includes('Sev.3-Medium')) return 'Sev.3-Medium';
      if (label.includes('Sev.4-Low')) return 'Sev.4-Low';
      if (label.includes('Sev.5-Trivial')) return 'Sev.5-Trivial';
    }

    // Keyword-based detection
    if (text.match(/\b(critical|urgent|emergency|blocking|blocker|production|data loss|security breach)\b/)) {
      return 'Sev.1-Critical';
    }
    if (text.match(/\b(high priority|asap|important|major|broken)\b/)) {
      return 'Sev.2-High';
    }
    if (text.match(/\b(minor|small|trivial|typo|cosmetic)\b/)) {
      return 'Sev.4-Low';
    }
    if (text.match(/\b(nice to have|enhancement|suggestion)\b/)) {
      return 'Sev.5-Trivial';
    }

    return 'Sev.3-Medium'; // Default
  }

  /**
   * Determine severity from Issue object
   */
  static determineSeverityFromIssue(issue: Issue): Severity {
    return this.determineSeverity(issue.labels, issue.title, issue.body);
  }

  /**
   * Determine impact level from labels or content
   */
  static determineImpact(
    labels: string[],
    title: string,
    body: string = ''
  ): ImpactLevel {
    const text = (title + ' ' + body).toLowerCase();

    // Check existing labels first
    for (const label of labels) {
      if (label.includes('影響度-Critical')) return 'Critical';
      if (label.includes('影響度-High')) return 'High';
      if (label.includes('影響度-Medium')) return 'Medium';
      if (label.includes('影響度-Low')) return 'Low';
    }

    // Keyword-based detection
    if (text.match(/\b(all users|entire system|complete failure|data loss)\b/)) {
      return 'Critical';
    }
    if (text.match(/\b(many users|major feature|main functionality)\b/)) {
      return 'High';
    }
    if (text.match(/\b(some users|workaround exists|minor feature)\b/)) {
      return 'Medium';
    }

    return 'Low'; // Default
  }

  /**
   * Determine impact from Issue object
   */
  static determineImpactFromIssue(issue: Issue): ImpactLevel {
    return this.determineImpact(issue.labels, issue.title, issue.body);
  }

  /**
   * Estimate task duration (minutes)
   */
  static estimateDuration(
    title: string,
    body: string,
    type: Task['type']
  ): number {
    const baseEstimates: Record<Task['type'], number> = {
      feature: 120, // Use IssueAgent's more conservative estimate
      bug: 60,
      refactor: 90,
      docs: 30,
      test: 45,
      deployment: 30,
    };

    let estimate = baseEstimates[type];

    // Adjust based on complexity indicators
    const text = (title + ' ' + body).toLowerCase();
    if (text.match(/\b(large|major|complex|multiple)\b/)) {
      estimate *= 2;
    }
    if (text.match(/\b(quick|small|minor|simple)\b/)) {
      estimate *= 0.5;
    }

    return Math.round(estimate);
  }

  /**
   * Estimate duration from Issue object
   */
  static estimateDurationFromIssue(issue: Issue, type: Task['type']): number {
    return this.estimateDuration(issue.title, issue.body, type);
  }

  /**
   * Extract dependency Issue numbers (#123 format)
   */
  static extractDependencies(body: string): string[] {
    const dependencyPattern = /#(\d+)/g;
    const matches = [...body.matchAll(dependencyPattern)];
    return matches.map(m => `issue-${m[1]}`);
  }

  /**
   * Extract dependencies from Issue object
   */
  static extractDependenciesFromIssue(issue: Issue): string[] {
    return this.extractDependencies(issue.body);
  }
}
