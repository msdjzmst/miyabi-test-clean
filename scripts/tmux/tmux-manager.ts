/**
 * TmuxManager - Tmux Session Management CLI
 *
 * Create and manage tmux sessions for Water Spider pattern
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface TmuxSessionConfig {
  sessionName: string;
  worktreePath: string;
  command?: string;
}

export class TmuxManager {
  /**
   * Create a new tmux session for a worktree
   */
  static createSession(config: TmuxSessionConfig): void {
    const { sessionName, worktreePath, command } = config;

    console.log(`🔧 Creating tmux session: ${sessionName}`);
    console.log(`   Worktree: ${worktreePath}`);

    // Check if session already exists
    if (TmuxManager.sessionExists(sessionName)) {
      console.log(`   ⚠️  Session already exists, killing old session`);
      TmuxManager.killSession(sessionName);
    }

    // Create new tmux session
    execSync(`tmux new-session -d -s ${sessionName} -c ${worktreePath}`, {
      stdio: 'inherit',
    });

    console.log(`   ✅ Session created: ${sessionName}`);

    // Send initial command if provided
    if (command) {
      TmuxManager.sendCommand(sessionName, command);
    }
  }

  /**
   * Create sessions for all worktrees
   */
  static createAllSessions(worktreesDir: string = '.worktrees'): void {
    console.log('🚀 Creating tmux sessions for all worktrees');
    console.log(`   Worktrees directory: ${worktreesDir}`);
    console.log('');

    if (!fs.existsSync(worktreesDir)) {
      console.log('   ❌ Worktrees directory not found');
      return;
    }

    const entries = fs.readdirSync(worktreesDir, { withFileTypes: true });
    const worktrees = entries.filter((e) => e.isDirectory());

    console.log(`   Found ${worktrees.length} worktrees`);
    console.log('');

    for (const worktree of worktrees) {
      const sessionName = `miyabi-${worktree.name}`;
      const worktreePath = path.join(worktreesDir, worktree.name);

      TmuxManager.createSession({
        sessionName,
        worktreePath,
        command: 'npx --yes @anthropic-ai/claude-code',
      });

      console.log('');
    }

    console.log('✅ All sessions created');
    TmuxManager.listSessions();
  }

  /**
   * Send command to tmux session
   */
  static sendCommand(sessionName: string, command: string): void {
    execSync(`tmux send-keys -t ${sessionName} "${command}" Enter`, {
      stdio: 'inherit',
    });
    console.log(`   📤 Command sent: ${command}`);
  }

  /**
   * Kill a tmux session
   */
  static killSession(sessionName: string): void {
    try {
      execSync(`tmux kill-session -t ${sessionName}`, { stdio: 'ignore' });
      console.log(`   ✅ Session killed: ${sessionName}`);
    } catch {
      console.log(`   ⚠️  Session not found: ${sessionName}`);
    }
  }

  /**
   * Kill all Miyabi tmux sessions
   */
  static killAllSessions(): void {
    console.log('🛑 Killing all Miyabi tmux sessions');

    const sessions = TmuxManager.getMiyabiSessions();

    if (sessions.length === 0) {
      console.log('   No Miyabi sessions found');
      return;
    }

    for (const session of sessions) {
      TmuxManager.killSession(session);
    }

    console.log(`✅ Killed ${sessions.length} sessions`);
  }

  /**
   * Check if session exists
   */
  static sessionExists(sessionName: string): boolean {
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
   * List all tmux sessions
   */
  static listSessions(): void {
    console.log('📋 Active tmux sessions:');
    try {
      execSync('tmux list-sessions', { stdio: 'inherit' });
    } catch {
      console.log('   No active sessions');
    }
  }

  /**
   * Get all Miyabi sessions
   */
  static getMiyabiSessions(): string[] {
    try {
      const output = execSync('tmux list-sessions -F "#{session_name}"', {
        encoding: 'utf-8',
      });
      const sessions = output.trim().split('\n');
      return sessions.filter((s) => s.startsWith('miyabi-'));
    } catch {
      return [];
    }
  }

  /**
   * Attach to a session
   */
  static attachSession(sessionName: string): void {
    console.log(`🔗 Attaching to session: ${sessionName}`);
    console.log('   (Press Ctrl+B then D to detach)');
    execSync(`tmux attach-session -t ${sessionName}`, { stdio: 'inherit' });
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'create-all':
      TmuxManager.createAllSessions();
      break;

    case 'kill-all':
      TmuxManager.killAllSessions();
      break;

    case 'list':
      TmuxManager.listSessions();
      break;

    case 'attach':
      const sessionName = process.argv[3];
      if (!sessionName) {
        console.error('Usage: tsx tmux-manager.ts attach <session-name>');
        process.exit(1);
      }
      TmuxManager.attachSession(sessionName);
      break;

    default:
      console.log('Tmux Manager - Miyabi Water Spider Pattern');
      console.log('');
      console.log('Usage:');
      console.log('  tsx tmux-manager.ts create-all       Create sessions for all worktrees');
      console.log('  tsx tmux-manager.ts kill-all         Kill all Miyabi sessions');
      console.log('  tsx tmux-manager.ts list             List all sessions');
      console.log('  tsx tmux-manager.ts attach <name>    Attach to a session');
      process.exit(1);
  }
}
