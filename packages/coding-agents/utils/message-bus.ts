/**
 * MessageBus - Inter-agent messaging infrastructure
 *
 * Provides centralized message routing and delivery between agents
 * Issue: #139 - Agent Communication Protocol定義
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  AgentMessage,
  MessageResponse,
  MessageType,
  MessagePriority,
  MessageHandler,
  MessageBusConfig,
  isAgentMessage,
} from '../types/communication';
import { AgentType } from '../types/index';
import { logger } from '../ui/index';

// ============================================================================
// MessageBus Implementation
// ============================================================================

/**
 * MessageBus - Central message routing and delivery
 *
 * Features:
 * - Agent registration
 * - Message routing
 * - Priority queue management
 * - Message logging and tracing
 * - Error handling
 */
export class MessageBus extends EventEmitter {
  private handlers: Map<AgentType, MessageHandler>;
  private messageQueue: Map<AgentType, AgentMessage[]>;
  private config: Required<MessageBusConfig>;
  private messageLog: AgentMessage[];
  private isProcessing: Map<AgentType, boolean>;

  constructor(config: MessageBusConfig = {}) {
    super();

    this.handlers = new Map();
    this.messageQueue = new Map();
    this.messageLog = [];
    this.isProcessing = new Map();

    // Apply default config
    this.config = {
      enableLogging: config.enableLogging ?? true,
      defaultTtl: config.defaultTtl ?? 300000, // 5 minutes
      maxQueueSize: config.maxQueueSize ?? 1000,
      enablePersistence: config.enablePersistence ?? false,
      persistenceDir: config.persistenceDir ?? './.miyabi/messages',
    };

    logger.system('MessageBus initialized');
  }

  // ==========================================================================
  // Agent Registration
  // ==========================================================================

  /**
   * Register an agent message handler
   *
   * @param agentType - Type of agent to register
   * @param handler - Message handler function
   */
  register(agentType: AgentType, handler: MessageHandler): void {
    if (this.handlers.has(agentType)) {
      logger.warn(`Agent ${agentType} already registered. Overwriting.`);
    }

    this.handlers.set(agentType, handler);
    this.messageQueue.set(agentType, []);
    this.isProcessing.set(agentType, false);

    if (this.config.enableLogging) {
      logger.system(`Registered handler for ${agentType}`);
    }

    this.emit('agent:registered', { agentType });
  }

  /**
   * Unregister an agent
   *
   * @param agentType - Type of agent to unregister
   */
  unregister(agentType: AgentType): void {
    this.handlers.delete(agentType);
    this.messageQueue.delete(agentType);
    this.isProcessing.delete(agentType);

    if (this.config.enableLogging) {
      logger.system(`Unregistered handler for ${agentType}`);
    }

    this.emit('agent:unregistered', { agentType });
  }

  /**
   * Check if an agent is registered
   */
  isRegistered(agentType: AgentType): boolean {
    return this.handlers.has(agentType);
  }

  // ==========================================================================
  // Message Sending
  // ==========================================================================

  /**
   * Send a message to another agent
   *
   * @param message - Message to send
   * @returns Promise<MessageResponse>
   */
  async send<T = unknown>(message: AgentMessage<T>): Promise<MessageResponse> {
    // Validate message
    if (!isAgentMessage(message)) {
      throw new Error('Invalid message format');
    }

    // Check if recipient is registered
    if (!this.isRegistered(message.to)) {
      const errorResponse: MessageResponse = {
        messageId: message.id,
        success: false,
        error: `No handler registered for agent: ${message.to}`,
        timestamp: new Date().toISOString(),
      };
      return errorResponse;
    }

    // Log message
    if (this.config.enableLogging) {
      this.messageLog.push(message);
      logger.system(
        `Message sent: ${message.from} → ${message.to} [${message.type}]`
      );
    }

    // Emit message event
    this.emit('message:sent', message);

    // Add to queue and process
    await this.enqueueMessage(message);

    // For now, return immediate success
    // In a production system, this would wait for the actual response
    const response: MessageResponse = {
      messageId: message.id,
      success: true,
      timestamp: new Date().toISOString(),
    };

    return response;
  }

  /**
   * Send a message and wait for response
   *
   * @param message - Message to send
   * @param timeoutMs - Timeout in milliseconds
   * @returns Promise<MessageResponse>
   */
  async sendAndWait<T = unknown>(
    message: AgentMessage<T>,
    timeoutMs: number = 30000
  ): Promise<MessageResponse> {
    const correlationId = message.correlationId || uuidv4();
    const messageWithCorrelation = { ...message, correlationId };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('message:response', responseHandler);
        reject(new Error(`Message timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const responseHandler = (response: MessageResponse) => {
        if (response.messageId === messageWithCorrelation.id) {
          clearTimeout(timeout);
          this.removeListener('message:response', responseHandler);
          resolve(response);
        }
      };

      this.on('message:response', responseHandler);
      this.send(messageWithCorrelation).catch(reject);
    });
  }

  // ==========================================================================
  // Message Queue Management
  // ==========================================================================

  /**
   * Enqueue message for processing
   */
  private async enqueueMessage<T>(message: AgentMessage<T>): Promise<void> {
    const queue = this.messageQueue.get(message.to);
    if (!queue) return;

    // Check queue size
    if (queue.length >= this.config.maxQueueSize) {
      logger.error(`Message queue full for ${message.to}`);
      this.emit('queue:overflow', { agentType: message.to });
      return;
    }

    // Add to queue (priority-based insertion)
    const insertIndex = queue.findIndex(
      (m) => m.priority > message.priority
    );
    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }

    // Process queue if not already processing
    if (!this.isProcessing.get(message.to)) {
      await this.processQueue(message.to);
    }
  }

  /**
   * Process message queue for an agent
   */
  private async processQueue(agentType: AgentType): Promise<void> {
    const queue = this.messageQueue.get(agentType);
    const handler = this.handlers.get(agentType);

    if (!queue || !handler) return;

    this.isProcessing.set(agentType, true);

    while (queue.length > 0) {
      const message = queue.shift()!;

      try {
        const startTime = Date.now();
        const response = await handler(message);
        const durationMs = Date.now() - startTime;

        // Add duration to response
        response.durationMs = durationMs;

        // Emit response event
        this.emit('message:response', response);

        if (this.config.enableLogging) {
          logger.system(
            `Message processed: ${message.id} (${durationMs}ms)`
          );
        }
      } catch (error) {
        logger.error(`Error processing message ${message.id}:`, error);
        this.emit('message:error', { message, error });

        // Emit error response
        const errorResponse: MessageResponse = {
          messageId: message.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        };
        this.emit('message:response', errorResponse);
      }
    }

    this.isProcessing.set(agentType, false);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Create a new message with defaults
   */
  createMessage<T = unknown>(
    from: AgentType,
    to: AgentType,
    type: MessageType,
    payload: T,
    priority: MessagePriority = MessagePriority.MEDIUM
  ): AgentMessage<T> {
    return {
      id: uuidv4(),
      from,
      to,
      type,
      priority,
      payload,
      timestamp: new Date().toISOString(),
      ttl: this.config.defaultTtl,
    };
  }

  /**
   * Get queue size for an agent
   */
  getQueueSize(agentType: AgentType): number {
    const queue = this.messageQueue.get(agentType);
    return queue ? queue.length : 0;
  }

  /**
   * Get total message count across all queues
   */
  getTotalQueueSize(): number {
    let total = 0;
    for (const queue of this.messageQueue.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Get message log (recent messages)
   */
  getMessageLog(limit: number = 100): AgentMessage[] {
    return this.messageLog.slice(-limit);
  }

  /**
   * Clear message log
   */
  clearMessageLog(): void {
    this.messageLog = [];
  }

  /**
   * Get registered agents
   */
  getRegisteredAgents(): AgentType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      registeredAgents: this.handlers.size,
      totalQueueSize: this.getTotalQueueSize(),
      messageLogSize: this.messageLog.length,
      queueSizesByAgent: Object.fromEntries(
        Array.from(this.messageQueue.entries()).map(([agent, queue]) => [
          agent,
          queue.length,
        ])
      ),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global MessageBus instance
 */
export const globalMessageBus = new MessageBus();
