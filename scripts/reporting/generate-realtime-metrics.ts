#!/usr/bin/env tsx
/**
 * Real-time Metrics Generator for Phase G
 *
 * Integrates Projects V2 data with live KPI dashboard
 * Generates JSON data for GitHub Pages dashboard
 */

import { getProjectItems } from '../projects-graphql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface AgentMetrics {
  name: string;
  totalIssues: number;
  completedIssues: number;
  avgDuration: number;
  avgCost: number;
  successRate: number;
  activeIssues: number;
}

interface StateMetrics {
  state: string;
  count: number;
  percentage: number;
  avgTimeInState: number;
}

interface PriorityMetrics {
  priority: string;
  count: number;
  completed: number;
  completionRate: number;
}

interface DashboardData {
  timestamp: string;
  summary: {
    totalIssues: number;
    completedIssues: number;
    inProgressIssues: number;
    completionRate: number;
    avgDuration: number;
    totalCost: number;
    avgQualityScore: number;
  };
  agents: AgentMetrics[];
  states: StateMetrics[];
  priorities: PriorityMetrics[];
  recentActivity: Array<{
    number: number;
    title: string;
    state: string;
    agent: string;
    duration: number | null;
    timestamp: string;
  }>;
  trends: {
    dailyCompletions: Array<{ date: string; count: number }>;
    weeklyVelocity: number;
    burndownRate: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'ShunsukeHayashi';
const PROJECT_NUMBER = parseInt(process.env.PROJECT_NUMBER || '1');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Read quality scores from LDD logs in .ai/logs directory
 */
function getQualityScoresFromLogs(): number[] {
  const logsDir = path.join(process.cwd(), '.ai', 'logs');
  const scores: number[] = [];

  try {
    if (!fs.existsSync(logsDir)) {
      return scores;
    }

    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.jsonl'));

    for (const file of logFiles) {
      const filePath = path.join(logsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          // Look for ReviewAgent quality scores
          if (log.agentType === 'ReviewAgent' && log.qualityScore !== undefined) {
            scores.push(log.qualityScore);
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Failed to read quality scores from logs: ${(error as Error).message}`);
  }

  return scores;
}

// ============================================================================
// Metrics Calculation
// ============================================================================

async function generateMetrics(): Promise<DashboardData> {
  console.log('📊 Fetching project data...');

  const items = await getProjectItems(GITHUB_OWNER, PROJECT_NUMBER, GITHUB_TOKEN!);

  console.log(`✅ Fetched ${items.length} items`);

  // Summary metrics
  const completedItems = items.filter(
    (item: any) => item.content.state === 'CLOSED' || item.content.state === 'MERGED',
  );
  const inProgressItems = items.filter((item: any) => item.content.state === 'OPEN');

  // Agent metrics
  const agentMap = new Map<string, any[]>();
  items.forEach((item: any) => {
    const agentField = item.fieldValues.nodes.find((fv: any) => fv.field?.name === 'Agent');
    const agent = (agentField)?.name || 'Unassigned';

    if (!agentMap.has(agent)) {
      agentMap.set(agent, []);
    }
    agentMap.get(agent)!.push(item);
  });

  const agents: AgentMetrics[] = Array.from(agentMap.entries()).map(([name, agentItems]) => {
    const completed = agentItems.filter(
      (item: any) => item.content.state === 'CLOSED' || item.content.state === 'MERGED',
    );
    const durations = agentItems
      .map((item: any) => {
        const durationField = item.fieldValues.nodes.find((fv: any) => fv.field?.name === 'Duration');
        return (durationField)?.number || null;
      })
      .filter((d: any) => d !== null);

    const avgDuration = durations.length > 0
      ? durations.reduce((a: any, b: any) => a + b, 0) / durations.length
      : 0;

    return {
      name,
      totalIssues: agentItems.length,
      completedIssues: completed.length,
      avgDuration,
      avgCost: avgDuration * 0.015, // Estimate: $0.015/min
      successRate: agentItems.length > 0 ? (completed.length / agentItems.length) * 100 : 0,
      activeIssues: agentItems.length - completed.length,
    };
  });

  // State metrics
  const stateMap = new Map<string, any[]>();
  items.forEach((item: any) => {
    const stateField = item.fieldValues.nodes.find((fv: any) => fv.field?.name === 'State');
    const state = (stateField)?.name || item.content.state;

    if (!stateMap.has(state)) {
      stateMap.set(state, []);
    }
    stateMap.get(state)!.push(item);
  });

  const states: StateMetrics[] = Array.from(stateMap.entries()).map(([state, stateItems]) => {
    // Calculate average time in state
    const durations = stateItems
      .map((item) => {
        if (!item.content.createdAt) return null;

        const startTime = new Date(item.content.createdAt).getTime();
        const endTime = item.content.closedAt
          ? new Date(item.content.closedAt).getTime()
          : Date.now();

        // Return duration in hours
        return (endTime - startTime) / (1000 * 60 * 60);
      })
      .filter((d) => d !== null && d >= 0);

    const avgTimeInState = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      state,
      count: stateItems.length,
      percentage: (stateItems.length / items.length) * 100,
      avgTimeInState: Math.round(avgTimeInState * 10) / 10, // Round to 1 decimal
    };
  });

  // Priority metrics
  const priorityMap = new Map<string, any[]>();
  items.forEach((item: any) => {
    const priorityField = item.fieldValues.nodes.find((fv: any) => fv.field?.name === 'Priority');
    const priority = (priorityField)?.name || 'P2-Medium';

    if (!priorityMap.has(priority)) {
      priorityMap.set(priority, []);
    }
    priorityMap.get(priority)!.push(item);
  });

  const priorities: PriorityMetrics[] = Array.from(priorityMap.entries()).map(
    ([priority, priorityItems]) => {
      const completed = priorityItems.filter(
        (item: any) => item.content.state === 'CLOSED' || item.content.state === 'MERGED',
      );
      return {
        priority,
        count: priorityItems.length,
        completed: completed.length,
        completionRate: priorityItems.length > 0
          ? (completed.length / priorityItems.length) * 100
          : 0,
      };
    },
  );

  // Recent activity (last 10 completed items)
  const recentActivity = completedItems
    .slice(-10)
    .reverse()
    .map((item: any) => {
      const agentField = item.fieldValues.nodes.find((fv: any) => fv.field?.name === 'Agent');
      const stateField = item.fieldValues.nodes.find((fv: any) => fv.field?.name === 'State');
      const durationField = item.fieldValues.nodes.find((fv: any) => fv.field?.name === 'Duration');

      return {
        number: item.content.number,
        title: item.content.title,
        state: (stateField)?.name || item.content.state,
        agent: (agentField)?.name || 'Unknown',
        duration: (durationField)?.number || null,
        timestamp: item.content.closedAt || new Date().toISOString(),
      };
    });

  // Trends (simplified for now)
  const trends = {
    dailyCompletions: [
      { date: new Date().toISOString().split('T')[0], count: completedItems.length },
    ],
    weeklyVelocity: completedItems.length / 7, // Rough estimate
    burndownRate: completedItems.length / items.length,
  };

  // Calculate average duration and cost
  const allDurations = items
    .map((item: any) => {
      const durationField = item.fieldValues.nodes.find((fv: any) => fv.field?.name === 'Duration');
      return (durationField)?.number || null;
    })
    .filter((d: any) => d !== null);

  const avgDuration = allDurations.length > 0
    ? allDurations.reduce((a: any, b: any) => a + b, 0) / allDurations.length
    : 0;

  const totalCost = avgDuration * items.length * 0.015;

  // Calculate average quality score from LDD logs
  const qualityScores = getQualityScoresFromLogs();
  const avgQualityScore = qualityScores.length > 0
    ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    : 0;

  console.log(`✅ Found ${qualityScores.length} quality scores from ReviewAgent logs`);

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: items.length,
      completedIssues: completedItems.length,
      inProgressIssues: inProgressItems.length,
      completionRate: items.length > 0 ? (completedItems.length / items.length) * 100 : 0,
      avgDuration,
      totalCost,
      avgQualityScore: Math.round(avgQualityScore * 10) / 10, // Round to 1 decimal
    },
    agents: agents.sort((a, b) => b.totalIssues - a.totalIssues),
    states: states.sort((a, b) => b.count - a.count),
    priorities: priorities.sort((a, b) => {
      const order = { 'P0-Critical': 0, 'P1-High': 1, 'P2-Medium': 2, 'P3-Low': 3 };
      return (order[a.priority as keyof typeof order] || 4) - (order[b.priority as keyof typeof order] || 4);
    }),
    recentActivity,
    trends,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is required');
    process.exit(1);
  }

  const outputPath = path.join(__dirname, '../docs/metrics.json');

  console.log('🚀 Generating real-time metrics...\n');

  const data = await generateMetrics();

  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log(`\n✅ Metrics generated: ${outputPath}`);
  console.log('\n📊 Summary:');
  console.log(`   Total Issues: ${data.summary.totalIssues}`);
  console.log(`   Completed: ${data.summary.completedIssues} (${data.summary.completionRate.toFixed(1)}%)`);
  console.log(`   In Progress: ${data.summary.inProgressIssues}`);
  console.log(`   Avg Duration: ${data.summary.avgDuration.toFixed(1)} min`);
  console.log(`   Total Cost: $${data.summary.totalCost.toFixed(2)}`);
  console.log(`\n🤖 Top Agents:`);
  data.agents.slice(0, 3).forEach((agent) => {
    console.log(`   ${agent.name}: ${agent.completedIssues}/${agent.totalIssues} (${agent.successRate.toFixed(1)}%)`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { generateMetrics };
export type { DashboardData };
