/**
 * Plugin Module Index
 * 
 * This file documents the architecture of the opencode-antigravity-auth plugin.
 * The plugin has been refactored for better maintainability and modularity.
 * 
 * Module Structure:
 * 
 * Core Modules:
 * - plugin.ts         Main plugin entry point and HTTP interception
 * - accounts.ts       Multi-account management and rotation
 * - request.ts        Antigravity API request preparation
 * - request-helpers.ts Request transformation utilities
 * 
 * Extracted Utility Modules:
 * - rate-limiter.ts   Rate limit tracking with deduplication
 * - warmup-tracker.ts Claude thinking session warmup state
 * - environment.ts    Platform detection (WSL, remote, browser)
 * - oauth-helpers.ts  OAuth callback URL parsing and prompts
 * 
 * Configuration:
 * - config/           Configuration loading and schema
 * - storage.ts        Account persistence
 * 
 * Recovery & Caching:
 * - recovery.ts       Session recovery for errors
 * - cache.ts          Thinking signature caching
 * 
 * @module opencode-antigravity-auth/plugin
 */

// Re-export types for convenience
export type { ModelFamily } from "./accounts";
export type { OAuthCallbackParams } from "./oauth-helpers";
export type { BackoffResult, FailureResult } from "./rate-limiter";
