import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';

/**
 * Dashboard command for Miyabi CLI
 *
 * Provides dashboard management functionality:
 * - refresh: Refresh dashboard visuals
 * - status: Check dashboard server status
 * - open: Open dashboard in browser
 */

interface DashboardRefreshOptions {
  url?: string;
  target?: 'graph' | 'devices' | 'all';
  json?: boolean;
  watch?: boolean;
  interval?: number | string;
  timeout?: number | string;
}

interface DashboardStatusOptions {
  url?: string;
  json?: boolean;
}

interface DashboardOpenOptions {
  url?: string;
}

const DEFAULT_SERVER_URL = 'http://localhost:3001';
const DEFAULT_DASHBOARD_URL = 'http://localhost:5174/Miyabi/';
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_WATCH_INTERVAL = 30;

/**
 * Register dashboard command
 */
export function registerDashboardCommand(program: Command): void {
  const dashboard = program
    .command('dashboard')
    .description('Dashboard management commands');

  // refresh subcommand
  dashboard
    .command('refresh')
    .description('Refresh dashboard visuals')
    .option('-u, --url <url>', 'Dashboard server URL', DEFAULT_SERVER_URL)
    .option('-t, --target <type>', 'Refresh target (graph|devices|all)', 'all')
    .option('--json', 'Output in JSON format')
    .option('-w, --watch', 'Watch mode (auto-refresh)')
    .option('-i, --interval <seconds>', 'Watch mode interval', '30')
    .option('--timeout <ms>', 'Request timeout', '10000')
    .action(async (options: DashboardRefreshOptions) => {
      await refreshDashboard(options);
    });

  // status subcommand
  dashboard
    .command('status')
    .description('Check dashboard server status')
    .option('-u, --url <url>', 'Dashboard server URL', DEFAULT_SERVER_URL)
    .option('--json', 'Output in JSON format')
    .action(async (options: DashboardStatusOptions) => {
      await dashboardStatus(options);
    });

  // open subcommand
  dashboard
    .command('open')
    .description('Open dashboard in browser')
    .option('-u, --url <url>', 'Dashboard URL', DEFAULT_DASHBOARD_URL)
    .action(async (options: DashboardOpenOptions) => {
      await openDashboard(options);
    });
}

/**
 * Refresh dashboard
 */
async function refreshDashboard(options: DashboardRefreshOptions): Promise<void> {
  const {
    url = DEFAULT_SERVER_URL,
    target = 'all',
    json = false,
    watch = false,
  } = options;

  // Parse numeric options
  const interval = typeof options.interval === 'string' ? parseInt(options.interval, 10) : (options.interval || DEFAULT_WATCH_INTERVAL);
  const timeout = typeof options.timeout === 'string' ? parseInt(options.timeout, 10) : (options.timeout || DEFAULT_TIMEOUT);

  // Validate target
  if (!['graph', 'devices', 'all'].includes(target)) {
    if (json) {
      console.log(JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_TARGET',
          message: `Invalid target: ${target}`,
          suggestion: 'Use graph, devices, or all',
        },
      }));
    } else {
      console.error(chalk.red(`❌ Invalid target: ${target}`));
      console.error(chalk.yellow('💡 Use: graph, devices, or all'));
    }
    process.exit(3);
  }

  // Watch mode
  if (watch) {
    if (!json) {
      console.log(chalk.cyan('👀 Watch mode enabled'));
      console.log(chalk.gray(`   Refreshing every ${interval} seconds...\n`));
    }

    // Initial refresh
    await performRefresh(url, target, json, timeout);

    // Set up interval
    setInterval(async () => {
      await performRefresh(url, target, json, timeout);
    }, interval * 1000);

    return;
  }

  // Single refresh
  await performRefresh(url, target, json, timeout);
}

/**
 * Perform refresh operation
 */
async function performRefresh(
  url: string,
  target: string,
  json: boolean,
  timeout: number
): Promise<void> {
  const startTime = Date.now();
  let spinner: ReturnType<typeof ora> | null = null;

  if (!json) {
    spinner = ora('Refreshing dashboard...').start();
  }

  try {
    // Check server health first
    const healthCheck = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(timeout),
    });

    if (!healthCheck.ok) {
      throw new Error('Server health check failed');
    }

    // Perform refresh based on target
    const results: any = {};

    if (target === 'graph' || target === 'all') {
      const graphResponse = await fetch(`${url}/api/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeout),
      });

      const graphData = await graphResponse.json();
      results.graph = graphData;
    }

    if (target === 'devices' || target === 'all') {
      const devicesResponse = await fetch(`${url}/api/devices`, {
        signal: AbortSignal.timeout(timeout),
      });

      const devicesData = await devicesResponse.json();
      results.devices = devicesData;
    }

    const executionTime = Date.now() - startTime;

    if (json) {
      console.log(JSON.stringify({
        success: true,
        refreshed: {
          graph: target === 'graph' || target === 'all',
          devices: target === 'devices' || target === 'all',
          timestamp: new Date().toISOString(),
        },
        stats: {
          executionTime,
          ...extractStats(results),
        },
      }));
    } else {
      if (spinner) spinner.succeed('Dashboard refreshed');

      console.log(chalk.green('✅ ダッシュボードをリフレッシュしました'));

      if (results.devices) {
        const { devices, total } = results.devices;
        const onlineDevices = devices.filter((d: any) => d.status === 'online').length;
        const idleDevices = devices.filter((d: any) => d.status === 'idle').length;

        console.log(chalk.cyan(`📱 デバイス: ${total} 台 (${onlineDevices} online, ${idleDevices} idle)`));
      }

      if (results.graph && results.graph.rateLimited) {
        console.log(chalk.yellow('⚠️  GitHub API rate limit reached - using cached data'));
      }

      console.log(chalk.gray(`⏱️  実行時間: ${(executionTime / 1000).toFixed(1)}s`));
    }
  } catch (error: any) {
    const errorCode = error.name === 'AbortError' ? 'TIMEOUT' : 'SERVER_UNAVAILABLE';
    const errorMessage = error.name === 'AbortError'
      ? 'Request timed out'
      : error.message || 'Failed to connect to dashboard server';

    if (json) {
      console.log(JSON.stringify({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          suggestion: errorCode === 'SERVER_UNAVAILABLE'
            ? 'Start the server with: npm run dashboard:server'
            : 'Increase timeout with --timeout option',
        },
      }));
    } else {
      if (spinner) spinner.fail('Failed to refresh dashboard');

      console.error(chalk.red(`❌ ${errorMessage}`));

      if (errorCode === 'SERVER_UNAVAILABLE') {
        console.error(chalk.yellow('💡 Start the server with:'));
        console.error(chalk.white('   cd packages/dashboard-server && npm run dev'));
      } else {
        console.error(chalk.yellow(`💡 Try increasing timeout: --timeout ${timeout * 2}`));
      }
    }

    process.exit(4);
  }
}

/**
 * Check dashboard server status
 */
async function dashboardStatus(options: DashboardStatusOptions): Promise<void> {
  const { url = DEFAULT_SERVER_URL, json = false } = options;

  try {
    // Health check
    const healthResponse = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!healthResponse.ok) {
      throw new Error('Server health check failed');
    }

    const healthData = await healthResponse.json();

    // Get devices
    const devicesResponse = await fetch(`${url}/api/devices`);
    const devicesData = await devicesResponse.json() as any;

    // Get agents status
    const agentsResponse = await fetch(`${url}/api/agents/status`);
    const agentsData = await agentsResponse.json() as any;

    if (json) {
      console.log(JSON.stringify({
        success: true,
        server: {
          url,
          running: true,
          health: healthData,
        },
        metrics: {
          devices: devicesData.total || 0,
          agents: agentsData.agents?.length || 0,
        },
      }));
    } else {
      console.log(chalk.cyan.bold('\n🚀 Dashboard Server Status\n'));

      console.log(chalk.white('Server:'));
      console.log(chalk.green(`  ✅ Running at ${url}`));
      console.log(chalk.gray(`  📡 WebSocket: ws://localhost:3001`));

      console.log(chalk.white('\nMetrics:'));
      console.log(chalk.cyan(`  📱 Devices: ${devicesData.total || 0} connected`));

      if (devicesData.devices) {
        const online = devicesData.devices.filter((d: any) => d.status === 'online').length;
        const idle = devicesData.devices.filter((d: any) => d.status === 'idle').length;
        console.log(chalk.gray(`     (${online} online, ${idle} idle)`));
      }

      console.log(chalk.cyan(`  🤖 Agents: ${agentsData.agents?.length || 0} registered`));
      console.log('');
    }
  } catch (error: any) {
    if (json) {
      console.log(JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_UNAVAILABLE',
          message: 'Dashboard server is not running',
          suggestion: 'Start the server with: npm run dashboard:server',
        },
      }));
    } else {
      console.error(chalk.red('\n❌ Dashboard server is not running\n'));
      console.error(chalk.yellow('💡 Start the server with:'));
      console.error(chalk.white('   cd packages/dashboard-server && npm run dev\n'));
    }

    process.exit(4);
  }
}

/**
 * Open dashboard in browser
 */
async function openDashboard(options: DashboardOpenOptions): Promise<void> {
  const { url = DEFAULT_DASHBOARD_URL } = options;

  const spinner = ora('Opening dashboard in browser...').start();

  try {
    await open(url);
    spinner.succeed(`Dashboard opened: ${url}`);
  } catch (error: any) {
    spinner.fail('Failed to open dashboard');
    console.error(chalk.red(`❌ ${error.message}`));
    process.exit(1);
  }
}

/**
 * Extract stats from refresh results
 */
function extractStats(results: any): any {
  const stats: any = {};

  if (results.devices) {
    stats.devices = results.devices.total || 0;
  }

  return stats;
}
