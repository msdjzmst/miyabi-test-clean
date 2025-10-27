/**
 * WebSocket Server - Real-time dashboard updates
 *
 * Issue: #142 - Agent Activity Dashboard
 * Phase: Real-time Communication Infrastructure
 */

import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import {
  AgentDashboard,
  DashboardConfig,
  DEFAULT_DASHBOARD_CONFIG,
} from './dashboard-config';
import { MetricsCollector, globalMetricsCollector } from './metrics-collector';

// ============================================================================
// WebSocket Message Types
// ============================================================================

export interface DashboardMessage {
  type: 'dashboard' | 'alert' | 'ping' | 'pong';
  data?: any;
  timestamp: string;
}

// ============================================================================
// DashboardWebSocketServer Implementation
// ============================================================================

/**
 * DashboardWebSocketServer - Real-time dashboard data streaming
 *
 * Features:
 * - WebSocket connections management
 * - Periodic dashboard updates broadcast
 * - Event-driven updates (instant notifications)
 * - Client ping/pong for connection health
 */
export class DashboardWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private metricsCollector: MetricsCollector;
  private config: DashboardConfig;
  private clients: Set<WebSocket>;
  private broadcastInterval: NodeJS.Timeout | null;

  constructor(
    metricsCollector: MetricsCollector = globalMetricsCollector,
    config: Partial<DashboardConfig> = {}
  ) {
    super();

    this.config = { ...DEFAULT_DASHBOARD_CONFIG, ...config };
    this.metricsCollector = metricsCollector;
    this.clients = new Set();
    this.broadcastInterval = null;

    // Create WebSocket server
    this.wss = new WebSocketServer({
      port: this.config.websocketPort,
      path: '/ws/dashboard',
    });

    this.setupWebSocketServer();
    this.setupMetricsListeners();
    this.startBroadcasting();

    console.log(
      `Dashboard WebSocket server started on port ${this.config.websocketPort}`
    );
  }

  // ==========================================================================
  // WebSocket Server Setup
  // ==========================================================================

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Dashboard client connected');
      this.clients.add(ws);

      // Send initial dashboard state
      this.sendDashboard(ws);

      // Handle messages from client
      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Error parsing client message:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log('Dashboard client disconnected');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Setup ping/pong for connection health
      this.setupPingPong(ws);

      this.emit('client:connected', { clientCount: this.clients.size });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
      this.emit('server:error', error);
    });
  }

  /**
   * Setup ping/pong for connection health check
   */
  private setupPingPong(ws: WebSocket): void {
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const message: DashboardMessage = {
          type: 'ping',
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(message));
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // 30 seconds

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  }

  // ==========================================================================
  // Metrics Listeners
  // ==========================================================================

  /**
   * Setup listeners for metrics collector events
   */
  private setupMetricsListeners(): void {
    // Broadcast on agent started
    this.metricsCollector.on('agent:started', () => {
      this.broadcastDashboard();
    });

    // Broadcast on agent completed
    this.metricsCollector.on('agent:completed', () => {
      this.broadcastDashboard();
    });

    // Broadcast on agent failed
    this.metricsCollector.on('agent:failed', () => {
      this.broadcastDashboard();
    });

    // Broadcast on new alert
    this.metricsCollector.on('alert:created', (alert) => {
      this.broadcastAlert(alert);
    });

    // Broadcast on metrics update
    this.metricsCollector.on('metrics:updated', () => {
      // Only broadcast if there are active clients
      if (this.clients.size > 0) {
        this.broadcastDashboard();
      }
    });
  }

  // ==========================================================================
  // Broadcasting
  // ==========================================================================

  /**
   * Start periodic dashboard broadcasting
   */
  private startBroadcasting(): void {
    this.broadcastInterval = setInterval(() => {
      if (this.clients.size > 0) {
        this.broadcastDashboard();
      }
    }, this.config.updateInterval);
  }

  /**
   * Stop periodic broadcasting
   */
  private stopBroadcasting(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
  }

  /**
   * Broadcast dashboard state to all clients
   */
  private broadcastDashboard(): void {
    const dashboard = this.metricsCollector.getDashboard();
    const message: DashboardMessage = {
      type: 'dashboard',
      data: dashboard,
      timestamp: new Date().toISOString(),
    };

    this.broadcast(message);
  }

  /**
   * Broadcast alert to all clients
   */
  private broadcastAlert(alert: any): void {
    const message: DashboardMessage = {
      type: 'alert',
      data: alert,
      timestamp: new Date().toISOString(),
    };

    this.broadcast(message);
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: DashboardMessage): void {
    const payload = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (error) {
          console.error('Error sending to client:', error);
        }
      }
    });

    this.emit('broadcast', { message, clientCount: this.clients.size });
  }

  // ==========================================================================
  // Client Message Handling
  // ==========================================================================

  /**
   * Handle messages from client
   */
  private handleClientMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'pong':
        // Client responded to ping
        break;

      case 'acknowledge_alert':
        if (data.alertId) {
          this.metricsCollector.acknowledgeAlert(data.alertId);
        }
        break;

      case 'request_dashboard':
        // Client requesting dashboard state
        this.sendDashboard(ws);
        break;

      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  /**
   * Send dashboard state to a specific client
   */
  private sendDashboard(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN) {
      const dashboard = this.metricsCollector.getDashboard();
      const message: DashboardMessage = {
        type: 'dashboard',
        data: dashboard,
        timestamp: new Date().toISOString(),
      };

      ws.send(JSON.stringify(message));
    }
  }

  // ==========================================================================
  // Server Management
  // ==========================================================================

  /**
   * Get server status
   */
  getStatus() {
    return {
      port: this.config.websocketPort,
      clientCount: this.clients.size,
      isRunning: this.wss && this.wss.address() !== null,
    };
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    this.stopBroadcasting();

    // Close all client connections
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    // Close WebSocket server
    return new Promise((resolve, reject) => {
      this.wss.close((error) => {
        if (error) {
          console.error('Error closing WebSocket server:', error);
          reject(error);
        } else {
          console.log('WebSocket server stopped');
          resolve();
        }
      });
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalWebSocketServer: DashboardWebSocketServer | null = null;

/**
 * Get global WebSocket server instance
 */
export function getGlobalWebSocketServer(
  config?: Partial<DashboardConfig>
): DashboardWebSocketServer {
  if (!globalWebSocketServer) {
    globalWebSocketServer = new DashboardWebSocketServer(
      globalMetricsCollector,
      config
    );
  }
  return globalWebSocketServer;
}

/**
 * Stop global WebSocket server
 */
export async function stopGlobalWebSocketServer(): Promise<void> {
  if (globalWebSocketServer) {
    await globalWebSocketServer.stop();
    globalWebSocketServer = null;
  }
}
