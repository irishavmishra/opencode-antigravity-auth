/**
 * Environment Detection Helpers
 * 
 * Utilities for detecting runtime environment (WSL, remote, etc.)
 * and platform-specific browser opening.
 */

import { exec } from "node:child_process";

// ============================================================================
// WSL Detection
// ============================================================================

/**
 * Check if running in Windows Subsystem for Linux (WSL).
 */
export function isWSL(): boolean {
    if (process.platform !== "linux") return false;
    try {
        const { readFileSync } = require("node:fs");
        const release = readFileSync("/proc/version", "utf8").toLowerCase();
        return release.includes("microsoft") || release.includes("wsl");
    } catch {
        return false;
    }
}

/**
 * Check if running in WSL2 specifically.
 */
export function isWSL2(): boolean {
    if (!isWSL()) return false;
    try {
        const { readFileSync } = require("node:fs");
        const version = readFileSync("/proc/version", "utf8").toLowerCase();
        return version.includes("wsl2") || version.includes("microsoft-standard");
    } catch {
        return false;
    }
}

// ============================================================================
// Remote Environment Detection
// ============================================================================

/**
 * Check if running in a remote environment (SSH, containers, codespaces).
 */
export function isRemoteEnvironment(): boolean {
    // SSH connection
    if (process.env.SSH_CLIENT || process.env.SSH_TTY || process.env.SSH_CONNECTION) {
        return true;
    }
    // Remote containers / Codespaces
    if (process.env.REMOTE_CONTAINERS || process.env.CODESPACES) {
        return true;
    }
    // Linux without display (headless server)
    if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && !isWSL()) {
        return true;
    }
    return false;
}

/**
 * Check if local OAuth server should be skipped (WSL2 or remote).
 */
export function shouldSkipLocalServer(): boolean {
    return isWSL2() || isRemoteEnvironment();
}

// ============================================================================
// Browser Opening
// ============================================================================

/**
 * Open a URL in the default browser.
 * Returns true if successfully opened, false otherwise.
 */
export async function openBrowser(url: string): Promise<boolean> {
    try {
        if (process.platform === "darwin") {
            exec(`open "${url}"`);
            return true;
        }
        if (process.platform === "win32") {
            exec(`start "" "${url}"`);
            return true;
        }
        if (isWSL()) {
            try {
                exec(`wslview "${url}"`);
                return true;
            } catch { }
        }
        if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
            return false;
        }
        exec(`xdg-open "${url}"`);
        return true;
    } catch {
        return false;
    }
}
