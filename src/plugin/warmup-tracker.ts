/**
 * Warmup Session Tracker
 * 
 * Tracks warmup attempts and successes for Claude thinking signature sessions.
 * Prevents infinite warmup loops and manages session state.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of OAuth accounts */
export const MAX_OAUTH_ACCOUNTS = 10;

/** Maximum tracked warmup sessions (LRU cleanup) */
export const MAX_WARMUP_SESSIONS = 1000;

/** Maximum warmup retry attempts per session */
export const MAX_WARMUP_RETRIES = 2;

// ============================================================================
// STATE
// ============================================================================

const warmupAttemptedSessionIds = new Set<string>();
const warmupSucceededSessionIds = new Set<string>();

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Track a warmup attempt for a session.
 * Returns true if warmup should proceed, false if max attempts reached or already succeeded.
 */
export function trackWarmupAttempt(sessionId: string): boolean {
    // Skip if already succeeded
    if (warmupSucceededSessionIds.has(sessionId)) {
        return false;
    }

    // LRU cleanup for attempted sessions
    if (warmupAttemptedSessionIds.size >= MAX_WARMUP_SESSIONS) {
        const first = warmupAttemptedSessionIds.values().next().value;
        if (first) {
            warmupAttemptedSessionIds.delete(first);
            warmupSucceededSessionIds.delete(first);
        }
    }

    // Check if max attempts reached
    const attempts = getWarmupAttemptCount(sessionId);
    if (attempts >= MAX_WARMUP_RETRIES) {
        return false;
    }

    warmupAttemptedSessionIds.add(sessionId);
    return true;
}

/**
 * Get the number of warmup attempts for a session.
 */
export function getWarmupAttemptCount(sessionId: string): number {
    return warmupAttemptedSessionIds.has(sessionId) ? 1 : 0;
}

/**
 * Mark a warmup session as successfully completed.
 */
export function markWarmupSuccess(sessionId: string): void {
    warmupSucceededSessionIds.add(sessionId);

    // LRU cleanup for succeeded sessions
    if (warmupSucceededSessionIds.size >= MAX_WARMUP_SESSIONS) {
        const first = warmupSucceededSessionIds.values().next().value;
        if (first) warmupSucceededSessionIds.delete(first);
    }
}

/**
 * Clear warmup attempt tracking for a session.
 */
export function clearWarmupAttempt(sessionId: string): void {
    warmupAttemptedSessionIds.delete(sessionId);
}

/**
 * Check if warmup has succeeded for a session.
 */
export function hasWarmupSucceeded(sessionId: string): boolean {
    return warmupSucceededSessionIds.has(sessionId);
}

/**
 * Clear all warmup state (useful for testing).
 */
export function clearAllWarmupState(): void {
    warmupAttemptedSessionIds.clear();
    warmupSucceededSessionIds.clear();
}
