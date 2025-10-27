/**
 * SessionManager - Tmux Session Management
 *
 * Manages multiple Claude Code sessions running in tmux
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { SessionStatus, WaterSpiderConfig } from './water-spider-agent';

export class SessionManager {
  private sessions: Map<string, SessionStatus> = new Map();
  private config: WaterSpiderConfig;

  constructor(config: WaterSpiderConfig) {
    this.config = config;
  }

  /**
   * Discover worktrees and create session entries
   */
  async discoverWorktrees(): Promise<void> {
    const worktreesDir = '.worktrees';

    if (!fs.existsSync(worktreesDir)) {
      return;
    }

    const entries = fs.readdirSync(worktreesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const worktreePath = path.join(worktreesDir, entry.name);
        const sessionId = entry.name; // e.g., issue-101-phase3-review

        // Check if tmux session exists
        const tmuxSessionName = `miyabi-${sessionId}`;
        const exists = this.checkTmuxSession(tmuxSessionName);

        this.sessions.set(sessionId, {
          sessionId,
          worktreePath,
          status: exists ? 'running' : 'stopped',
          lastActivity: Date.now(),
          idleTime: 0,
          needsContinue: false,
        });
      }
    }
  }

  /**
   * Check all sessions and update their status
   */
  async checkAllSessions(): Promise<SessionStatus[]> {
    const now = Date.now();
    const maxIdleTime = this.config.maxIdleTime || 30000;

    for (const [sessionId, session] of this.sessions) {
      // Check if tmux session is running
      const tmuxSessionName = `miyabi-${sessionId}`;
      const isRunning = this.checkTmuxSession(tmuxSessionName);

      if (!isRunning) {
        session.status = 'stopped';
        session.needsContinue = false;
        continue;
      }

      // Capture tmux pane content to detect idle state
      const isIdle = this.detectIdleState(tmuxSessionName);

      if (isIdle) {
        session.status = 'idle';
        session.idleTime = now - session.lastActivity;

        // Check if needs continue
        if (session.idleTime >= maxIdleTime) {
          session.needsContinue = true;
        }
      } else {
        session.status = 'running';
        session.lastActivity = now;
        session.idleTime = 0;
        session.needsContinue = false;
      }

      this.sessions.set(sessionId, session);
    }

    return Array.from(this.sessions.values());
  }

  /**
   * Send continue signal to session
   */
  async sendContinue(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const tmuxSessionName = `miyabi-${sessionId}`;

    // Send "続けてください" to tmux session
    execSync(
      `tmux send-keys -t ${tmuxSessionName} "続けてください" Enter`,
      { stdio: 'ignore' }
    );

    // Update last activity
    session.lastActivity = Date.now();
    session.idleTime = 0;
    session.needsContinue = false;
    this.sessions.set(sessionId, session);
  }

  /**
   * Restart session
   */
  async restartSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const tmuxSessionName = `miyabi-${sessionId}`;

    // Kill existing session if exists
    if (this.checkTmuxSession(tmuxSessionName)) {
      execSync(`tmux kill-session -t ${tmuxSessionName}`, {
        stdio: 'ignore',
      });
    }

    // Create new session
    execSync(
      `tmux new-session -d -s ${tmuxSessionName} -c ${session.worktreePath}`,
      { stdio: 'ignore' }
    );

    // Start Claude Code
    execSync(
      `tmux send-keys -t ${tmuxSessionName} "npx --yes @anthropic-ai/claude-code" Enter`,
      { stdio: 'ignore' }
    );

    // Update status
    session.status = 'running';
    session.lastActivity = Date.now();
    session.idleTime = 0;
    session.needsContinue = false;
    this.sessions.set(sessionId, session);
  }

  /**
   * Get all sessions
   */
  getSessions(): SessionStatus[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get specific session
   */
  getSession(sessionId: string): SessionStatus | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    // Optional: Kill all managed tmux sessions
    // for (const sessionId of this.sessions.keys()) {
    //   const tmuxSessionName = `miyabi-${sessionId}`;
    //   if (this.checkTmuxSession(tmuxSessionName)) {
    //     execSync(`tmux kill-session -t ${tmuxSessionName}`, { stdio: 'ignore' });
    //   }
    // }
    this.sessions.clear();
  }

  /**
   * Check if tmux session exists
   */
  private checkTmuxSession(sessionName: string): boolean {
    try {
      execSync(`tmux has-session -t ${sessionName} 2>/dev/null`, {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect idle state by capturing pane content
   */
  private detectIdleState(sessionName: string): boolean {
    try {
      const output = execSync(`tmux capture-pane -t ${sessionName} -p`, {
        encoding: 'utf-8',
      });

      // Check for idle indicators
      const idleKeywords = [
        '続けますか',
        'Continue?',
        'Next?',
        'Press Enter',
        'Waiting',
      ];

      return idleKeywords.some((keyword) => output.includes(keyword));
    } catch {
      return false;
    }
  }
}
