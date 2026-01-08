/**
 * OAuth Helpers
 * 
 * Utilities for OAuth callback handling and user prompts.
 */

import { exchangeAntigravity, type AntigravityTokenExchangeResult } from "../antigravity/oauth";

// ============================================================================
// TYPES
// ============================================================================

export type OAuthCallbackParams = { code: string; state: string };

// ============================================================================
// URL PARSING
// ============================================================================

/**
 * Extract state parameter from an authorization URL.
 */
export function getStateFromAuthorizationUrl(authorizationUrl: string): string {
    try {
        return new URL(authorizationUrl).searchParams.get("state") ?? "";
    } catch {
        return "";
    }
}

/**
 * Extract OAuth callback parameters from a URL.
 */
export function extractOAuthCallbackParams(url: URL): OAuthCallbackParams | null {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
        return null;
    }
    return { code, state };
}

/**
 * Parse user input (code or full URL) into OAuth callback parameters.
 */
export function parseOAuthCallbackInput(
    value: string,
    fallbackState: string,
): OAuthCallbackParams | { error: string } {
    const trimmed = value.trim();
    if (!trimmed) {
        return { error: "Missing authorization code" };
    }

    try {
        const url = new URL(trimmed);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state") ?? fallbackState;

        if (!code) {
            return { error: "Missing code in callback URL" };
        }
        if (!state) {
            return { error: "Missing state in callback URL" };
        }

        return { code, state };
    } catch {
        if (!fallbackState) {
            return { error: "Missing state. Paste the full redirect URL instead of only the code." };
        }

        return { code: trimmed, state: fallbackState };
    }
}

// ============================================================================
// USER PROMPTS
// ============================================================================

/**
 * Prompt user for OAuth callback value (code or URL).
 */
export async function promptOAuthCallbackValue(message: string): Promise<string> {
    const { createInterface } = await import("node:readline/promises");
    const { stdin, stdout } = await import("node:process");
    const rl = createInterface({ input: stdin, output: stdout });
    try {
        return (await rl.question(message)).trim();
    } finally {
        rl.close();
    }
}

/**
 * Guide user through manual OAuth input when automatic callback fails.
 */
export async function promptManualOAuthInput(
    fallbackState: string,
): Promise<AntigravityTokenExchangeResult> {
    console.log("1. Open the URL above in your browser and complete Google sign-in.");
    console.log("2. After approving, copy the full redirected localhost URL from the address bar.");
    console.log("3. Paste it back here.\n");

    const callbackInput = await promptOAuthCallbackValue(
        "Paste the redirect URL (or just the code) here: ",
    );
    const params = parseOAuthCallbackInput(callbackInput, fallbackState);
    if ("error" in params) {
        return { type: "failed", error: params.error };
    }

    return exchangeAntigravity(params.code, params.state);
}
