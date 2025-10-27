/**
 * agents/ui/table.ts
 *
 * Table formatter for displaying structured data in CLI
 * Provides beautiful table rendering with borders, colors, and alignment
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import { theme } from './theme';

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: number;
  color?: string;
}

export interface TableOptions {
  title?: string;
  columns: TableColumn[];
  data: Record<string, any>[];
  borderColor?: string;
  headerColor?: string;
  compact?: boolean;
}

/**
 * Create a beautifully formatted table
 */
export function createTable(options: TableOptions): string {
  const {
    title,
    columns,
    data,
    borderColor = theme.colors.primary,
    headerColor = theme.colors.primary,
    compact = false,
  } = options;

  // Prepare table configuration
  const tableConfig: any = {
    head: columns.map(col =>
      chalk.hex(headerColor).bold(col.label)
    ),
    colAligns: columns.map(col => col.align || 'left'),
    colWidths: columns.map(col => col.width),
    style: {
      head: [],
      border: [],
      compact: compact,
    },
    chars: compact ? {
      'top': '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      'bottom': '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      'left': '│',
      'left-mid': '├',
      'mid': '─',
      'mid-mid': '┼',
      'right': '│',
      'right-mid': '┤',
      'middle': '│',
    } : {
      'top': '═',
      'top-mid': '╤',
      'top-left': '╔',
      'top-right': '╗',
      'bottom': '═',
      'bottom-mid': '╧',
      'bottom-left': '╚',
      'bottom-right': '╝',
      'left': '║',
      'left-mid': '╟',
      'mid': '─',
      'mid-mid': '┼',
      'right': '║',
      'right-mid': '╢',
      'middle': '│',
    },
  };

  const table = new Table(tableConfig);

  // Add rows
  data.forEach(row => {
    const cells = columns.map(col => {
      const value = row[col.key];
      const formatted = formatCellValue(value);
      return col.color ? chalk.hex(col.color)(formatted) : formatted;
    });
    table.push(cells);
  });

  // Add title if provided
  let output = '';
  if (title) {
    output += '\n' + chalk.hex(borderColor).bold(title) + '\n';
  }
  output += table.toString();

  return output;
}

/**
 * Format cell value with appropriate styling
 */
function formatCellValue(value: any): string {
  if (value === null || value === undefined) {
    return chalk.gray('-');
  }

  if (typeof value === 'boolean') {
    return value
      ? chalk.hex(theme.colors.success)('✓')
      : chalk.hex(theme.colors.error)('✗');
  }

  if (typeof value === 'number') {
    return chalk.cyan(value.toString());
  }

  if (typeof value === 'string') {
    // Special formatting for common patterns
    if (value.startsWith('✅') || value.startsWith('✓')) {
      return chalk.hex(theme.colors.success)(value);
    }
    if (value.startsWith('❌') || value.startsWith('✗')) {
      return chalk.hex(theme.colors.error)(value);
    }
    if (value.startsWith('⚠️') || value.startsWith('⚠')) {
      return chalk.hex(theme.colors.warning)(value);
    }
    if (value.startsWith('ℹ️') || value.startsWith('ℹ')) {
      return chalk.hex(theme.colors.info)(value);
    }
  }

  return String(value);
}

/**
 * Create a summary table (2-column key-value pairs)
 */
export function createSummaryTable(
  data: Record<string, any>,
  options?: {
    title?: string;
    keyColor?: string;
    valueColor?: string;
    borderColor?: string;
  }
): string {
  const {
    title,
    keyColor = theme.colors.primary,
    valueColor = theme.colors.white,
    borderColor = theme.colors.primary,
  } = options || {};

  const columns: TableColumn[] = [
    { key: 'key', label: 'Property', align: 'left', color: keyColor },
    { key: 'value', label: 'Value', align: 'left', color: valueColor },
  ];

  const tableData = Object.entries(data).map(([key, value]) => ({
    key,
    value,
  }));

  return createTable({
    title,
    columns,
    data: tableData,
    borderColor,
    compact: true,
  });
}

/**
 * Create a status table for agents
 */
export interface AgentStatus {
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  task?: string;
  duration?: number;
}

export function createAgentStatusTable(agents: AgentStatus[]): string {
  const columns: TableColumn[] = [
    { key: 'icon', label: '', width: 3, align: 'center' },
    { key: 'name', label: 'Agent', width: 20, align: 'left' },
    { key: 'status', label: 'Status', width: 12, align: 'center' },
    { key: 'task', label: 'Current Task', width: 40, align: 'left' },
    { key: 'duration', label: 'Time', width: 10, align: 'right' },
  ];

  const data = agents.map(agent => ({
    icon: getStatusIcon(agent.status),
    name: agent.name,
    status: getStatusText(agent.status),
    task: agent.task || chalk.gray('—'),
    duration: agent.duration
      ? formatDuration(agent.duration)
      : chalk.gray('—'),
  }));

  return createTable({
    title: '🤖 Agent Status',
    columns,
    data,
    borderColor: theme.colors.agent,
    headerColor: theme.colors.agent,
  });
}

function getStatusIcon(status: AgentStatus['status']): string {
  switch (status) {
    case 'idle':
      return chalk.gray('◯');
    case 'running':
      return chalk.hex(theme.colors.info)('◉');
    case 'success':
      return chalk.hex(theme.colors.success)('✓');
    case 'error':
      return chalk.hex(theme.colors.error)('✗');
  }
}

function getStatusText(status: AgentStatus['status']): string {
  switch (status) {
    case 'idle':
      return chalk.gray('Idle');
    case 'running':
      return chalk.hex(theme.colors.info).bold('Running');
    case 'success':
      return chalk.hex(theme.colors.success).bold('Success');
    case 'error':
      return chalk.hex(theme.colors.error).bold('Error');
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return chalk.cyan(`${ms}ms`);
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return chalk.cyan(`${seconds}s`);
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return chalk.cyan(`${minutes}m ${remainingSeconds}s`);
}

/**
 * Create a KPI metrics table
 */
export interface KPIMetric {
  name: string;
  current: number | string;
  target: number | string;
  status: 'good' | 'warning' | 'bad';
}

export function createKPITable(metrics: KPIMetric[]): string {
  const columns: TableColumn[] = [
    { key: 'name', label: 'KPI', width: 30, align: 'left' },
    { key: 'current', label: 'Current', width: 15, align: 'right' },
    { key: 'target', label: 'Target', width: 15, align: 'right' },
    { key: 'status', label: 'Status', width: 10, align: 'center' },
  ];

  const data = metrics.map(metric => ({
    name: metric.name,
    current: formatMetricValue(metric.current, metric.status),
    target: chalk.gray(String(metric.target)),
    status: getMetricStatusIcon(metric.status),
  }));

  return createTable({
    title: '📊 KPI Metrics',
    columns,
    data,
    borderColor: theme.colors.info,
    headerColor: theme.colors.info,
  });
}

function formatMetricValue(value: number | string, status: KPIMetric['status']): string {
  const color =
    status === 'good' ? theme.colors.success :
    status === 'warning' ? theme.colors.warning :
    theme.colors.error;

  return chalk.hex(color).bold(String(value));
}

function getMetricStatusIcon(status: KPIMetric['status']): string {
  switch (status) {
    case 'good':
      return chalk.hex(theme.colors.success)('✓');
    case 'warning':
      return chalk.hex(theme.colors.warning)('⚠');
    case 'bad':
      return chalk.hex(theme.colors.error)('✗');
  }
}
