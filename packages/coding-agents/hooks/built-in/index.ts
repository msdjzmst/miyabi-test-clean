/**
 * Built-in Hooks
 *
 * Provides commonly used hooks for agent lifecycle management
 */

export { EnvironmentCheckHook } from './environment-check-hook';
export { DependencyCheckHook } from './dependency-check-hook';
export { CleanupHook } from './cleanup-hook';
export { NotificationHook, type NotificationConfig } from './notification-hook';
export { DashboardWebhookHook, type DashboardWebhookConfig } from './dashboard-webhook-hook';
