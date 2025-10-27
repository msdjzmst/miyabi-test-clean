/**
 * Worker Registry - Track and manage workers
 *
 * Responsibilities:
 * - Worker registration
 * - Status tracking
 * - Skill matching
 * - Load balancing
 */

export type WorkerType = 'human' | 'ai_agent';
export type WorkerStatus = 'idle' | 'working' | 'offline';

export interface Worker {
  id: string;
  type: WorkerType;
  name: string;
  skills: string[];
  maxConcurrentTasks: number;
  currentTasks: string[]; // taskIds
  status: WorkerStatus;
  lastActivity: Date;
  metadata?: {
    email?: string;
    githubUsername?: string;
    agentModel?: string;
  };
}

export interface RegisterWorkerInput {
  name: string;
  type: WorkerType;
  skills: string[];
  maxConcurrentTasks?: number;
  metadata?: Worker['metadata'];
}

export class WorkerRegistry {
  private workers: Map<string, Worker> = new Map();
  private workerIdCounter = 0;

  /**
   * Register a new worker
   */
  register(input: RegisterWorkerInput): Worker {
    const workerId = this.generateWorkerId(input.type);

    const worker: Worker = {
      id: workerId,
      type: input.type,
      name: input.name,
      skills: input.skills,
      maxConcurrentTasks: input.maxConcurrentTasks || (input.type === 'human' ? 2 : 5),
      currentTasks: [],
      status: 'idle',
      lastActivity: new Date(),
      metadata: input.metadata,
    };

    this.workers.set(workerId, worker);

    console.log(`[WorkerRegistry] Registered ${input.type} worker: ${worker.name} (${workerId})`);

    return worker;
  }

  /**
   * Unregister a worker
   */
  unregister(workerId: string): boolean {
    const worker = this.workers.get(workerId);

    if (!worker) {
      console.error(`[WorkerRegistry] Worker ${workerId} not found`);
      return false;
    }

    if (worker.currentTasks.length > 0) {
      console.error(`[WorkerRegistry] Cannot unregister worker ${workerId} with active tasks`);
      return false;
    }

    this.workers.delete(workerId);
    console.log(`[WorkerRegistry] Unregistered worker: ${workerId}`);

    return true;
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): Worker | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get active workers (not offline)
   */
  getActiveWorkers(): Worker[] {
    return Array.from(this.workers.values()).filter(w => w.status !== 'offline');
  }

  /**
   * Get idle workers
   */
  getIdleWorkers(): Worker[] {
    return Array.from(this.workers.values()).filter(w => w.status === 'idle');
  }

  /**
   * Find best worker for task
   * Scoring algorithm:
   * 1. Skill match quality (more matching skills = better)
   * 2. Current load (fewer tasks = better)
   */
  findBestWorker(requiredSkills: string[]): Worker | null {
    const availableWorkers = this.getActiveWorkers().filter(worker => {
      // Check capacity
      if (worker.currentTasks.length >= worker.maxConcurrentTasks) {
        return false;
      }

      // Check skills
      return requiredSkills.every(skill => worker.skills.includes(skill));
    });

    if (availableWorkers.length === 0) {
      return null;
    }

    // Sort by skill match quality first, then by total skills, then by load
    availableWorkers.sort((a, b) => {
      // Count matching skills (prefer specialists over generalists)
      const aMatchCount = requiredSkills.filter(skill => a.skills.includes(skill)).length;
      const bMatchCount = requiredSkills.filter(skill => b.skills.includes(skill)).length;

      // If skill match count is different, prefer better match
      if (aMatchCount !== bMatchCount) {
        return bMatchCount - aMatchCount; // Descending
      }

      // If match count is same, prefer worker with more total skills (specialist)
      if (a.skills.length !== b.skills.length) {
        return b.skills.length - a.skills.length; // Descending
      }

      // If skills are same, prefer worker with fewer tasks
      return a.currentTasks.length - b.currentTasks.length; // Ascending
    });

    return availableWorkers[0];
  }

  /**
   * Assign task to worker
   */
  assignTask(workerId: string, taskId: string): boolean {
    const worker = this.workers.get(workerId);

    if (!worker) {
      console.error(`[WorkerRegistry] Worker ${workerId} not found`);
      return false;
    }

    if (worker.currentTasks.length >= worker.maxConcurrentTasks) {
      console.error(`[WorkerRegistry] Worker ${workerId} at max capacity`);
      return false;
    }

    worker.currentTasks.push(taskId);
    worker.status = 'working';
    worker.lastActivity = new Date();

    console.log(`[WorkerRegistry] Assigned task ${taskId} to worker ${workerId}`);

    return true;
  }

  /**
   * Unassign task from worker
   */
  unassignTask(workerId: string, taskId: string): boolean {
    const worker = this.workers.get(workerId);

    if (!worker) {
      console.error(`[WorkerRegistry] Worker ${workerId} not found`);
      return false;
    }

    const index = worker.currentTasks.indexOf(taskId);
    if (index === -1) {
      console.error(`[WorkerRegistry] Task ${taskId} not assigned to worker ${workerId}`);
      return false;
    }

    worker.currentTasks.splice(index, 1);

    // Update status
    if (worker.currentTasks.length === 0) {
      worker.status = 'idle';
    }

    worker.lastActivity = new Date();

    console.log(`[WorkerRegistry] Unassigned task ${taskId} from worker ${workerId}`);

    return true;
  }

  /**
   * Update worker status
   */
  updateStatus(workerId: string, status: WorkerStatus): boolean {
    const worker = this.workers.get(workerId);

    if (!worker) {
      console.error(`[WorkerRegistry] Worker ${workerId} not found`);
      return false;
    }

    worker.status = status;
    worker.lastActivity = new Date();

    console.log(`[WorkerRegistry] Updated worker ${workerId} status to ${status}`);

    return true;
  }

  /**
   * Send heartbeat (keep-alive)
   */
  heartbeat(workerId: string): boolean {
    const worker = this.workers.get(workerId);

    if (!worker) {
      console.error(`[WorkerRegistry] Worker ${workerId} not found`);
      return false;
    }

    worker.lastActivity = new Date();

    return true;
  }

  /**
   * Check for stale workers (no heartbeat for 10 minutes)
   */
  checkStaleWorkers(): Worker[] {
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    const staleWorkers: Worker[] = [];

    for (const worker of this.workers.values()) {
      const timeSinceActivity = now - worker.lastActivity.getTime();

      if (timeSinceActivity > staleThreshold && worker.status !== 'offline') {
        worker.status = 'offline';
        staleWorkers.push(worker);
        console.warn(`[WorkerRegistry] Worker ${worker.id} marked as offline (stale)`);
      }
    }

    return staleWorkers;
  }

  /**
   * Get workers by skill
   */
  getWorkersBySkill(skill: string): Worker[] {
    return Array.from(this.workers.values()).filter(w => w.skills.includes(skill));
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    const stats = {
      total: this.workers.size,
      idle: 0,
      working: 0,
      offline: 0,
      humans: 0,
      aiAgents: 0,
      totalCapacity: 0,
      totalLoad: 0,
    };

    for (const worker of this.workers.values()) {
      // Status
      switch (worker.status) {
        case 'idle':
          stats.idle++;
          break;
        case 'working':
          stats.working++;
          break;
        case 'offline':
          stats.offline++;
          break;
      }

      // Type
      if (worker.type === 'human') {
        stats.humans++;
      } else {
        stats.aiAgents++;
      }

      // Capacity and load
      stats.totalCapacity += worker.maxConcurrentTasks;
      stats.totalLoad += worker.currentTasks.length;
    }

    return stats;
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(type: WorkerType): string {
    this.workerIdCounter++;
    const prefix = type === 'human' ? 'human' : 'agent';
    return `${prefix}-${String(this.workerIdCounter).padStart(3, '0')}`;
  }
}
