#!/usr/bin/env tsx
/**
 * Webhook Security Module
 *
 * Implements GitHub webhook signature verification and security checks
 * Phase B Enhancement - Issue #5
 *
 * Security Features:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation (prevent replay attacks)
 * - Request rate limiting
 * - IP allowlist verification (optional)
 */

import { createHmac, timingSafeEqual } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface WebhookVerificationOptions {
  secret: string;
  signature: string;
  payload: string;
  timestamp?: string;
  maxAge?: number; // Max age in seconds (default: 300 = 5 minutes)
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface SecurityCheckResult {
  valid: boolean;
  reason?: string;
  timestamp?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MAX_AGE = 300; // 5 minutes
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

// GitHub's webhook source IPs (for additional verification)
// Source: https://api.github.com/meta
const GITHUB_WEBHOOK_IPS = [
  '192.30.252.0/22',
  '185.199.108.0/22',
  '140.82.112.0/20',
  '143.55.64.0/20',
];

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 *
 * GitHub sends a signature in the X-Hub-Signature-256 header:
 * sha256=<signature>
 *
 * @param options Verification options
 * @returns True if signature is valid
 */
export function verifyWebhookSignature(options: WebhookVerificationOptions): SecurityCheckResult {
  const { secret, signature, payload, timestamp, maxAge = DEFAULT_MAX_AGE } = options;

  // 1. Validate inputs
  if (!secret || !signature || !payload) {
    return {
      valid: false,
      reason: 'Missing required parameters: secret, signature, or payload',
    };
  }

  // 2. Extract signature algorithm and hash
  const signatureMatch = signature.match(/^sha256=([a-f0-9]{64})$/);
  if (!signatureMatch) {
    return {
      valid: false,
      reason: 'Invalid signature format (expected sha256=<hex>)',
    };
  }

  const receivedSignature = signatureMatch[1];

  // 3. Compute expected signature
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  // 4. Timing-safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(receivedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return {
      valid: false,
      reason: 'Signature length mismatch',
    };
  }

  const isSignatureValid = timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!isSignatureValid) {
    return {
      valid: false,
      reason: 'Signature verification failed',
    };
  }

  // 5. Validate timestamp (prevent replay attacks)
  if (timestamp) {
    const timestampResult = validateTimestamp(timestamp, maxAge);
    if (!timestampResult.valid) {
      return timestampResult;
    }
  }

  return {
    valid: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate webhook timestamp to prevent replay attacks
 *
 * @param timestamp ISO timestamp string
 * @param maxAge Maximum age in seconds
 * @returns Validation result
 */
export function validateTimestamp(timestamp: string, maxAge: number = DEFAULT_MAX_AGE): SecurityCheckResult {
  try {
    const requestTime = new Date(timestamp).getTime();

    // Check if timestamp is valid
    if (isNaN(requestTime)) {
      return {
        valid: false,
        reason: 'Invalid timestamp format',
      };
    }

    const currentTime = Date.now();
    const age = (currentTime - requestTime) / 1000; // Convert to seconds

    if (age < 0) {
      return {
        valid: false,
        reason: 'Timestamp is in the future',
      };
    }

    if (age > maxAge) {
      return {
        valid: false,
        reason: `Timestamp too old (${age}s > ${maxAge}s)`,
      };
    }

    return {
      valid: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      valid: false,
      reason: `Invalid timestamp format: ${(error as Error).message}`,
    };
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = config;
  }

  /**
   * Check if request is allowed under rate limit
   *
   * @param identifier Unique identifier (e.g., IP address, user ID)
   * @returns True if request is allowed
   */
  checkLimit(identifier: string): SecurityCheckResult {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];

    // Remove expired requests
    const validRequests = requests.filter((time) => now - time < this.config.windowMs);

    // Check if limit exceeded
    if (validRequests.length >= this.config.maxRequests) {
      return {
        valid: false,
        reason: `Rate limit exceeded: ${this.config.maxRequests} requests per ${this.config.windowMs}ms`,
      };
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return {
      valid: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear rate limit data for identifier
   */
  clear(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Clear all rate limit data
   */
  clearAll(): void {
    this.requests.clear();
  }
}

// ============================================================================
// IP Verification
// ============================================================================

/**
 * Verify if IP address is from GitHub's webhook servers
 *
 * @param ip IP address to verify
 * @returns True if IP is from GitHub
 */
export function verifyGitHubIP(ip: string): SecurityCheckResult {
  // This is a simplified check - in production, use a proper CIDR matching library
  const isGitHubIP = GITHUB_WEBHOOK_IPS.some((range) => {
    // Simple prefix match for demonstration
    const prefix = range.split('/')[0].split('.').slice(0, 2).join('.');
    return ip.startsWith(prefix);
  });

  if (!isGitHubIP) {
    return {
      valid: false,
      reason: `IP ${ip} is not from GitHub's webhook servers`,
    };
  }

  return {
    valid: true,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Comprehensive Security Check
// ============================================================================

export interface ComprehensiveSecurityOptions {
  secret: string;
  signature: string;
  payload: string;
  timestamp?: string;
  ip?: string;
  identifier?: string;
  skipIPCheck?: boolean;
  skipRateLimit?: boolean;
}

const globalRateLimiter = new RateLimiter();

/**
 * Perform comprehensive security checks on webhook request
 *
 * @param options Security check options
 * @returns Security check result
 */
export function performSecurityCheck(options: ComprehensiveSecurityOptions): SecurityCheckResult {
  const { secret, signature, payload, timestamp, ip, identifier, skipIPCheck, skipRateLimit } = options;

  // 1. Verify signature
  const signatureResult = verifyWebhookSignature({
    secret,
    signature,
    payload,
    timestamp,
  });

  if (!signatureResult.valid) {
    return signatureResult;
  }

  // 2. Verify IP (optional)
  if (!skipIPCheck && ip) {
    const ipResult = verifyGitHubIP(ip);
    if (!ipResult.valid) {
      return ipResult;
    }
  }

  // 3. Rate limit check (optional)
  if (!skipRateLimit && identifier) {
    const rateLimitResult = globalRateLimiter.checkLimit(identifier);
    if (!rateLimitResult.valid) {
      return rateLimitResult;
    }
  }

  return {
    valid: true,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Export
// ============================================================================

export { RateLimiter };
export default {
  verifyWebhookSignature,
  validateTimestamp,
  verifyGitHubIP,
  performSecurityCheck,
  RateLimiter,
};
