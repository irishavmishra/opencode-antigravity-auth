/**
 * Rate Limiter Module
 * 
 * Centralized rate limit tracking with time-window deduplication.
 * Extracted from plugin.ts for better maintainability.
 */

import type { HeaderStyle } from "../constants";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Threshold for "short" retries that retry on same account */
export const SHORT_RETRY_THRESHOLD_MS = 5000;

/** Window for deduplicating concurrent 429s from same account */
export const RATE_LIMIT_DEDUP_WINDOW_MS = 2000;

/** Reset consecutive counter after this duration of no 429s */
export const RATE_LIMIT_STATE_RESET_MS = 120_000;

/** Maximum consecutive non-429 failures before cooldown */
export const MAX_CONSECUTIVE_FAILURES = 5;

/** Cooldown duration after max failures */
export const FAILURE_COOLDOWN_MS = 30_000;

/** Reset failure count after this duration */
export const FAILURE_STATE_RESET_MS = 120_000;

/** Maximum backoff delay */
export const MAX_BACKOFF_MS = 60_000;

// ============================================================================
// TYPES
// ============================================================================

export type ModelFamily = "claude" | "gemini";

interface RateLimitState {
    consecutive429: number;
    lastAt: number;
    quotaKey: string;
}

interface FailureState {
    consecutiveFailures: number;
    lastFailureAt: number;
}

export interface BackoffResult {
    attempt: number;
    delayMs: number;
    isDuplicate: boolean;
}

export interface FailureResult {
    failures: number;
    shouldCooldown: boolean;
    cooldownMs: number;
}

// ============================================================================
// STATE
// ============================================================================

const rateLimitStateByAccountQuota = new Map<string, RateLimitState>();
const accountFailureState = new Map<number, FailureState>();
const emptyResponseAttempts = new Map<string, number>();

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Convert header style + family to quota key.
 */
export function headerStyleToQuotaKey(headerStyle: HeaderStyle, family: ModelFamily): string {
    if (family === "claude") return "claude";
    return headerStyle === "antigravity" ? "gemini-antigravity" : "gemini-cli";
}

/**
 * Get rate limit backoff with time-window deduplication.
 * 
 * Problem: When multiple subagents hit 429 simultaneously, each would increment
 * the consecutive counter, causing incorrect exponential backoff.
 * 
 * Solution: Track per account+quota with dedup window. Multiple 429s
 * within RATE_LIMIT_DEDUP_WINDOW_MS are treated as a single event.
 */
export function getRateLimitBackoff(
    accountIndex: number,
    quotaKey: string,
    serverRetryAfterMs: number | null
): BackoffResult {
    const now = Date.now();
    const stateKey = `${accountIndex}:${quotaKey}`;
    const previous = rateLimitStateByAccountQuota.get(stateKey);

    // Check if this is a duplicate 429 within the dedup window
    if (previous && now - previous.lastAt < RATE_LIMIT_DEDUP_WINDOW_MS) {
        const baseDelay = serverRetryAfterMs ?? 1000;
        const backoffDelay = Math.min(
            baseDelay * Math.pow(2, previous.consecutive429 - 1),
            MAX_BACKOFF_MS
        );
        return {
            attempt: previous.consecutive429,
            delayMs: Math.max(baseDelay, backoffDelay),
            isDuplicate: true,
        };
    }

    // Increment or reset consecutive counter
    const attempt =
        previous && now - previous.lastAt < RATE_LIMIT_STATE_RESET_MS
            ? previous.consecutive429 + 1
            : 1;

    rateLimitStateByAccountQuota.set(stateKey, {
        consecutive429: attempt,
        lastAt: now,
        quotaKey,
    });

    const baseDelay = serverRetryAfterMs ?? 1000;
    const backoffDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
    return { attempt, delayMs: Math.max(baseDelay, backoffDelay), isDuplicate: false };
}

/**
 * Reset rate limit state for a specific account+quota.
 */
export function resetRateLimitState(accountIndex: number, quotaKey: string): void {
    rateLimitStateByAccountQuota.delete(`${accountIndex}:${quotaKey}`);
}

/**
 * Reset all rate limit state for an account (all quotas).
 */
export function resetAllRateLimitStateForAccount(accountIndex: number): void {
    for (const key of rateLimitStateByAccountQuota.keys()) {
        if (key.startsWith(`${accountIndex}:`)) {
            rateLimitStateByAccountQuota.delete(key);
        }
    }
}

/**
 * Track consecutive non-429 failures for an account.
 */
export function trackAccountFailure(accountIndex: number): FailureResult {
    const now = Date.now();
    const previous = accountFailureState.get(accountIndex);

    const failures =
        previous && now - previous.lastFailureAt < FAILURE_STATE_RESET_MS
            ? previous.consecutiveFailures + 1
            : 1;

    accountFailureState.set(accountIndex, {
        consecutiveFailures: failures,
        lastFailureAt: now,
    });

    const shouldCooldown = failures >= MAX_CONSECUTIVE_FAILURES;
    const cooldownMs = shouldCooldown ? FAILURE_COOLDOWN_MS : 0;

    return { failures, shouldCooldown, cooldownMs };
}

/**
 * Reset failure state for an account.
 */
export function resetAccountFailureState(accountIndex: number): void {
    accountFailureState.delete(accountIndex);
}

/**
 * Track empty response retry attempts.
 */
export function getEmptyResponseAttempts(sessionId: string): number {
    return emptyResponseAttempts.get(sessionId) ?? 0;
}

export function incrementEmptyResponseAttempts(sessionId: string): number {
    const current = emptyResponseAttempts.get(sessionId) ?? 0;
    emptyResponseAttempts.set(sessionId, current + 1);
    return current + 1;
}

export function resetEmptyResponseAttempts(sessionId: string): void {
    emptyResponseAttempts.delete(sessionId);
}

/**
 * Clear all state (useful for testing).
 */
export function clearAllState(): void {
    rateLimitStateByAccountQuota.clear();
    accountFailureState.clear();
    emptyResponseAttempts.clear();
}
