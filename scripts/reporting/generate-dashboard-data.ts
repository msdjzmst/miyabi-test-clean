/**
 * Generate Dashboard Data
 *
 * Fetches KPI data from Projects V2 and generates JSON for GitHub Pages dashboard
 */

import { ProjectsV2Client } from '@miyabi/coding-agents/github/projects-v2';
import * as fs from 'fs';
import * as path from 'path';

interface DashboardData {
  generated: string;
  summary: {
    totalIssues: number;
    completedIssues: number;
    completionRate: number;
    avgDuration: number;
    totalCost: number;
    avgQualityScore: number;
  };
  trends: Array<{
    date: string;
    completed: number;
    inProgress: number;
    cost: number;
  }>;
  agents: Array<{
    name: string;
    tasksCompleted: number;
    avgDuration: number;
    avgCost: number;
    avgQuality: number;
  }>;
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_PROJECT_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN or GH_PROJECT_TOKEN environment variable is required');
  }

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'ShunsukeHayashi/Autonomous-Operations').split('/');
  const projectNumber = parseInt(process.env.GITHUB_PROJECT_NUMBER || '1');

  console.log('📊 Generating dashboard data...');
  console.log(`  Owner: ${owner}`);
  console.log(`  Repo: ${repo}`);
  console.log(`  Project: #${projectNumber}`);

  // Initialize Projects V2 client
  const client = new ProjectsV2Client(token, {
    owner,
    repo,
    projectNumber,
  });

  await client.initialize();

  // Generate KPI report
  const kpi = await client.generateKPIReport();

  // Calculate completion rate
  const completionRate = kpi.totalIssues > 0
    ? (kpi.completedIssues / kpi.totalIssues) * 100
    : 0;

  // Build dashboard data
  const dashboardData: DashboardData = {
    generated: new Date().toISOString(),
    summary: {
      totalIssues: kpi.totalIssues,
      completedIssues: kpi.completedIssues,
      completionRate: Math.round(completionRate * 10) / 10,
      avgDuration: Math.round(kpi.avgDuration * 10) / 10,
      totalCost: Math.round(kpi.totalCost * 100) / 100,
      avgQualityScore: Math.round(kpi.avgQualityScore * 10) / 10,
    },
    trends: generateMockTrends(), // TODO: Implement real trend data
    agents: generateMockAgentData(), // TODO: Implement real agent data
  };

  // Ensure docs directory exists
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Write to docs/dashboard-data.json
  const outputPath = path.join(docsDir, 'dashboard-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));

  console.log(`\n✓ Dashboard data generated: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`  Total Issues: ${dashboardData.summary.totalIssues}`);
  console.log(`  Completed: ${dashboardData.summary.completedIssues} (${dashboardData.summary.completionRate}%)`);
  console.log(`  Avg Duration: ${dashboardData.summary.avgDuration} min`);
  console.log(`  Total Cost: $${dashboardData.summary.totalCost}`);
  console.log(`  Avg Quality: ${dashboardData.summary.avgQualityScore}/100`);
}

/**
 * Generate mock trend data (last 7 days)
 * TODO: Replace with real data from Projects V2 history
 */
function generateMockTrends() {
  const trends = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    trends.push({
      date: date.toISOString().split('T')[0],
      completed: Math.floor(Math.random() * 5) + 1,
      inProgress: Math.floor(Math.random() * 3) + 1,
      cost: Math.round((Math.random() * 0.5 + 0.1) * 100) / 100,
    });
  }

  return trends;
}

/**
 * Generate mock agent performance data
 * TODO: Replace with real data from Projects V2 custom fields
 */
function generateMockAgentData() {
  return [
    {
      name: 'CodeGenAgent',
      tasksCompleted: 8,
      avgDuration: 7.2,
      avgCost: 0.12,
      avgQuality: 93.5,
    },
    {
      name: 'ReviewAgent',
      tasksCompleted: 5,
      avgDuration: 3.5,
      avgCost: 0.05,
      avgQuality: 96.2,
    },
    {
      name: 'DocsAgent',
      tasksCompleted: 3,
      avgDuration: 4.8,
      avgCost: 0.08,
      avgQuality: 91.7,
    },
    {
      name: 'DeploymentAgent',
      tasksCompleted: 2,
      avgDuration: 15.0,
      avgCost: 0.30,
      avgQuality: 98.5,
    },
  ];
}

main().catch((error) => {
  console.error('Error generating dashboard data:', error);
  process.exit(1);
});
