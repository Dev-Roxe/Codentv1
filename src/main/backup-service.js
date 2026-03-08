/**
 * backup-service.js  — SECURITY FIX S10
 * Automatic daily backup of the SQLite database.
 *
 * Strategy:
 *  - On app start, copy the DB to <userData>/backups/ with a timestamp.
 *  - Keep the last 30 backups, delete older ones automatically.
 *  - Schedule a daily backup using setInterval (24h).
 *  - Also expose runManualBackup() for a "Backup ahora" button in Settings.
 */

const fs = require('fs');
const path = require('path');
const { resolveDbPath, resolveUserDataPath } = require('../db/db-path');

const MAX_BACKUPS = 30;          // Keep last 30 days
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let _intervalHandle = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBackupDir() {
    const userData = resolveUserDataPath();
    const dir = path.join(userData, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function timestampedName() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        '_',
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds()),
    ].join('');
    return `consultorio_backup_${stamp}.db`;
}

/**
 * Removes oldest backups when count exceeds MAX_BACKUPS.
 */
function pruneOldBackups(backupDir) {
    try {
        const files = fs.readdirSync(backupDir)
            .filter((f) => f.startsWith('consultorio_backup_') && f.endsWith('.db'))
            .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
            .sort((a, b) => a.mtime - b.mtime); // oldest first

        while (files.length > MAX_BACKUPS) {
            const oldest = files.shift();
            fs.unlinkSync(path.join(backupDir, oldest.name));
            console.log('[Backup] Eliminado backup antiguo:', oldest.name);
        }
    } catch (err) {
        console.warn('[Backup] Error purgando backups antiguos:', err.message);
    }
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Creates one timestamped copy of the DB file.
 * @returns {{ success: boolean, file: string|null, error: string|null }}
 */
function runBackup() {
    try {
        const src = resolveDbPath();
        if (!fs.existsSync(src)) {
            return { success: false, file: null, error: 'DB file not found: ' + src };
        }

        const backupDir = getBackupDir();
        const destName = timestampedName();
        const dest = path.join(backupDir, destName);

        fs.copyFileSync(src, dest);
        pruneOldBackups(backupDir);

        console.log('[Backup] ✅ Backup creado:', dest);
        return { success: true, file: dest, error: null };
    } catch (err) {
        console.error('[Backup] ❌ Error al crear backup:', err.message);
        return { success: false, file: null, error: err.message };
    }
}

/**
 * Alias for IPC handler — "Backup manual" from settings UI.
 */
function runManualBackup() {
    return runBackup();
}

/**
 * Returns list of available backups sorted newest first.
 */
function listBackups() {
    try {
        const backupDir = getBackupDir();
        const files = fs.readdirSync(backupDir)
            .filter((f) => f.startsWith('consultorio_backup_') && f.endsWith('.db'))
            .map((f) => {
                const fullPath = path.join(backupDir, f);
                const stat = fs.statSync(fullPath);
                return { name: f, path: fullPath, sizeBytes: stat.size, mtime: stat.mtimeMs };
            })
            .sort((a, b) => b.mtime - a.mtime); // newest first
        return { success: true, backups: files };
    } catch (err) {
        return { success: false, backups: [], error: err.message };
    }
}

/**
 * Starts automatic daily backup scheduler.
 * Call once from main.js after app is ready.
 */
function startAutoBackup() {
    // Run immediately on startup
    const result = runBackup();
    if (result.success) {
        console.log('[Backup] Backup inicial en startup completado.');
    }

    // Then every 24 hours
    _intervalHandle = setInterval(() => {
        runBackup();
    }, INTERVAL_MS);

    // Don't block app quit
    if (_intervalHandle.unref) _intervalHandle.unref();

    console.log('[Backup] Auto-backup programado cada 24 horas.');
}

/**
 * Stops the auto backup scheduler (call on app quit if needed).
 */
function stopAutoBackup() {
    if (_intervalHandle) {
        clearInterval(_intervalHandle);
        _intervalHandle = null;
    }
}

module.exports = {
    startAutoBackup,
    stopAutoBackup,
    runManualBackup,
    listBackups,
};
